import sys
import os
import time
from pathlib import Path
# pyrefly: ignore [missing-import]
import gdown
# pyrefly: ignore [missing-import]
from transformers import AutoTokenizer
# Dynamically add the virtual environment's site-packages to sys.path if running under an interpreter that lacks the dependencies
BASE_DIR = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = BASE_DIR / "venv" / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))


FOLDER_ID = "1_mqtiVMW6otZ0DrWZyUoZgxs4Bnu_xtd"

MODEL_DIR = Path(__file__).resolve().parent / "model"

# Model weights are required
REQUIRED_MODEL_FILES = ["config.json", "model.safetensors"]
# Tokenizer needs at least one of these
TOKENIZER_FILES = ["tokenizer.json", "sentencepiece.bpe.model"]


def model_ready(path: Path) -> bool:
    return path.is_dir() and all((path / f).is_file() for f in REQUIRED_MODEL_FILES)


def tokenizer_ready(path: Path) -> bool:
    return path.is_dir() and any((path / f).is_file() for f in TOKENIZER_FILES)


def download_model_weights():
    """Download model weights from Google Drive."""
    

    retries = int(os.getenv("MODEL_DOWNLOAD_RETRIES", "3") or "3")
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            gdown.download_folder(
                id=FOLDER_ID,
                output=str(MODEL_DIR),
                quiet=False,
            )
            last_err = None
            break
        except Exception as exc:
            last_err = exc
            print(f"Model download attempt {attempt}/{retries} failed: {exc}")
            time.sleep(min(10 * attempt, 30))

    if last_err is not None or not model_ready(MODEL_DIR):
        raise RuntimeError(
            f"Model download failed after {retries} attempts. Last error: {last_err}"
        )


def ensure_tokenizer():
    """Download tokenizer from xlm-roberta-base if missing.

    The fine-tuned model uses the same tokenizer as the base xlm-roberta model,
    so we can safely download it from HuggingFace.
    """
    if tokenizer_ready(MODEL_DIR):
        return

    print("Tokenizer files missing; downloading from xlm-roberta-base...")
    # pyrefly: ignore [missing-import]
    

    tokenizer = AutoTokenizer.from_pretrained("xlm-roberta-base")
    tokenizer.save_pretrained(str(MODEL_DIR))
    print("Tokenizer saved to model directory")


# ── Main execution ──────────────────────────────────────────────────
if not model_ready(MODEL_DIR):
    print("Downloading model...")
    download_model_weights()
    print("Model ready")
else:
    print("Model already exists")

ensure_tokenizer()
