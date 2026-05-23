import sys
from pathlib import Path

# Dynamically add the virtual environment's site-packages to sys.path if running under an interpreter that lacks the dependencies
BASE_DIR = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = BASE_DIR / "venv" / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import torch.nn.functional as F
# pyrefly: ignore [missing-import]
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics.pairwise import cosine_similarity

MODEL_PATH = str(BASE_DIR / "model")


from typing import Any

# Lazy-load model and tokenizer to avoid import-time crashes
_tokenizer: Any = None
_model: Any = None


def ensure_model():
    global _tokenizer, _model
    if _model is not None:
        return

    _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
    _model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)
    _model.eval()


def get_moderation_results(text):
    ensure_model()

    inputs = _tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = _model(**inputs)

        # 1. Hidden state (embedding) for the similarity check
        # The base model is accessible via model.roberta
        base_outputs = _model.roberta(
            inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )
        embedding = base_outputs.last_hidden_state[:, 0, :].detach().numpy()

        # 2. Classification probabilities
        probs = F.softmax(outputs.logits, dim=-1).detach().numpy()[0]

    return embedding, probs


def similarity(vec, matrix):
    sims = cosine_similarity(vec, matrix)
    return sims
