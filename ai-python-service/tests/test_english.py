
from pathlib import Path
import argparse
import joblib

BASE_DIR = Path(__file__).resolve().parents[1]

MODELS = {
    "active": "english_fake_news_pipeline.pkl",
    "v1": "english_fake_news_pipeline_v1.pkl",
}

# WELFake në dataset-in lokal:
# 0 = REAL, 1 = FAKE

SAMPLES = [
    (
        "REAL - NASA",
        0,
        "NASA launched the James Webb Space Telescope on "
        "December 25, 2021, aboard an Ariane 5 rocket from "
        "French Guiana. The mission studies distant galaxies "
        "and the early universe."
    ),
    (
        "REAL - CERN",
        0,
        "Scientists at CERN announced the discovery of a "
        "particle consistent with the Higgs boson in July 2012. "
        "The discovery was made using experiments conducted "
        "at the Large Hadron Collider."
    ),
    (
        "FAKE - Immortality",
        1,
        "Scientists have discovered a secret pill that makes "
        "humans immortal. The miracle treatment guarantees "
        "that nobody who takes it will ever die."
    ),
    (
        "FAKE - Moon",
        1,
        "NASA confirmed that the Moon will completely "
        "disappear from the sky tomorrow and will never "
        "return. Scientists are hiding the truth from "
        "the public."
    )
]


def classify(fake_probability):
    if fake_probability < 0.40:
        return "REAL"
    if fake_probability <= 0.60:
        return "UNCERTAIN"
    return "FAKE"


def run_tests(model_name):
    model_path = BASE_DIR / MODELS[model_name]

    if not model_path.is_file():
        print(f"\nERROR: Model not found: {model_path}")
        print("Train or save the model before testing it.")
        raise SystemExit(1)

    model = joblib.load(model_path)
    classes = list(model.classes_)

    if 0 not in classes or 1 not in classes:
        raise ValueError(
            "Expected model classes: 0=REAL, 1=FAKE."
        )

    print("\n" + "=" * 50)
    print("VERITAS - ENGLISH MODEL TEST")
    print("Model:", model_name.upper())
    print("File:", model_path.name)
    print("=" * 50)

    correct = 0
    incorrect = 0
    uncertain = 0

    for name, expected, text in SAMPLES:
        probabilities = model.predict_proba([text])[0]

        real_probability = float(
            probabilities[classes.index(0)]
        )
        fake_probability = float(
            probabilities[classes.index(1)]
        )

        prediction = classify(fake_probability)
        expected_label = "FAKE" if expected == 1 else "REAL"

        if prediction == "UNCERTAIN":
            uncertain += 1
            result = "UNCERTAIN"
        elif prediction == expected_label:
            correct += 1
            result = "CORRECT"
        else:
            incorrect += 1
            result = "INCORRECT"

        print("\n" + "-" * 50)
        print("TEST:", name)
        print("EXPECTED:", expected_label)
        print("PREDICTED:", prediction)
        print(f"REAL: {real_probability * 100:.2f}%")
        print(f"FAKE: {fake_probability * 100:.2f}%")
        print("RESULT:", result)

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("Total:", len(SAMPLES))
    print("Correct:", correct)
    print("Incorrect:", incorrect)
    print("Uncertain:", uncertain)
    print("=" * 50)

    print(
        "\nNote: These four examples are diagnostic only. "
        "They are not a representative performance evaluation."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Test a Veritas English ML model."
    )
    parser.add_argument(
        "--model",
        choices=list(MODELS.keys()),
        default="active",
        help="Choose which saved model to test."
    )

    args = parser.parse_args()
    run_tests(args.model)
