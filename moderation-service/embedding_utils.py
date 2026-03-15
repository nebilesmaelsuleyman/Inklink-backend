import torch
import numpy as np
from transformers import XLMRobertaTokenizer, XLMRobertaModel
from sklearn.metrics.pairwise import cosine_similarity

MODEL_PATH = "./model"

tokenizer = XLMRobertaTokenizer.from_pretrained(MODEL_PATH)
model = XLMRobertaModel.from_pretrained(MODEL_PATH)

model.eval()


def get_embedding(text):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)

    embedding = outputs.last_hidden_state[:, 0, :]

    return embedding.numpy()


def similarity(vec, matrix):

    sims = cosine_similarity(vec, matrix)

    return sims