import torch
import torch.nn.functional as F
from transformers import XLMRobertaTokenizer, XLMRobertaForSequenceClassification
from sklearn.metrics.pairwise import cosine_similarity
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = str(BASE_DIR / "model")

tokenizer = XLMRobertaTokenizer.from_pretrained(MODEL_PATH)
model = XLMRobertaForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()


def get_moderation_results(text):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)

        # 1. Hidden state (embedding) for the similarity check
        # The base model is accessible via model.roberta
        base_outputs = model.roberta(
            inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )
        embedding = base_outputs.last_hidden_state[:, 0, :].detach().numpy()

        # 2. Classification probabilities
        probs = F.softmax(outputs.logits, dim=-1).detach().numpy()[0]

    return embedding, probs


def similarity(vec, matrix):
    sims = cosine_similarity(vec, matrix)
    return sims
