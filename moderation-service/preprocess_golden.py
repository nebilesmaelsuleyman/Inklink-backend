import pandas as pd
import numpy as np
from embedding_utils import get_moderation_results
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"

emb_path = DATA_DIR / "golden_embeddings.npy"
labels_path = DATA_DIR / "golden_labels.npy"

def main() -> int:
    if emb_path.exists() and labels_path.exists():
        print("Embeddings already exist; skipping preprocessing.")
        return 0

    print("Initializing model for embedding generation...")
    df = pd.read_csv("data/golden.csv")
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

    np.save("data/golden_embeddings.npy", embeddings)
    np.save("data/golden_labels.npy", labels)

    print("Golden dataset processed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
