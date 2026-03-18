import pandas as pd
import numpy as np
from embedding_utils import get_embedding

df = pd.read_csv("data/golden.csv")

embeddings = []
labels = []

for _, row in df.iterrows():

    emb = get_embedding(row["text"])
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