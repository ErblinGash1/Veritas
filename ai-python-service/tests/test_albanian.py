
import joblib
from pathlib import Path

model_path = Path(__file__).resolve().parents[1] / "albanian_fake_news_pipeline.pkl"
model = joblib.load(model_path)

tests = [
    "NASA lëshoi teleskopin hapësinor James Webb më 25 dhjetor 2021.",
    "Shkencëtarët zbuluan një pilulë që i bën njerëzit të pavdekshëm!",
    "Banka Qendrore publikoi raportin vjetor mbi inflacionin.",
    "URGJENTE! Hëna do të zhduket nesër dhe askush nuk po na tregon!"
]

for text in tests:
    prediction = model.predict([text])[0]
    probabilities = model.predict_proba([text])[0]

    label = "FAKE" if prediction == 1 else "REAL"
    confidence = max(probabilities) * 100

    print("\nTeksti:", text)
    print("Parashikimi:", label)
    print(f"Probabiliteti i modelit: {confidence:.2f}%")
    print("-" * 50)
