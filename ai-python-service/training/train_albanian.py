
from pathlib import Path
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Paths
BASE_DIR = Path(__file__).resolve().parents[1]
DATASET = BASE_DIR.parent / "alb-fake-news-corpus.csv"

# 1. Load dataset
df = pd.read_csv(DATASET)

# 2. Keep required columns
df = df[["title", "content", "fake_news"]].copy()
df = df.dropna(subset=["title", "content", "fake_news"])

# 3. Remove exact duplicates
df = df.drop_duplicates(subset=["title", "content"])

# 4. Prepare text
df["text"] = (
    df["title"].astype(str).str.strip()
    + " "
    + df["content"].astype(str).str.strip()
)

df = df[df["text"].str.strip() != ""]

# False = REAL (0), True = FAKE (1)
df["label"] = df["fake_news"].astype(int)

print("Total articles:", len(df))
print("Labels:")
print(df["label"].value_counts())

# 5. Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    df["text"],
    df["label"],
    test_size=0.20,
    random_state=42,
    stratify=df["label"]
)

# 6. TF-IDF + Logistic Regression
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
        max_features=30000,
        sublinear_tf=True
    )),
    ("classifier", LogisticRegression(
        max_iter=1000,
        random_state=42
    ))
])

# 7. Train
print("\nTraining Albanian ML model...")
pipeline.fit(X_train, y_train)

# 8. Evaluate
predictions = pipeline.predict(X_test)

print("\nAccuracy:", round(accuracy_score(y_test, predictions), 4))
print("\nClassification report:")
print(classification_report(
    y_test,
    predictions,
    target_names=["REAL", "FAKE"],
    zero_division=0
))

print("Confusion matrix:")
print(confusion_matrix(y_test, predictions))

# 9. Save model
MODEL_PATH = BASE_DIR / "albanian_fake_news_pipeline.pkl"
joblib.dump(pipeline, MODEL_PATH)

print("\nModel saved to:", MODEL_PATH)
