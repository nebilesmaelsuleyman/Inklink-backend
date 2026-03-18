import gdown
import zipfile
import os

FOLDER_ID = "1_mqtiVMW6otZ0DrWZyUoZgxs4Bnu_xtd"
URL = f"https://drive.google.com/uc?id={FOLDER_ID}"

OUTPUT = "model_checkpoint.pt"

if not os.path.exists("model"):
    print("Downloading model...")
    gdown.download_folder(
    id=FOLDER_ID,
    output="model",
    quiet=False
)

    print("Model ready")
else:
    print("Model already exists")