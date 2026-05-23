import sys
from pathlib import Path

# Dynamically add the virtual environment's site-packages to sys.path if running under an interpreter that lacks the dependencies
BASE_DIR = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = BASE_DIR / "venv" / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

import numpy as np


DATA_DIR = Path(__file__).resolve().parent / "data"

emb_path = DATA_DIR / "golden_embeddings.npy"
labels_path = DATA_DIR / "golden_labels.npy"


def main() -> int:
    force = "--force" in sys.argv

    if not force and emb_path.exists() and labels_path.exists():
        print("Embeddings already exist; skipping preprocessing.")
        print("Use --force to regenerate.")
        return 0

    # Import lazily so `import preprocess_golden` from app.py doesn't
    # trigger model loading as a side-effect.
    import pandas as pd
    from embedding_utils import get_moderation_results

    print("Initializing model for embedding generation...")
    df = pd.read_csv(str(DATA_DIR / "golden.csv"))
    print(f"Loaded {len(df)} rows from CSV.")

    embeddings = []
    labels = []

    total = len(df)
    for i, (_, row) in enumerate(df.iterrows()):
        if i % 10 == 0:
            print(f"Processing row {i}/{total}...")
        emb, _ = get_moderation_results(row["text"])
        embeddings.append(emb[0])

        # multi-label vector
        labels.append([
            row["child_safe"],
            row["adult_safe"]
        ])

    embeddings = np.array(embeddings)
    labels = np.array(labels)

    np.save(str(emb_path), embeddings)
    np.save(str(labels_path), labels)

    print("Golden dataset processed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
