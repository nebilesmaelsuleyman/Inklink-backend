import gdown
import os
import time

FOLDER_ID = "1_mqtiVMW6otZ0DrWZyUoZgxs4Bnu_xtd"
URL = f"https://drive.google.com/uc?id={FOLDER_ID}"

def model_ready(path: str) -> bool:
    return os.path.isdir(path) and os.path.isfile(os.path.join(path, "config.json"))


if not model_ready("model"):
    print("Downloading model...")
    retries = int(os.getenv("MODEL_DOWNLOAD_RETRIES", "3") or "3")
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            gdown.download_folder(
                id=FOLDER_ID,
                output="model",
                quiet=False,
            )
            last_err = None
            break
        except Exception as exc:
            last_err = exc
            print(f"Model download attempt {attempt}/{retries} failed: {exc}")
            time.sleep(min(10 * attempt, 30))

    if last_err is not None or not model_ready("model"):
        raise RuntimeError(
            f"Model download failed after {retries} attempts. Last error: {last_err}"
        )
    print("Model ready")
else:
    print("Model already exists")
