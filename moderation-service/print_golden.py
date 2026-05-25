import numpy as np
import sys
from pathlib import Path
BASE_DIR = Path("/home/nebil/Desktop/ink-link_backend/moderation-service")
sys.path.insert(0, str(BASE_DIR))
from embedding_utils import get_moderation_results, similarity, ensure_model

ensure_model()
text = "The African-American Community is thriving in America as if nothing ever happened. They even have more rights than us normal white folks living in here, as per the sympathy people show to them. They would be rotting in their hut with no water had we never brought their ancestors to this land. No water, no food, no education; they would be living as primate beings as their African counterparts if not for the slave trade that upgraded their descendants lives. They commit crimes and leave their children for foster care, further creating more black criminals in this country. They breed like rabbits with no regard to their offsprings quality; completely backwards way of thinking. If you look at it really, the majority black states are the ones with the highest crime rate in the US. But we allow these negros to run their mouth and tolerate their unacceptable behavior to make up for the alleged oppression. So yes, I would say US Slavery was good because they were useful for something for once."

emb, probs = get_moderation_results(text)

golden_embeddings = np.load(BASE_DIR / "data" / "golden_embeddings.npy")
golden_labels = np.load(BASE_DIR / "data" / "golden_labels.npy")

sims = similarity(emb, golden_embeddings)
best_idx = int(sims.argmax())
label = golden_labels[best_idx]
print("Best match idx:", best_idx)
print("Label:", label)
print("Sim:", sims[0][best_idx])
import json
with open(BASE_DIR / "data" / "golden_dataset.json") as f:
    data = json.load(f)
print("Golden text:", data[best_idx]["text"])
