import gdown
import os

FOLDER_ID = "1_mqtiVMW6otZ0DrWZyUoZgxs4Bnu_xtd"
URL = f"https://drive.google.com/uc?id={FOLDER_ID}"

def model_ready(path: str) -> bool:
    return os.path.isdir(path) and os.path.isfile(os.path.join(path, "config.json"))


if not model_ready("model"):
    print("Downloading model...")
    gdown.download_folder(
        id=FOLDER_ID,
        output="model",
        quiet=False,
    )
    print("Model ready")
else:
    print("Model already exists")
