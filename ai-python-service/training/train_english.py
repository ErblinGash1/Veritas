
from pathlib import Path
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import (
    TfidfVectorizer,
    ENGLISH_STOP_WORDS,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

# =====================================================
# VERITAS AI - ENGLISH MODEL V3
# Source-marker reduction + diagnostic evaluation
# =====================================================

BASE_DIR = Path(__file__).resolve().parents[1]

DATASET_PATH = BASE_DIR.parent / "WELFake_Dataset.csv"

MODEL_PATH = (
    BASE_DIR / "english_fake_news_pipeline_v3.pkl"
)

RANDOM_STATE = 42

# IMPORTANT:
# Confirmed for the user's local WELFake CSV:
# 0 = REAL, 1 = FAKE
REAL_LABEL = 0
FAKE_LABEL = 1

# -----------------------------------------------------
# SOURCE MARKER REDUCTION
# -----------------------------------------------------
# These terms are excluded from TF-IDF vocabulary.
# This reduces reliance on selected publisher markers.
#
# Unlike a custom Python preprocessor, the resulting
# pipeline can be loaded directly by FastAPI.

SOURCE_MARKERS = {
    "reuters",
    "getty",
    "featured",
    "ap",
    "afp",
    "bloomberg",
}

CUSTOM_STOP_WORDS = sorted(
    set(ENGLISH_STOP_WORDS).union(SOURCE_MARKERS)
)


def classify_probability(fake_probability):
    """
    Return the three-way classification used
    in the Veritas demonstration.
    """
    if fake_probability < 0.40:
        return "REAL"

    if fake_probability <= 0.60:
        return "UNCERTAIN"

    return "FAKE"


def get_fake_probability(model, text):
    """
    Read the FAKE probability using class label 1.
    """
    classes = list(model.classes_)

    if REAL_LABEL not in classes:
        raise ValueError("REAL class is missing.")

    if FAKE_LABEL not in classes:
        raise ValueError("FAKE class is missing.")

    probabilities = model.predict_proba([text])[0]

    return float(
        probabilities[classes.index(FAKE_LABEL)]
    )


def evaluate_by_length(model, X_test, y_test):
    """
    Evaluate classification accuracy based on
    the length of the article.
    """
    print("\n" + "=" * 55)
    print("ACCURACY BY TEXT LENGTH")
    print("=" * 55)

    predictions = model.predict(X_test)

    lengths = X_test.str.split().str.len()

    groups = [
        ("Under 50 words", lengths < 50),
        (
            "50-99 words",
            (lengths >= 50) & (lengths < 100),
        ),
        (
            "100-299 words",
            (lengths >= 100) & (lengths < 300),
        ),
        ("300+ words", lengths >= 300),
    ]

    for name, mask in groups:
        count = int(mask.sum())

        if count == 0:
            print(f"{name}: No articles")
            continue

        group_accuracy = accuracy_score(
            y_test[mask],
            predictions[mask.to_numpy()],
        )

        print(
            f"{name}: {count} articles | "
            f"Accuracy: {group_accuracy:.2%}"
        )


def evaluate_uncertainty(model, X_test, y_test):
    """
    Measure the number of confident predictions,
    incorrect confident predictions and abstentions.
    """
    probabilities = model.predict_proba(X_test)

    classes = list(model.classes_)
    fake_index = classes.index(FAKE_LABEL)

    fake_probabilities = probabilities[:, fake_index]

    decisions = [
        classify_probability(float(probability))
        for probability in fake_probabilities
    ]

    expected = [
        "FAKE" if label == FAKE_LABEL else "REAL"
        for label in y_test
    ]

    uncertain = sum(
        decision == "UNCERTAIN"
        for decision in decisions
    )

    confident_correct = sum(
        decision == truth
        for decision, truth in zip(decisions, expected)
    )

    confident_incorrect = sum(
        decision != "UNCERTAIN"
        and decision != truth
        for decision, truth in zip(decisions, expected)
    )

    total = len(decisions)
    decided = total - uncertain

    print("\n" + "=" * 55)
    print("THREE-WAY DECISION EVALUATION")
    print("=" * 55)

    print("Total:", total)
    print("Correct confident:", confident_correct)
    print("Incorrect confident:", confident_incorrect)
    print("Uncertain:", uncertain)

    print(
        "Coverage:",
        f"{decided / total:.2%}"
        if total else "N/A"
    )

    print(
        "Accuracy among confident decisions:",
        f"{confident_correct / decided:.2%}"
        if decided else "N/A"
    )


def test_source_bias(model):
    """
    Compare the same factual claims with and
    without a source marker.
    """
    print("\n" + "=" * 55)
    print("SOURCE BIAS DIAGNOSTIC TEST")
    print("=" * 55)

    samples = [
        (
            "Neutral real",
            "NASA launched the James Webb Space "
            "Telescope on December 25, 2021, "
            "from French Guiana.",
        ),
        (
            "Real with Reuters",
            "Reuters - NASA launched the James "
            "Webb Space Telescope on December 25, "
            "2021, from French Guiana.",
        ),
        (
            "Neutral fabricated",
            "NASA announced that the Moon will "
            "disappear forever tomorrow and "
            "never return.",
        ),
        (
            "Fabricated with Reuters",
            "Reuters - NASA announced that the "
            "Moon will disappear forever "
            "tomorrow and never return.",
        ),
    ]

    for name, text in samples:
        fake_probability = get_fake_probability(
            model, text
        )

        prediction = classify_probability(
            fake_probability
        )

        print(
            f"{name:26} | "
            f"FAKE: {fake_probability * 100:6.2f}% | "
            f"{prediction}"
        )


def test_known_examples(model):
    """
    Four diagnostic examples previously used
    to test V1 and V2.
    """
    print("\n" + "=" * 55)
    print("KNOWN EXAMPLE DIAGNOSTICS")
    print("=" * 55)

    samples = [
        (
            "REAL - NASA",
            "REAL",
            "NASA launched the James Webb Space "
            "Telescope on December 25, 2021, "
            "aboard an Ariane 5 rocket from "
            "French Guiana. The mission studies "
            "distant galaxies and the early universe.",
        ),
        (
            "REAL - CERN",
            "REAL",
            "Scientists at CERN announced the "
            "discovery of a particle consistent "
            "with the Higgs boson in July 2012. "
            "The discovery was made using "
            "experiments conducted at the "
            "Large Hadron Collider.",
        ),
        (
            "FAKE - Immortality",
            "FAKE",
            "Scientists have discovered a secret "
            "pill that makes humans immortal. "
            "The miracle treatment guarantees "
            "that nobody who takes it will ever die.",
        ),
        (
            "FAKE - Moon",
            "FAKE",
            "NASA confirmed that the Moon will "
            "completely disappear from the sky "
            "tomorrow and will never return. "
            "Scientists are hiding the truth "
            "from the public.",
        ),
    ]

    for name, expected, text in samples:
        fake_probability = get_fake_probability(
            model, text
        )

        prediction = classify_probability(
            fake_probability
        )

        if prediction == "UNCERTAIN":
            result = "UNCERTAIN"
        elif prediction == expected:
            result = "CORRECT"
        else:
            result = "INCORRECT"

        print(f"\n{name}")
        print("Expected:", expected)
        print("Prediction:", prediction)
        print(
            f"FAKE probability: "
            f"{fake_probability * 100:.2f}%"
        )
        print("Result:", result)


def main():
    print("=" * 55)
    print("VERITAS AI - ENGLISH MODEL V3")
    print("=" * 55)

    if not DATASET_PATH.is_file():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    # Avoid silently overwriting an existing V3 model.
    if MODEL_PATH.exists():
        raise FileExistsError(
            f"V3 already exists: {MODEL_PATH}\n"
            "Keep the existing model or explicitly "
            "archive it before retraining."
        )

    print("\nLoading dataset...")

    df = pd.read_csv(
        DATASET_PATH,
        usecols=["title", "text", "label"],
    )

    # -------------------------------------------------
    # DATA CLEANING
    # -------------------------------------------------

    df["title"] = (
        df["title"].fillna("").astype(str)
    )

    df["text"] = (
        df["text"].fillna("").astype(str)
    )

    df["content"] = (
        df["title"] + " " + df["text"]
    ).str.replace(
        r"\s+", " ", regex=True
    ).str.strip()

    df = df[df["content"] != ""].copy()

    df["label"] = pd.to_numeric(
        df["label"], errors="raise"
    ).astype(int)

    if not set(df["label"].unique()).issubset({0, 1}):
        raise ValueError(
            "Unexpected dataset labels. Expected 0 and 1."
        )

    # Normalize BEFORE train/test split.
    df["normalized"] = (
        df["content"].str.casefold()
    )

    conflicts = (
        df.groupby("normalized")["label"]
        .transform("nunique") > 1
    )

    print(
        "Conflicting rows removed:",
        int(conflicts.sum())
    )

    df = df[~conflicts].copy()

    df = df.drop_duplicates(
        subset=["normalized"]
    ).copy()

    print("Articles after cleaning:", len(df))
    print(
        "Label distribution:",
        df["label"].value_counts().to_dict()
    )

    # -------------------------------------------------
    # DATA SPLIT
    # -------------------------------------------------

    X = df["content"]
    y = df["label"]

    X_train, X_test, y_train, y_test = (
        train_test_split(
            X,
            y,
            test_size=0.20,
            random_state=RANDOM_STATE,
            stratify=y,
        )
    )

    print("\nTraining articles:", len(X_train))
    print("Testing articles:", len(X_test))

    # -------------------------------------------------
    # ML PIPELINE
    # -------------------------------------------------

    pipeline = Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                lowercase=True,
                stop_words=CUSTOM_STOP_WORDS,
                ngram_range=(1, 2),
                min_df=3,
                max_df=0.95,
                max_features=50000,
                sublinear_tf=True,
            ),
        ),
        (
            "classifier",
            LogisticRegression(
                max_iter=1000,
                random_state=RANDOM_STATE,
            ),
        ),
    ])

    print("\nTraining V3 model...")

    pipeline.fit(X_train, y_train)

    # -------------------------------------------------
    # STANDARD EVALUATION
    # -------------------------------------------------

    predictions = pipeline.predict(X_test)

    print("\n" + "=" * 55)
    print("ENGLISH MODEL V3 - RESULTS")
    print("=" * 55)

    accuracy = accuracy_score(
        y_test, predictions
    )

    print(f"\nAccuracy: {accuracy:.4%}")

    print("\nClassification report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=[REAL_LABEL, FAKE_LABEL],
            target_names=["REAL", "FAKE"],
            zero_division=0,
        )
    )

    print("Confusion matrix:")
    print("Rows: actual REAL, FAKE")
    print("Columns: predicted REAL, FAKE")

    print(
        confusion_matrix(
            y_test,
            predictions,
            labels=[REAL_LABEL, FAKE_LABEL],
        )
    )

    evaluate_by_length(
        pipeline, X_test, y_test
    )

    evaluate_uncertainty(
        pipeline, X_test, y_test
    )

    # -------------------------------------------------
    # DIAGNOSTIC TESTS
    # -------------------------------------------------

    test_source_bias(pipeline)
    test_known_examples(pipeline)

    # -------------------------------------------------
    # SAVE EXPERIMENTAL MODEL
    # -------------------------------------------------

    joblib.dump(
        pipeline,
        MODEL_PATH,
    )

    print("\n" + "=" * 55)
    print("V3 TRAINING FINISHED")
    print("=" * 55)

    print("Model saved to:", MODEL_PATH)
    print(
        "Active production model was not modified."
    )

    print(
        "\nIMPORTANT: In-domain test accuracy does "
        "not establish fact-checking reliability."
    )


if __name__ == "__main__":
    main()
