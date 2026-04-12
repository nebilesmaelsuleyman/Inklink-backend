from pathlib import Path
import os
import threading
from typing import Any, Optional, Tuple


import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI()


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "model"




class Post(BaseModel):
   text: str




def _is_strict_mode() -> bool:
   normalized = (os.getenv("MODERATION_STRICT_MODE", "false") or "").strip().lower()
   return normalized in {"1", "true", "yes", "on"}




def _artifacts_ready() -> tuple[bool, str]:
   if not (MODEL_DIR / "config.json").exists():
       return False, "Model not found at /app/model. Run download_model.py first."
   if not (DATA_DIR / "golden_embeddings.npy").exists() or not (DATA_DIR / "golden_labels.npy").exists():
       return False, "Embeddings not found in /app/data. Run preprocess_golden.py first."
   return True, "ready"




ModerationAssets = Tuple[Any, Any, np.ndarray, np.ndarray]
_assets: Optional[ModerationAssets] = None
_assets_error: Optional[str] = None
_warmup_started = False
_warmup_done = False




def _load_moderation_assets() -> ModerationAssets:
   from embedding_utils import get_moderation_results, similarity


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
   ready, _ = _artifacts_ready()
   if ready:
       _ensure_warmup_started()




def _fallback_moderate(text: str):
   # Conservative fallback: prefer manual review when the model is unavailable.
   normalized = (text or "").lower()
   flagged_terms = ("idiot", "stupid", "kill", "hate", "garbage", "incompetent", "useless")
   contains_flagged = any(term in normalized for term in flagged_terms)
   return {
       "child_safe": not contains_flagged,
       "adult_safe": not contains_flagged,
       "confidence": 0.35 if contains_flagged else 0.2,
       "mode": "fallback",
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


   get_moderation_results, similarity, golden_embeddings, golden_labels = _assets
   emb, probs = get_moderation_results(post.text)
  
   # 1. Classification decision (Fine-tuned head)
   # User confirmed: 1 = Safe, 0 = Toxic.
   # Therefore, probs[1] is the score for Safe, and probs[0] is the score for Toxic.
   is_safe_by_classifier = probs[1] > 0.5
   classifier_confidence = float(probs[1] if is_safe_by_classifier else probs[0])


   # 2. Vector Context check (Golden CSV)
   sims = similarity(emb, golden_embeddings)
   best_idx = int(sims.argmax())
   label = golden_labels[best_idx]
   vector_confidence = float(sims[0][best_idx])


   label_value = label.tolist() if hasattr(label, 'tolist') else label
   child_safe_by_vector = bool(label_value[0]) if isinstance(label_value, list) else bool(label_value)
   adult_safe_by_vector = bool(label_value[1]) if isinstance(label_value, list) else bool(label_value)


   # Hybrid Decision Logic:
   if vector_confidence > 0.99:
       # High confidence match in CSV (Manual Anchor) takes priority!
       # This allows you to "White-list" or "Black-list" specific stories.
       child_safe = child_safe_by_vector
       adult_safe = adult_safe_by_vector
       mode = "vector_anchor_match"
   else:
       # 1. Base Classifer Decision
       # Children: Require high confidence of safety (e.g. > 70%)
       child_safe = probs[1] > 0.7
      
       # Adults: Allow anything except high toxicity (e.g. < 95% toxic)
       # This provides the "flexibility" you requested.
       adult_safe = probs[0] < 0.95


       # 2. Vector Refinement (Context check)
       # Only influence the decision if the vector match is strong enough to trust.
       if vector_confidence > 0.8:
           # If a similar story is specifically marked as unsafe for kids, respect that.
           if not child_safe_by_vector:
               child_safe = False
           # If a similar story is specifically marked as safe for adults, respect that.
           if adult_safe_by_vector:
               adult_safe = True
      
       mode = "classifier_hybrid"


   final_confidence = max(float(probs[1] if child_safe else probs[0]), vector_confidence)


   # Flag for manual review if they disagree significantly
   # or if the classifier is in the "unsure" zone (0.4 - 0.6)
   flag_for_review = (child_safe != adult_safe) or (probs[1] > 0.4 and probs[1] < 0.6)


   return {
       "child_safe": bool(child_safe),
       "adult_safe": bool(adult_safe),
       "flag_for_review": bool(flag_for_review),
       "confidence": float(final_confidence),
       "mode": mode,
       "classifier_probs": probs.tolist()
   }




@app.post("/moderation")
def moderation_alias(post: Post):
   return moderate(post)




@app.get("/test")
def test_endpoint():
   # Hardcoded test case for the story provided by the user
   text = "አቶ በቀለ ወደ ቢሮው እንደገባ ፋይሉን በጠረጴዛው ላይ ወርውሮ በንቀት ተመለከተኝ። 'እስከዛሬ ካየኋቸው ሰራተኞች አንተ የመጨረሻው ደንቆሮ እና የማይረባ ሰው ነህ' ሲል በጩኸት ተሳደበ። 'ይህን የመሰለ ቆሻሻ ስራ ይዘህ መምጣትህ ራሱ ምን ያህል አእምሮ እንደሌለህ ያሳያል። እውነት ለመናገር ለዚህ ድርጅት አንተ እንደ ትርፍ አንጀት ነህ፤ ምንም ፋይዳ የሌለህ ዋጋ ቢስ!' እኔም ላስረዳው ብሞክርም፣ 'ዝም በል! ያን የላም አእምሮህን ይዘህ ልታስረዳኝ አትሞክር። ካሁኑ ከፊቴ ጠፋ፣ ካልሆነ ግን እንደማላውቅህ አደርግሃለሁ' ብሎ በሰው ፊት አዋረደኝ"
   return moderate(Post(text=text))
