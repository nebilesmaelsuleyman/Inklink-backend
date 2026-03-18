# from fastapi import FastAPI
# from pydantic import BaseModel
# import numpy as np

# from embedding_utils import get_embedding, similarity

# app = FastAPI()
# golden_embeddings = np.load("data/golden_embeddings.npy")
# golden_labels = np.load("data/golden_labels.npy")

# class Post(BaseModel):
#     text: str

# @app.post("/moderate")
# def moderate(post: Post):
#     emb = get_embedding(post.text)
#     sims = similarity(emb, golden_embeddings)
#     idx = sims.argmax()
#     label = golden_labels[idx]
#     confidence=float(sims[0][idx])
#     return {"child_safe": bool(label[0]), "adult_safe": bool(label[1])}



from fastapi import FastAPI
import numpy as np

from embedding_utils import get_embedding, similarity

from pathlib import Path

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
golden_embeddings = np.load(BASE_DIR / "data" / "golden_embeddings.npy")
golden_labels = np.load(BASE_DIR / "data" / "golden_labels.npy")


@app.get("/test")
def test_mock():

    mock_text = "በአንድ ወቅት በአንዲት ትንሽ መንደር ውስጥ የሚኖሩ ሰዎች በሰላም አብረው ይኖሩ ነበር። ነገር ግን አንድ ቀን በድንገት በመካከላቸው የጥላቻ ዘር የሚዘራ እንግዳ ሰው መጣ። ይህ ሰው በሰፈሩ ውስጥ የሚገኙ ወጣቶችን በመሰብሰብ እርስ በርስ እንዲጣሉ መርዝ ይረጭባቸው ጀመር። አንዱን ብሔር ከሌላው፣ አንዱን ሃይማኖት ከሌላው ጋር ለማጋጨት የማይነካው ድንጋይ አልነበረም። መንደሩም በጭንቀት ተሞላች፤ የነበረው ፍቅርም ወደ መከፋፈል እና ወደ ዛቻ ተቀየረ"

    emb = get_embedding(mock_text)

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
        "text": mock_text,
        "child_safe": child_safe,
        "adult_safe": adult_safe,
        "confidence": confidence
    }
