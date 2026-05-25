#!/usr/bin/env python3
"""Diagnose why racist/pro-slavery Amharic text is being approved."""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
VENV_SP = BASE_DIR / "venv" / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if VENV_SP.exists() and str(VENV_SP) not in sys.path:
    sys.path.insert(0, str(VENV_SP))

import numpy as np
from embedding_utils import get_moderation_results, similarity, ensure_model
from sklearn.metrics.pairwise import cosine_similarity

DATA_DIR = BASE_DIR / "data"
golden_embeddings = np.load(DATA_DIR / "golden_embeddings.npy")
golden_labels = np.load(DATA_DIR / "golden_labels.npy")

print("Loading model...")
ensure_model()
print("Model loaded.\n")

TEXTS = {
    "pro_slavery_racist": (
        "አስቡት? የአፍሪካ-አሜሪካውያን ማህበረሰብ በአሜሪካ ምንም እንዳልተፈጠረ በደንብ እየኖረ ነው። "
        "ሰዎች የሚያሳዩላቸው ርህራሄ ምክንያት ከእኛ ከተለመዱት ነጭ ሰዎች የበለጠ መብት እንኳ አላቸው። "
        "አባቶቻቸውን ወደዚህ ምድር ባላመጣናቸው ኖሮ ውሃ በሌለባቸው ጎጆዎች ውስጥ እየበሰበሱ በቀሩ ነበር። "
        "ውሃ የለም፣ ምግብ የለም፣ ትምህርት የለም፤ የባርነት ንግድ የዘሮቻቸውን ሕይወት ባላሻሻለ ኖሮ "
        "እንደ ዱር ፍጥረታት እንደ ሌሎች አፍሪካውያን በኋላቀር ሕይወት ይኖሩ ነበር። "
        "ወንጀል ይፈጽማሉ፣ ልጆቻቸውንም በአሳዳጊ ቤቶች ውስጥ ትተው ይሄዳሉ። "
        "ስለ ልጆቻቸው የወደፊት ጥራት ሳያስቡ እንደ ጥንቸል ይወልዳሉ። "
        "ስለዚህ አዎ፣ የአሜሪካ ባርነት ጥሩ ነበር እላለሁ።"
    ),
    "gang_violence": (
        "በሁለቱ ሰፈሮች መካከል ከፍተኛ ጠብ ተነሳ። ሰዎቹ በዱላና በካራ ቢላዋ እርስ በርስ መደባደብ ጀመሩ። "
        "አንደኛው ሰውን በካራ ደረቱን ወግቶት ደሙ በከፍተኛ ሁኔታ ይፈስ ነበር። "
        "መሬት ላይ ወድቆ እየለመነ እያለ ጨካኞቹ በዱላ ራሱን እየመቱት ህይወቱ እስኪያልፍ ድረስ "
        "በጭካኔ ደበደቡት። ሰፈሩ በደም ተጨማለቀ።"
    ),
    "safe_story_benchmark": (
        "አቶ በቀለ ወደ ቢሮው እንደገባ ፋይሉን በጠረጴዛው ላይ ወርውሮ በንቀት ተመለከተኝ። "
        "'እስከዛሬ ካየኋቸው ሰራተኞች አንተ የመጨረሻው ደንቆሮ ነህ' ሲል ተሳደበ።"
    ),
}

THRESHOLD_SAFE = 0.6  # must match app.py

for name, text in TEXTS.items():
    print(f"{'='*60}")
    print(f"TEXT: {name}")
    print(f"{'='*60}")
    emb, probs = get_moderation_results(text)
    safe_score = float(probs[0])
    toxic_score = float(probs[1])

    sims = cosine_similarity(emb, golden_embeddings)
    best_idx = int(sims.argmax())
    label = golden_labels[best_idx]
    vector_confidence = float(sims[0][best_idx])
    label_value = label.tolist() if hasattr(label, 'tolist') else label
    child_safe_by_vector = bool(label_value[0]) if isinstance(label_value, list) else bool(label_value)
    adult_safe_by_vector = bool(label_value[1]) if isinstance(label_value, list) else bool(label_value)

    print(f"  Classifier probs  → safe={safe_score:.4f}  toxic={toxic_score:.4f}")
    print(f"  Vector confidence → {vector_confidence:.4f}")
    print(f"  Vector label      → child_safe={child_safe_by_vector}  adult_safe={adult_safe_by_vector}")

    # Replicate app.py decision
    classifier_highly_toxic = toxic_score > 0.85
    if safe_score >= THRESHOLD_SAFE:
        decision = "APPROVED (classifier_safe)"
        if vector_confidence > 0.75 and not child_safe_by_vector and adult_safe_by_vector:
            decision = "NEEDS_REVIEW (vector_adult_content)"
    elif safe_score <= 0.6:
        vector_says_adult_only = (vector_confidence > 0.82 and not child_safe_by_vector and adult_safe_by_vector)
        if not classifier_highly_toxic and vector_says_adult_only:
            decision = "NEEDS_REVIEW (vector_adult_override)"
        else:
            decision = "REJECTED (classifier_toxic)"
    else:
        decision = "UNCERTAIN → admin review"

    print(f"  ➜  DECISION: {decision}")
    print()
