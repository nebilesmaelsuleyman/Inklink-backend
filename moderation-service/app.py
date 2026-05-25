import sys
from pathlib import Path
import os
import re

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


# ──────────────────────────────────────────────────────────────────────────────
# Language detection
# ──────────────────────────────────────────────────────────────────────────────

# Ethiopic Unicode block: U+1200–U+137F covers all Amharic/Geez characters
_ETHIOPIC_RE = re.compile(r"[\u1200-\u137F]")

def _is_amharic(text: str) -> bool:
    """Returns True if the text contains a significant amount of Ethiopic script."""
    ethiopic_chars = len(_ETHIOPIC_RE.findall(text))
    total_alpha = sum(1 for c in text if c.isalpha())
    if total_alpha == 0:
        return False
    return (ethiopic_chars / total_alpha) > 0.3


# ──────────────────────────────────────────────────────────────────────────────
# Keyword patterns
# Used as PRIMARY signal for Amharic (model not trained on Amharic),
# and as a SAFETY NET override for clear English hate speech the model misses.
# ──────────────────────────────────────────────────────────────────────────────

# Amharic hate speech, racism, dehumanization, ethnic hate, gender violence
AMHARIC_HATE_PATTERNS = [
    # ── Pro-slavery / racist justification ──
    r"ባርነት\s*ጥሩ",           # "slavery was good"
    r"ባርነት.*ጠቃሚ",           # "slavery was useful"
    r"ባርነት.*ያሻሻለ",          # "slavery improved"
    r"ባርነት.*ሕይወት",          # "slavery ... life"
    r"ባርነት\s*ንግድ",          # "slave trade"
    r"ባርነት.*መቀጠል",          # "slavery must continue"
    r"ባሪያ.*ይገባ",            # "deserve to be slave"
    # ── Dehumanization ──
    r"ዱር\s*ፍጥረ",            # "wild creatures"
    r"እንደ\s*ዱር",             # "like wild/savage"
    r"እንደ\s*እንስሳ",           # "like animals"
    r"ኔግሮ",                  # racial slur
    r"እንደ\s*ጥንቸል\s*ይወልዳ",  # "breed like rabbits"
    r"ኋላቀር\s*ሕይወት",         # "backward life"
    r"ኋላቀር\s*አስተሳሰብ",       # "backward thinking"
    r"ኋላቀር\s*ሕዝብ",          # "backward people"
    r"ጥገኛ\s*ሕዝብ",           # "parasite people"
    r"ቆሻሻ\s*ዘር",            # "garbage race/lineage"
    # ── Race-based ──
    r"ጥቁር\s*ወንጀለ",          # "black criminals"
    r"ጥቁር.*ወንጀ",            # "black ... crime"
    r"ከፍተኛ.*ወንጀ.*ጥቁር",     # "high crime ... black"
    r"ነጭ\s*ሰዎ.*የበለጠ",      # "white people ... more/superior"
    r"ተለመዱ.*ነጭ",            # "normal white"
    r"ነጭ\s*የበላ",             # "white supremacy" phrasing
    # ── Ethnic / tribal hate (common in Ethiopian context) ──
    r"ብሔር.*ማጥፋት",           # "ethnic cleansing/genocide"
    r"ዘር.*ማጥፋት",            # "race extermination"
    r"ጎሳ.*መጥፋት",            # "tribe ... extinction"
    r"ዘር.*ማጽዳት",            # "ethnic cleansing"
    r"ዘረኛ.*ሁሉ",             # "all [that ethnic group] are..."
    r"ሁሉም.*ሌብ",             # "all of them are thieves" (ethnic generalization)
    r"ሁሉም.*ወንጀለኛ",          # "all of them are criminals"
    r"ሕዝብ.*ማጥፋት",           # "destroy a people"
    r"ዘር.*መግደል",            # "kill a race"
    # ── Religious hate ──
    r"ካፊር.*መግደል",           # "kill infidels"
    r"ክርስቲያን.*ጠላት",         # "Christians are enemies"
    r"ሙስሊም.*ጠላት",           # "Muslims are enemies"
    r"ሃይማኖት.*ማጥፋት",        # "destroy religion"
    # ── Gender-based hate / sexual violence ──
    r"ሴቶች.*ዋጋ\s*የላቸው",     # "women have no value"
    r"ሴት.*መደፈር",            # "women ... rape"
    r"ደፈር",                  # "raped"
    r"አስገድዶ\s*ደፈር",         # "forced/raped"
    r"ሴቶች.*ባሪያ",            # "women are slaves"
    # ── Direct threats / incitement ──
    r"እንግደላቸው",              # "let's kill them"
    r"ሁሉንም.*ግደል",           # "kill all of them"
    r"መግደል\s*አለብን",         # "we must kill"
    r"ማጥፋት\s*አለብን",         # "we must destroy"
    r"እናጥፋቸው",              # "let's destroy them"
    r"ይገደሉ",                # "they should be killed"
    r"ይሙት",                 # "let them die" (as threat)
]

# English hate speech that the fine-tuned model reliably misses (confirmed by testing)
ENGLISH_HATE_HARDCODED = [
    r"\bnegro(e?s)?\b",
    r"\bnigger(s)?\b",
    r"\bnigga(s)?\b",
    r"\bk[i!]ke(s)?\b",
    r"\bwetback(s)?\b",
    r"\bcoon(s)?\b",
    r"slavery\s+was\s+good",
    r"slavery\s+(must|should)\s+continue",
    r"slave\s+trade\s+(improved|upgraded|benefited)",
    r"breed\s+like\s+rabbits",
    r"primate\s+beings",
    r"subhuman",
    r"\bkill\s+all\s+(blacks?|jews?|muslims?|whites?|gays?)",
    r"\bdeath\s+to\s+(blacks?|jews?|muslims?|whites?|gays?)",
    r"ethnic\s+cleans",
    r"genoc[i!]de\s+(is|was)\s+(good|necessary|needed)",
    r"\brape\s+(all|every|them)\b",
    r"\b(all|every)\s+(women|girls?)\s+deserve.*(rape|beat|hit)",
]

# Amharic violence indicators (for adult-only classification, not auto-reject)
AMHARIC_VIOLENCE = [
    r"ደሙ.*ይፈስ",          # blood flowing
    r"ህይወቱ\s*እስኪያልፍ",    # until life passes (death)
    r"ደበደቡት",             # beat him/her
    r"ወግቶት",              # stabbed him
    r"ደም\s*ተጨማለቀ",       # soaked in blood
    r"ሞተ|ሞቱ",            # died
    r"ገደለ|ገደሉ",          # killed
    r"በካራ.*ወጋ",           # stabbed with knife
    r"በጥይት.*ተመታ",        # shot with bullet
    r"ደም\s*ፈሰሰ",          # blood spilled
    r"አንገቱን\s*ቆረጠ",       # cut his throat
    r"ጭካኔ.*ደበደቡ",        # cruelly beat
    r"በጭካኔ",              # with cruelty
]

# English violence indicators (for adult-only — model gives too-low scores for graphic violence)
ENGLISH_VIOLENCE = [
    r"\bstab(bed|bing|s)?\b",
    r"blood\s+was\s+(flowing|spilling|pouring)",
    r"stained\s+with\s+blood",
    r"soaked\s+in\s+blood",
    r"brutall?y\s+beat",
    r"beat.*until.*pass(ed)?\s+away",
    r"beat.*until.*died?",
    r"until\s+he\s+(passed|died|was\s+dead)",
    r"\bbegging\s+on\s+the\s+ground\b",
    r"\bslaughter(ed|ing)?\b",
    r"\btortur(e|ed|ing)\b",
    r"\bmassacr(e|ed|ing)\b",
    r"\bblood(y)?\s+(everywhere|all\s+over)\b",
    r"\bslit\s+(his|her|their)\s+throat\b",
]


def _compile(patterns: list[str]) -> list[re.Pattern]:
    return [re.compile(p, re.IGNORECASE | re.UNICODE) for p in patterns]


_AM_HATE     = _compile(AMHARIC_HATE_PATTERNS)
_EN_HATE     = _compile(ENGLISH_HATE_HARDCODED)
_AM_VIOLENCE = _compile(AMHARIC_VIOLENCE)
_EN_VIOLENCE = _compile(ENGLISH_VIOLENCE)


def _keyword_analysis(text: str) -> dict:
    hate_matches = []
    for pat in _AM_HATE + _EN_HATE:
        m = pat.search(text)
        if m:
            hate_matches.append(m.group(0))

    am_v_hits = sum(1 for pat in _AM_VIOLENCE if pat.search(text))
    en_v_hits = sum(1 for pat in _EN_VIOLENCE if pat.search(text))
    # Amharic: 3+ of 7 patterns → adult-only; English: 2+ of 9 patterns → adult-only
    am_violence_score = min(am_v_hits / 3.0, 1.0)
    en_violence_score = min(en_v_hits / 2.0, 1.0)
    violence_score = max(am_violence_score, en_violence_score)

    return {
        "hate_matches": hate_matches,
        "violence_score": round(violence_score, 3),
    }


class Post(BaseModel):
   text: str


def _is_strict_mode() -> bool:
   normalized = (os.getenv("MODERATION_STRICT_MODE", "false") or "").strip().lower()
   return normalized in {"1", "true", "yes", "on"}


def _artifacts_ready() -> tuple[bool, str]:
   if not (MODEL_DIR / "config.json").exists():
       return False, "Model not found. Run download_model.py first."
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
       except Exception as exc:
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
           import download_model    # noqa: F401
           import preprocess_golden # noqa: F401
       except Exception:
           pass
   ready, _ = _artifacts_ready()
   if ready:
       _ensure_warmup_started()


# ──────────────────────────────────────────────────────────────────────────────
# Amharic-only path (keyword-based, model doesn't handle Amharic)
# ──────────────────────────────────────────────────────────────────────────────

def _moderate_amharic(text: str, vector_confidence: float = 0.0) -> dict:
    """
    Keyword-based moderation for Amharic text.
    The fine-tuned XLM-R model was trained on English-only (UC Berkeley/Jigsaw)
    and outputs toxic≈0.997 for all Amharic input regardless of content.
    """
    analysis = _keyword_analysis(text)

    if analysis["hate_matches"]:
        return {
            "child_safe": False,
            "adult_safe": False,
            "confidence": 0.97,
            "mode": "amharic_keyword_hate_reject",
            "flag_for_review": False,
            "classifier_probs": {"safe": 0.03, "toxic": 0.97},
            "vector_confidence": round(vector_confidence, 4),
            "keyword_matches": analysis["hate_matches"],
        }

    if analysis["violence_score"] >= 0.6:
        return {
            "child_safe": False,
            "adult_safe": True,
            "confidence": analysis["violence_score"],
            "mode": "amharic_keyword_violence_adult",
            "flag_for_review": False,
            "classifier_probs": {"safe": 0.5, "toxic": 0.5},
            "vector_confidence": round(vector_confidence, 4),
        }

    return {
        "child_safe": True,
        "adult_safe": True,
        "confidence": 0.80,
        "mode": "amharic_keyword_safe",
        "flag_for_review": False,
        "classifier_probs": {"safe": 0.80, "toxic": 0.20},
        "vector_confidence": round(vector_confidence, 4),
    }


# ──────────────────────────────────────────────────────────────────────────────
# English path (XLM-R model is primary, keywords catch what the model misses)
# ──────────────────────────────────────────────────────────────────────────────

def _moderate_english_with_model(text: str, safe_score: float, toxic_score: float, vector_confidence: float) -> dict:
    """
    Uses the fine-tuned XLM-R model as the primary signal for English text.
    Keyword overrides handle known gaps (e.g., explicit racism the model underscores).
    """
    analysis = _keyword_analysis(text)

    # ── Safety net: hate speech keywords the model reliably underscores ──
    if analysis["hate_matches"]:
        return {
            "child_safe": False,
            "adult_safe": False,
            "confidence": 0.97,
            "mode": "english_keyword_hate_reject",
            "flag_for_review": False,
            "classifier_probs": {"safe": safe_score, "toxic": toxic_score},
            "vector_confidence": round(vector_confidence, 4),
            "keyword_matches": analysis["hate_matches"],
        }

    # ── Violence keyword override: graphic violence is adult-only even if model underscores ──
    if analysis["violence_score"] >= 0.6:
        return {
            "child_safe": False,
            "adult_safe": True,
            "confidence": analysis["violence_score"],
            "mode": "english_keyword_violence_adult",
            "flag_for_review": False,
            "classifier_probs": {"safe": safe_score, "toxic": toxic_score},
            "vector_confidence": round(vector_confidence, 4),
        }

    # ── XLM-R model: primary authority for English ──
    #
    # Model thresholds (calibrated from testing):
    #   safe_score >= 0.65  → content is safe (model confident)
    #   safe_score  < 0.35  → content is toxic (model confident)
    #   between 0.35-0.65   → uncertain → flag for admin review
    #
    if safe_score >= 0.65:
        return {
            "child_safe": True,
            "adult_safe": True,
            "confidence": safe_score,
            "mode": "xlmr_safe",
            "flag_for_review": False,
            "classifier_probs": {"safe": safe_score, "toxic": toxic_score},
            "vector_confidence": round(vector_confidence, 4),
        }
    elif safe_score < 0.35:
        return {
            "child_safe": False,
            "adult_safe": False,
            "confidence": toxic_score,
            "mode": "xlmr_toxic",
            "flag_for_review": False,
            "classifier_probs": {"safe": safe_score, "toxic": toxic_score},
            "vector_confidence": round(vector_confidence, 4),
        }
    else:
        # Uncertain zone: send to admin review
        return {
            "child_safe": False,
            "adult_safe": False,
            "confidence": min(safe_score, toxic_score),
            "mode": "xlmr_uncertain_admin_review",
            "flag_for_review": True,
            "classifier_probs": {"safe": safe_score, "toxic": toxic_score},
            "vector_confidence": round(vector_confidence, 4),
        }


def _fallback_moderate(text: str) -> dict:
    """Used when ML model is unavailable — keyword-based for both languages."""
    analysis = _keyword_analysis(text)
    if analysis["hate_matches"]:
        return {
            "child_safe": False, "adult_safe": False,
            "confidence": 0.95, "mode": "fallback_hate_reject",
            "flag_for_review": False,
            "classifier_probs": {"safe": 0.05, "toxic": 0.95},
            "keyword_matches": analysis["hate_matches"],
        }
    if analysis["violence_score"] >= 0.6:
        return {
            "child_safe": False, "adult_safe": True,
            "confidence": analysis["violence_score"], "mode": "fallback_violence_adult",
            "flag_for_review": False,
            "classifier_probs": {"safe": 0.5, "toxic": 0.5},
        }
    return {
        "child_safe": True, "adult_safe": True,
        "confidence": 0.70, "mode": "fallback_safe",
        "flag_for_review": False,
        "classifier_probs": {"safe": 0.70, "toxic": 0.30},
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

   # ── Detect language ──
   amharic = _is_amharic(post.text)

   if amharic:
       # Model is useless for Amharic — go straight to keyword path
       return _moderate_amharic(post.text)

   # ── English path: run the XLM-R fine-tuned model ──
   get_moderation_results, similarity_fn, golden_embeddings, golden_labels = _assets
   emb, probs = get_moderation_results(post.text)

   safe_score  = float(probs[0])
   toxic_score = float(probs[1])

   # Vector similarity (for context only; embeddings are collapsed so low weight)
   sims = similarity_fn(emb, golden_embeddings)
   best_idx = int(sims.argmax())
   vector_confidence = float(sims[0][best_idx])

   return _moderate_english_with_model(post.text, safe_score, toxic_score, vector_confidence)


@app.post("/moderation")
def moderation_alias(post: Post):
   return moderate(post)


@app.get("/test")
def test_endpoint():
   text = "አቶ በቀለ ወደ ቢሮው እንደገባ ፋይሉን በጠረጴዛው ላይ ወርውሮ በንቀት ተመለከተኝ። 'እስከዛሬ ካየኋቸው ሰራተኞች አንተ የመጨረሻው ደንቆሮ እና የማይረባ ሰው ነህ' ሲል በጩኸት ተሳደበ። 'ይህን የመሰለ ቆሻሻ ስራ ይዘህ መምጣትህ ራሱ ምን ያህል አእምሮ እንደሌለህ ያሳያል። እውነት ለመናገር ለዚህ ድርጅት አንተ እንደ ትርፍ አንጀት ነህ፤ ምንም ፋይዳ የሌለህ ዋጋ ቢስ!' እኔም ላስረዳው ብሞክርም፣ 'ዝም በል! ያን የላም አእምሮህን ይዘህ ላስረዳኝ አትሞክር። ካሁኑ ከፊቴ ጠፋ፣ ካልሆነ ግን እንደማላውቅህ አደርግሃለሁ' ብሎ በሰው ፊት አዋረደኝ"
   return moderate(Post(text=text))
