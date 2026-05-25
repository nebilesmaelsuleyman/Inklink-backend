import sys
from pathlib import Path
import os

# Dynamically add the virtual environment's site-packages to sys.path if running under an interpreter that lacks the dependencies
BASE_DIR = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = BASE_DIR / "venv" / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

import threading
from typing import Any, Optional, Tuple


# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from pydantic import BaseModel



app = FastAPI()

DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "model"



class Post(BaseModel):
   text: str


def _is_strict_mode() -> bool:
   normalized = (os.getenv("MODERATION_STRICT_MODE", "false") or "").strip().lower()
   return normalized in {"1", "true", "yes", "on"}


def _artifacts_ready() -> tuple[bool, str]:
   if not (MODEL_DIR / "config.json").exists():
       return False, "Model not found. Run download_model.py first."
   # Check for at least one tokenizer file
   has_tokenizer = (MODEL_DIR / "tokenizer.json").exists() or (MODEL_DIR / "sentencepiece.bpe.model").exists()
   if not has_tokenizer:
       return False, "Tokenizer not found. Run download_model.py first."
   if not (DATA_DIR / "golden_embeddings.npy").exists() or not (DATA_DIR / "golden_labels.npy").exists():
       return False, "Embeddings not found. Run preprocess_golden.py first."
   return True, "ready"


ModerationAssets = Tuple[Any, Any, np.ndarray, np.ndarray]
_assets: Optional[ModerationAssets] = None
_assets_error: Optional[str] = None
_warmup_started = False
_warmup_done = False


def _load_moderation_assets() -> ModerationAssets:
   from embedding_utils import get_moderation_results, similarity, ensure_model

   # Pre-load the PyTorch model so the first request doesn't time out
   ensure_model()

   golden_embeddings = np.load(DATA_DIR / "golden_embeddings.npy")
   golden_labels = np.load(DATA_DIR / "golden_labels.npy")

   return get_moderation_results, similarity, golden_embeddings, golden_labels


def _ensure_warmup_started() -> None:
   global _warmup_started
   if _warmup_started:
       return

   _warmup_started = True

   def _warm() -> None:
       global _assets, _assets_error, _warmup_done
       try:
           _assets = _load_moderation_assets()
           _assets_error = None
       except Exception as exc:  # pragma: no cover
           _assets = None
           _assets_error = f"Failed to load moderation assets: {exc}"
       finally:
           _warmup_done = True

   threading.Thread(target=_warm, daemon=True).start()


@app.on_event("startup")
def _kickoff_warmup() -> None:
   auto_setup = (os.getenv("MODERATION_AUTO_SETUP", "false") or "").strip().lower() in {"1", "true", "yes", "on"}

   ready, _ = _artifacts_ready()
   if not ready and auto_setup:
       try:
           import download_model  # noqa: F401
           import preprocess_golden  # noqa: F401
       except Exception:
           pass

   ready, _ = _artifacts_ready()
   if ready:
       _ensure_warmup_started()


def _fallback_moderate(text: str):
   """Keyword-based fallback when the model is unavailable."""
   normalized = (text or "").lower()
   flagged_terms = ("idiot", "stupid", "kill", "hate", "garbage", "incompetent", "useless")
   contains_flagged = any(term in normalized for term in flagged_terms)
   return {
       "child_safe": not contains_flagged,
       "adult_safe": not contains_flagged,
       "confidence": 0.35 if contains_flagged else 0.2,
       "mode": "fallback",
       "flag_for_review": False,
       "classifier_probs": {"safe": 0.0, "toxic": 0.0},
   }


@app.get("/ready")
def readiness():
   strict = _is_strict_mode()
   ready, message = _artifacts_ready()

   if ready:
       _ensure_warmup_started()
       if not _warmup_done:
           return {"ready": True, "message": "warming_up", "mode": "warming_up"}
       if _assets_error is not None:
           if strict:
               return {"ready": False, "message": _assets_error, "mode": "strict"}
           return {"ready": True, "message": f"fallback_mode: {_assets_error}", "mode": "fallback"}
       return {"ready": True, "message": "ready", "mode": "model"}

   if strict:
       return {"ready": False, "message": message, "mode": "strict"}

   return {"ready": True, "message": f"fallback_mode: {message}", "mode": "fallback"}


@app.post("/moderate")
def moderate(post: Post):
   strict = _is_strict_mode()
   ready, message = _artifacts_ready()
   if not ready:
       if strict:
           raise HTTPException(status_code=503, detail=message)
       return _fallback_moderate(post.text)

   global _assets, _assets_error
   _ensure_warmup_started()
   if not _warmup_done:
       if strict:
           raise HTTPException(status_code=503, detail="warming_up")
       return _fallback_moderate(post.text)

   if _assets is None:
       if strict:
           raise HTTPException(status_code=503, detail=_assets_error or "Assets not loaded")
       return _fallback_moderate(post.text)

   get_moderation_results, similarity_fn, golden_embeddings, golden_labels = _assets
   emb, probs = get_moderation_results(post.text)

   # ── 1. XLM-R Classifier (primary authority) ──
   # The model was trained with inverted labels:
   # Label 0 = NOT_TOXIC (safe), Label 1 = TOXIC (unsafe)
   safe_score = float(probs[0])
   toxic_score = float(probs[1])

   # ── 2. Vector context (secondary signal, used only when classifier is uncertain) ──
   sims = similarity_fn(emb, golden_embeddings)
   best_idx = int(sims.argmax())
   label = golden_labels[best_idx]
   vector_confidence = float(sims[0][best_idx])

   label_value = label.tolist() if hasattr(label, 'tolist') else label
   child_safe_by_vector = bool(label_value[0]) if isinstance(label_value, list) else bool(label_value)
   adult_safe_by_vector = bool(label_value[1]) if isinstance(label_value, list) else bool(label_value)

   # ── 3. Decision logic: three-tier content classification ──
   #
   #   Tier 1 — Fully safe:       child_safe=True,  adult_safe=True  → approved
   #   Tier 2 — Adult-only:       child_safe=False, adult_safe=True  → needs_admin_review (age gate)
   #   Tier 3 — Fully toxic/hate: child_safe=False, adult_safe=False → rejected
   #
   # XLM-R handles the safe↔toxic boundary.
   # The vector database (with separate child_safe / adult_safe columns) refines
   # whether "not fully safe" means adult-only or truly harmful.
   flag_for_review = False

   # ── Case A: Classifier clearly safe (safe_score ≥ 0.6) ──
   if safe_score >= 0.6:
       # Even safe-scoring text might be adult-only (e.g. mature fiction, explicit themes).
       # Use vector to detect high-confidence adult-only golden matches.
       if (vector_confidence > 0.75
               and not child_safe_by_vector
               and adult_safe_by_vector):
           child_safe = False
           adult_safe = True
           final_confidence = vector_confidence
           mode = "vector_adult_content"
       else:
           child_safe = True
           adult_safe = True
           final_confidence = safe_score
           mode = "classifier_safe"

   # ── Case B: Classifier says toxic/unsafe (safe_score ≤ 0.4 or moderately toxic) ──
   elif safe_score <= 0.6:
       # Guard: if classifier is HIGHLY confident this is toxic (toxic_score > 0.85),
       # never let the vector rescue it into adult-only.
       # Hate speech, racism, and clear toxic content are NEVER adult-appropriate.
       classifier_highly_toxic = toxic_score > 0.85

       # Vector rescue: adult-only content that the binary classifier mislabels as toxic.
       # Only applies when classifier is NOT highly confident AND vector strongly agrees
       # this matches an adult-only (not child-safe but adult-safe) golden entry.
       vector_says_adult_only = (
           vector_confidence > 0.82
           and not child_safe_by_vector
           and adult_safe_by_vector
       )

       if not classifier_highly_toxic and vector_says_adult_only:
           child_safe = False
           adult_safe = True
           final_confidence = vector_confidence
           mode = "vector_adult_content_override"
       else:
           child_safe = False
           adult_safe = False
           final_confidence = toxic_score
           mode = "classifier_toxic"

   # ── Case C: Uncertain zone — vector tiebreaker ──
   else:
       if vector_confidence > 0.75:
           child_safe = child_safe_by_vector
           adult_safe = adult_safe_by_vector
           final_confidence = vector_confidence
           mode = "vector_tiebreaker"
       else:
           # Both signals uncertain → send to admin
           child_safe = False
           adult_safe = False
           final_confidence = min(safe_score, 1.0 - safe_score)
           mode = "uncertain_admin_review"
           flag_for_review = True

   return {
       "child_safe": bool(child_safe),
       "adult_safe": bool(adult_safe),
       "flag_for_review": bool(flag_for_review),
       "confidence": float(final_confidence),
       "mode": mode,
       "classifier_probs": {"safe": safe_score, "toxic": toxic_score},
       "vector_confidence": float(vector_confidence),
   }


@app.post("/moderation")
def moderation_alias(post: Post):
   return moderate(post)


@app.get("/test")
def test_endpoint():
   # Hardcoded test case for the story provided by the user
   text = "አቶ በቀለ ወደ ቢሮው እንደገባ ፋይሉን በጠረጴዛው ላይ ወርውሮ በንቀት ተመለከተኝ። 'እስከዛሬ ካየኋቸው ሰራተኞች አንተ የመጨረሻው ደንቆሮ እና የማይረባ ሰው ነህ' ሲል በጩኸት ተሳደበ። 'ይህን የመሰለ ቆሻሻ ስራ ይዘህ መምጣትህ ራሱ ምን ያህል አእምሮ እንደሌለህ ያሳያል። እውነት ለመናገር ለዚህ ድርጅት አንተ እንደ ትርፍ አንጀት ነህ፤ ምንም ፋይዳ የሌለህ ዋጋ ቢስ!' እኔም ላስረዳው ብሞክርም፣ 'ዝም በል! ያን የላም አእምሮህን ይዘህ ልታስረዳኝ አትሞክር። ካሁኑ ከፊቴ ጠፋ፣ ካልሆነ ግን እንደማላውቅህ አደርግሃለሁ' ብሎ በሰው ፊት አዋረደኝ"
   return moderate(Post(text=text))
