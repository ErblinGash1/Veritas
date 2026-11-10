"""Reconstruct the WELFake holdout offline using frozen V1. Never fits an estimator."""

import sys
sys.dont_write_bytecode = True

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from evaluate_english_v1 import DATASET_SHA256, MODEL_SHA256, default_repo, file_sha256, load_v1, metrics


def progress(message):
    print(message, file=sys.stderr, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=default_repo())
    args = parser.parse_args()
    repo = args.repo.resolve()
    data_path = repo / "WELFake_Dataset.csv"
    progress("Checking frozen model and dataset checksums...")
    model, model_path = load_v1(repo)
    if file_sha256(data_path) != DATASET_SHA256:
        raise ValueError("Dataset differs from audited WELFake; refusing silent split changes.")
    try:
        progress("Preparing title/body text and reconstructing the seeded holdout...")
        df = pd.read_csv(data_path, usecols=["title", "text", "label"])
        raw_count = len(df)
        for field in ("title", "text"):
            df[field] = df[field].fillna("").astype(str)
        df["content"] = (df.title + " " + df.text).str.replace(r"\s+", " ", regex=True).str.strip()
        empty_count = int(df.content.eq("").sum())
        df = df[df.content.ne("")].copy()
        df["normalized"] = df.content.str.casefold()
        conflicts = df.groupby("normalized").label.transform("nunique") > 1
        conflict_count = int(conflicts.sum())
        df = df[~conflicts].copy()
        duplicate_count = int(df.duplicated("normalized").sum())
        df = df.drop_duplicates("normalized").copy()
        train, test = train_test_split(df, test_size=.20, random_state=42, stratify=df.label)
        split_hash = hashlib.sha256(",".join(map(str, test.index)).encode()).hexdigest()
        if split_hash != "76b448ef21b6dd9f8df00a432e0abc79f7cf47737bf49ebb274e01761e3d7e47":
            raise ValueError("Reconstructed split differs from the audited split.")
        progress(f"Scoring {len(test)} held-out rows with the existing model...")
        probabilities = np.concatenate([model.predict_proba(test.content.iloc[i:i + 500])[:, 1]
                                        for i in range(0, len(test), 500)])
        y = test.label.to_numpy()
        result = {
            "evaluation_type": "Reconstructed in-corpus holdout, not independently fact-verified labels",
            "warning": "Random split shares source/style patterns and some article bodies. "
                       "Do not combine these counts with the selected factual/synthetic diagnostic cases.",
            "model_sha256": MODEL_SHA256, "dataset_sha256": DATASET_SHA256,
            "split_index_sha256": split_hash, "random_state": 42, "test_size": .20,
            "raw_rows": raw_count, "empty_rows_removed": empty_count,
            "conflicting_rows_removed": conflict_count, "duplicates_removed": duplicate_count,
            "clean_rows": len(df), "train_rows": len(train), "holdout_rows": len(test),
            "clean_label_counts": {str(k): int(v) for k, v in df.label.value_counts().items()},
            "metrics": metrics(y, probabilities),
        }
        progress("Auditing length, source-marker overlap and duplicate bodies...")
        lengths = test.content.map(lambda text: len(text.split())).to_numpy()
        groups = {"under_50": lengths < 50, "50_to_99": (lengths >= 50) & (lengths < 100),
                  "100_to_299": (lengths >= 100) & (lengths < 300), "300_plus": lengths >= 300}
        result["length_groups"] = {name: metrics(y[mask], probabilities[mask])
                                   for name, mask in groups.items()}
        source_groups = {}
        for marker, pattern in (("reuters", r"\breuters\b"), ("breitbart", r"\bbreitbart\b"),
                                ("featured_image", r"\bfeatured image\b"), ("getty", r"\bgetty\b")):
            mask = df.content.str.contains(pattern, case=False, regex=True)
            test_mask = mask.loc[test.index].to_numpy()
            source_groups[marker] = {
                "clean_label_counts": {str(k): int(v) for k, v in df.loc[mask, "label"].value_counts().items()},
                "train_count": int(mask.loc[train.index].sum()), "test_count": int(test_mask.sum()),
                "metrics": metrics(y[test_mask], probabilities[test_mask]),
            }
            if marker == "reuters":
                source_groups["without_reuters"] = {"metrics": metrics(y[~test_mask], probabilities[~test_mask])}
        result["source_marker_groups_not_verified_publishers"] = source_groups
        overlaps = {}
        for field in ("content", "text", "title"):
            normalized = df[field].str.casefold().str.replace(r"\s+", " ", regex=True).str.strip()
            train_keys, test_keys = normalized.loc[train.index], normalized.loc[test.index]
            overlaps[field] = int((test_keys.ne("") & test_keys.isin(set(train_keys[train_keys.ne("")]))).sum())
        canonical = df.text.str.casefold().str.replace(r"[^\w]+", "", regex=True)
        train_keys, test_keys = canonical.loc[train.index], canonical.loc[test.index]
        overlaps["body_without_punctuation_spacing"] = int(
            (test_keys.ne("") & test_keys.isin(set(train_keys[train_keys.ne("")]))).sum())
        result["holdout_rows_with_training_match"] = overlaps
        vectorizer = model.steps[0][1]
        frequencies = np.zeros(len(vectorizer.vocabulary_), dtype=np.int64)
        for start in range(0, len(train), 500):
            matrix = vectorizer.transform(train.content.iloc[start:start + 500])
            frequencies += np.asarray((matrix != 0).sum(axis=0)).ravel()
            if start % 10000 == 0:
                progress(f"Checking stored IDF against frozen training features: {start}/{len(train)}")
        reconstructed_idf = np.log((1 + len(train)) / (1 + frequencies)) + 1
        errors = np.abs(reconstructed_idf - vectorizer.idf_)
        result["idf_reconstruction"] = {
            "max_absolute_error": float(errors.max()),
            "matching_features_at_1e_minus_12": int((errors < 1e-12).sum()),
            "total_features": len(errors), "minimum_training_document_frequency": int(frequencies.min()),
        }
        bins = []
        for lower, upper in zip(np.linspace(0, 1, 11)[:-1], np.linspace(0, 1, 11)[1:]):
            mask = (probabilities >= lower) & (probabilities < upper if upper < 1 else probabilities <= upper)
            bins.append({"lower": float(lower), "upper": float(upper), "n": int(mask.sum()),
                         "mean_probability": float(probabilities[mask].mean()) if mask.any() else None,
                         "fraction_label_1": float(y[mask].mean()) if mask.any() else None})
        result["calibration_bins_no_calibrator_fitted"] = bins
    finally:
        if file_sha256(model_path) != MODEL_SHA256 or file_sha256(data_path) != DATASET_SHA256:
            raise RuntimeError("Protected model or dataset checksum changed during audit.")
    print(json.dumps(result, indent=2, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    main()
