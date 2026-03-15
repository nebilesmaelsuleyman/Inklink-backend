import gdown
import zipfile
import os

FILE_ID = "1_mqtiVMW6otZ0DrWZyUoZgxs4Bnu_xtd"
URL = f"https://drive.google.com/uc?id={FILE_ID}"

OUTPUT = "model.zip"

if not os.path.exists("model"):
    print("Downloading model...")
    gdown.download(URL, OUTPUT, quiet=False)

    print("Extracting...")
    with zipfile.ZipFile(OUTPUT, 'r') as zip_ref:
        zip_ref.extractall("model")

    os.remove(OUTPUT)

    print("Model ready")
else:
    print("Model already exists")