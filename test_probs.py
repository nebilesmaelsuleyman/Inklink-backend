import sys
from pathlib import Path
BASE_DIR = Path("/home/nebil/Desktop/ink-link_backend/moderation-service")
sys.path.insert(0, str(BASE_DIR))
from embedding_utils import get_moderation_results, ensure_model

ensure_model()

texts = {
    "toxic_en": "this is bad story that black people have done to witte good american , all black people are recist and dont like white people they even kill the race other than black",
    "safe_en": "Every autumn, the people of Merrow Hill celebrated the Festival of Lights. Families decorated their lanterns with symbols representing hope, kindness, memory, and wisdom.",
    "toxic_am": "አስቡት? የአፍሪካ-አሜሪካውያን ማህበረሰብ በአሜሪካ ምንም እንዳልተፈጠረ በደንብ እየኖረ ነው። ሰዎች የሚያሳዩላቸው ርህራሄ ምክንያት ከእኛ ከተለመዱት ነጭ ሰዎች የበለጠ መብት እንኳ አላቸው።"
}

for name, text in texts.items():
    _, probs = get_moderation_results(text)
    print(f"{name}: probs[0]={probs[0]:.4f}, probs[1]={probs[1]:.4f}")
