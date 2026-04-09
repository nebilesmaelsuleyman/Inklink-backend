from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "model"


class Post(BaseModel):
    text: str


def _artifacts_ready() -> tuple[bool, str]:
    if not (MODEL_DIR / "config.json").exists():
        return False, "Model not found at /app/model. Run download_model.py first."
    if not (DATA_DIR / "golden_embeddings.npy").exists() or not (DATA_DIR / "golden_labels.npy").exists():
        return False, "Embeddings not found in /app/data. Run preprocess_golden.py first."
    return True, "ready"


def _load_moderation_assets() -> tuple[Any, Any, np.ndarray, np.ndarray]:
    from embedding_utils import get_embedding, similarity

    golden_embeddings = np.load(DATA_DIR / "golden_embeddings.npy")
    golden_labels = np.load(DATA_DIR / "golden_labels.npy")

    return get_embedding, similarity, golden_embeddings, golden_labels


@app.get("/test")
def test_mock():
    return {"status": "ok"}


@app.get("/ready")
def readiness():
    ready, message = _artifacts_ready()
    return {"ready": ready, "message": message}


@app.post("/moderate")
def moderate(post: Post):
    ready, message = _artifacts_ready()
    if not ready:
        raise HTTPException(status_code=503, detail=message)

    get_embedding, similarity, golden_embeddings, golden_labels = _load_moderation_assets()
    emb = get_embedding(post.text)
    sims = similarity(emb, golden_embeddings)

    best_idx = int(sims.argmax())
    label = golden_labels[best_idx]
    confidence = float(sims[0][best_idx])

    if isinstance(label, np.ndarray):
        label_value = label.tolist()
    elif isinstance(label, np.generic):
        label_value = label.item()
    else:
        label_value = label

    child_safe = (
        bool(label_value[0])
        if isinstance(label_value, (list, tuple)) and len(label_value) >= 1
        else bool(label_value)
    )
    adult_safe = (
        bool(label_value[1])
        if isinstance(label_value, (list, tuple)) and len(label_value) >= 2
        else bool(label_value)
    )

    return {
        "child_safe": child_safe,
        "adult_safe": adult_safe,
        "confidence": confidence,
    }



# from fastapi import FastAPI
# import numpy as np

# from embedding_utils import get_embedding, similarity

# app = FastAPI()

# golden_embeddings = np.load("data/golden_embeddings.npy")
# golden_labels = np.load("data/golden_labels.npy")


# @app.get("/test")
# def test_mock():

#     mock_text = "Once upon a time a small rabbit was playing in the forest."

#     emb = get_embedding(mock_text)

#     sims = similarity(emb, golden_embeddings)

#     best_idx = sims.argmax()

#     label = golden_labels[best_idx]
#     confidence = float(sims[0][best_idx])

#     return {
#         "text": mock_text,
#         "predicted_label": label,
#         "confidence": confidence
#     }