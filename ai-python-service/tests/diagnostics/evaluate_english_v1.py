"""Offline diagnostics for frozen WELFake V1; no training, network or file writes."""
import sys

sys.dont_write_bytecode = True

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import brier_score_loss, f1_score, roc_auc_score

MODEL_SHA256 = "adebf54a41f4219d7c5f05ece9d933d93f13f5a05f1c005a31b5dfb6b61d4c0a"
DATASET_SHA256 = "665331424230fc452e9482c3547a6a199a2c29745ade8d236950d1d105223773"


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def default_repo():
    return Path(__file__).resolve().parents[3]


def load_v1(repo):
    path = repo / "ai-python-service" / "english_fake_news_pipeline_v1.pkl"
    if file_sha256(path) != MODEL_SHA256:
        raise ValueError("Model hash differs from audited V1; refusing version substitution.")
    model = joblib.load(path)
    if list(model.classes_) != [0, 1]:
        raise ValueError("Expected classes [0, 1]; label 1 is the local FAKE category.")
    return model, path


def ratio(numerator, denominator):
    return float(numerator / denominator) if denominator else None


def decision(probability):
    return "REAL" if probability < .4 else "FAKE" if probability > .6 else "UNCERTAIN"


def metrics(labels, probabilities):
    """FAKE is positive. Abstention denominators are explicit in output and docs."""
    y = np.asarray(labels, dtype=int)
    p = np.asarray(probabilities, dtype=float)
    if y.shape != p.shape or not np.isin(y, [0, 1]).all():
        raise ValueError("Expected equal-length binary labels and probabilities.")
    if not np.isfinite(p).all() or ((p < 0) | (p > 1)).any():
        raise ValueError("Invalid probability.")
    real, fake = int((y == 0).sum()), int((y == 1).sum())

    def summarize(pred):
        matrix = [[int(((y == a) & (pred == b)).sum()) for b in (0, 1, 2)]
                  for a in (0, 1)]
        tn, fp, ur = matrix[0]
        fn, tp, uf = matrix[1]
        decided = tn + fp + fn + tp
        return {
            "confusion_rows_REAL_FAKE_columns_REAL_FAKE_UNCERTAIN": matrix,
            "false_positive_rate_all_real": ratio(fp, real),
            "false_negative_rate_all_fake": ratio(fn, fake),
            "false_positive_rate_decided_real": ratio(fp, tn + fp),
            "false_negative_rate_decided_fake": ratio(fn, tp + fn),
            "fake_precision": ratio(tp, tp + fp),
            "fake_recall_all_fake": ratio(tp, fake),
            "fake_miss_or_abstain_rate": ratio(fn + uf, fake),
            "uncertain_count": ur + uf,
            "uncertain_by_actual_label": {"REAL": ur, "FAKE": uf},
            "coverage": ratio(decided, len(y)),
            "accuracy_among_decided": ratio(tn + tp, decided),
        }

    binary_pred = (p > .5).astype(int)
    binary = summarize(binary_pred)
    binary["accuracy"] = ratio(int((binary_pred == y).sum()), len(y))
    binary["macro_f1"] = float(f1_score(y, binary_pred, labels=[0, 1],
                                      average="macro", zero_division=0)) if len(y) else None
    return {
        "n": len(y), "actual_counts": {"REAL": real, "FAKE": fake},
        "binary_at_0_5": binary,
        "production_0_4_0_6": summarize(np.where(p < .4, 0, np.where(p > .6, 1, 2))),
        "roc_auc": float(roc_auc_score(y, p)) if real and fake else None,
        "brier_score": float(brier_score_loss(y, p)) if len(y) else None,
    }


def evaluate_cases(model, cases):
    rows = []
    for case in cases:
        text = case["text"]
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        if digest != case["sha256"]:
            raise ValueError("Case text hash mismatch: " + case["id"])
        variants = {"original": text, "reuters_prefix": "Reuters - " + text,
                    "washington_reuters_prefix": "WASHINGTON (Reuters) - " + text,
                    "getty_suffix": text + " Featured image: Getty Images."}
        probabilities = model.predict_proba(list(variants.values()))[:, 1]
        scores = dict(zip(variants, map(float, probabilities)))
        row = {"id": case["id"], "label": case["label"], "kind": case["kind"],
               "sha256": digest, "words": len(text.split()),
               "p_fake": scores["original"], "prediction": decision(scores["original"]),
               "source_marker_p_fake": scores}
        if "observed" in case:
            row["matches_observed_2dp"] = round(scores["original"] * 100, 2) == case["observed"]
        rows.append(row)
    labels = [r["label"] for r in rows]
    sensitivity = {}
    for name in ("reuters_prefix", "washington_reuters_prefix", "getty_suffix"):
        scores = [r["source_marker_p_fake"][name] for r in rows]
        sensitivity[name] = {
            "mean_delta_fake_percentage_points": float(np.mean([
                100 * (p - r["p_fake"]) for p, r in zip(scores, rows)])) if rows else None,
            "decision_changes": sum(decision(p) != r["prediction"] for p, r in zip(scores, rows)),
            "metrics": metrics(labels, scores),
        }
    return {"cases": rows, "metrics": metrics(labels, [r["p_fake"] for r in rows]),
            "source_marker_sensitivity": sensitivity}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=default_repo())
    args = parser.parse_args()
    corpus = json.loads(Path(__file__).with_name("english_v1_cases.json").read_text(encoding="utf-8"))
    model, model_path = load_v1(args.repo.resolve())
    try:
        exact = evaluate_cases(model, corpus["exact_cases"])
        controlled = []
        for pair in corpus["controlled_pairs"]:
            for kind, label in (("real", 0), ("fake", 1)):
                controlled.append({"id": pair["id"] + "_" + kind, "label": label,
                                   "kind": pair[kind + "_kind"], "text": pair[kind],
                                   "sha256": pair[kind + "_sha256"]})
        pairs = evaluate_cases(model, controlled)
        rows = pairs["cases"]
        pairs["synthetic_score_above_factual_partner"] = sum(
            rows[i + 1]["p_fake"] > rows[i]["p_fake"] for i in range(0, len(rows), 2))
        pairs["pair_count"] = len(rows) // 2
        result = {
            "model_sha256": MODEL_SHA256,
            "label_definition": corpus["label_mapping"],
            "warning": "Purposive, correlated diagnostics; NOT representative accuracy. "
                       "Source-marker additions are stress tests, not truthful attributions or fixes.",
            "exact_user_cases": exact, "controlled_summary_pairs": pairs,
            "pending_cases": corpus["pending"],
            "reference_only_published_excerpts_not_executed": [
                r["id"] for r in corpus["reference_only_published_excerpts"]],
            "holdout": "Separate dataset-label evaluation: run audit_welfake_holdout.py offline.",
        }
    finally:
        if file_sha256(model_path) != MODEL_SHA256:
            raise RuntimeError("Protected V1 hash changed during evaluation.")
    print(json.dumps(result, indent=2, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    main()
