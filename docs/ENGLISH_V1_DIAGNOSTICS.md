# Offline English WELFake V1 diagnostics

This harness evaluates the existing model without training, calibration, downloads,
network calls, application startup, database access, or file writes. It does not
import training scripts or production endpoints. It writes JSON to stdout and
holdout progress to stderr. It disables Python bytecode creation before importing
dependencies. No model artifacts are generated.

## Run offline

From the repository root, using the already installed Python 3.15 environment:

```powershell
py -3.15 -B -X utf8 ai-python-service/tests/diagnostics/evaluate_english_v1.py
py -3.15 -B -X utf8 ai-python-service/tests/diagnostics/audit_welfake_holdout.py
```

The scripts locate the repository relative to their own files, so invocation by
absolute path also works from another working directory. An optional `--repo PATH`
selects an existing checkout with the same audited artifacts. No installation is
performed or required if the project's working environment is used. Required
installed libraries: joblib, NumPy, scikit-learn; the holdout audit also uses pandas.

The diagnostic run is small. The holdout audit reads the existing approximately
245 MB CSV and can take several minutes. It transforms text in batches and never
fits an estimator. It reconstructs document frequencies to check the saved IDF.
Do not run or import `training/train_albanian.py` as a check: it trains at import time.

Both commands return nonzero on invalid/missing artifacts or checksum mismatches.
A successful process exit means evaluation completed, **not that predictions are
correct**. The current model's known false positives remain visible in the output.
There is no download option or automatic fallback dataset/model.

## Distinct evidence groups

`english_v1_cases.json` preserves the investigation's source references and texts:

1. **Exact user cases:** CERN and Argentina factual summaries, whose central claims
   are supported by primary sources; and an explicitly synthetic FIFA story. Original
   paragraph breaks and Unicode are retained. CERN/Argentina have no title; FIFA does.
   Expected FAKE percentages are 70.41, 69.63 and 68.82 respectively. The NASA 63.10%
   case is explicitly pending because its exact text is unavailable; no substitute
   is scored.
2. **Controlled pairs:** 12 source-grounded factual summaries and 12 deliberate
   synthetic factual mutations across nine topic categories. Each pair includes its
   primary source, label provenance, explanation of the false assertion and text
   hashes. The summaries are investigator-authored, not verbatim published articles.
   Synthetic variants are not naturally occurring misinformation. The paired texts
   are correlated; do not treat them as 24 independent random samples.
3. **WELFake holdout:** evaluated separately by `audit_welfake_holdout.py` using the
   local CSV's dataset annotations. Those labels are not individually fact-verified.
   No dataset articles are copied into the diagnostic JSON or pooled with the other
   groups to manufacture a combined accuracy score.

Four published-excerpt references from the earlier investigation are retained as
`reference_only_published_excerpts`: URLs, extraction metadata, hashes and historical
scores, without downloaded article bodies. They are explicitly **not executed** by
this offline harness and are excluded from its metrics. Their earlier observations
must not be presented as a new offline run.

These selected examples are a regression/stress suite, **not a representative
accuracy benchmark**. REAL means source-supported central factual claims, not proof
of every interpretive sentence; FAKE means the documented synthetic false assertion.
Do not tune thresholds on this suite and then report its score as independent
validation. A separate source/story/topic/time-disjoint benchmark is still needed.

## Labels, integrity and production invariants

`main.py` loads `english_fake_news_pipeline_v1.pkl`. The unversioned English model
is byte-identical. Numeric class 0 maps to REAL and class 1 to FAKE locally. The
[upstream WELFake description](https://zenodo.org/records/4561253) contains a label
sentence inconsistent with its class counts and the CSV content; do not reverse
the application mapping based on that sentence.

Pinned SHA-256 checksums:

- V1: `adebf54a41f4219d7c5f05ece9d933d93f13f5a05f1c005a31b5dfb6b61d4c0a`
- WELFake CSV: `665331424230fc452e9482c3547a6a199a2c29745ade8d236950d1d105223773`

The evaluator verifies V1 before deserialization and after evaluation. The holdout
auditor also verifies the CSV before and after reading. Corpus text hashes prevent
silent input changes. A changed artifact causes failure rather than silently testing
a different model or dataset. Only the local, previously audited pickle is loaded.

The installed environment used for the investigation was Python 3.15.2,
scikit-learn 1.9.1 and joblib 1.6.0. This document is not a dependency lockfile;
dependency changes may affect reproducibility and are outside this task.

## Metrics and abstention denominators

FAKE is the positive class. Matrices always have rows `[actual REAL, actual FAKE]`
and columns `[predicted REAL, predicted FAKE, UNCERTAIN]`. The binary report uses
the model's 0.5 decision boundary and has zero entries in the UNCERTAIN column.
The production-style report uses strict comparisons: `p_fake < 0.40` is REAL,
`p_fake > 0.60` is FAKE; boundaries and values between them are UNCERTAIN.
These are offline evaluation rules, not changes to production thresholds.

For matrix rows `[TN, FP, U_real]` and `[FN, TP, U_fake]`:

| Output | Definition |
| --- | --- |
| `false_positive_rate_all_real` | FP / (TN + FP + U_real): false accusations among all real cases |
| `false_negative_rate_all_fake` | FN / (FN + TP + U_fake): false REAL decisions among all fake cases |
| `false_positive_rate_decided_real` | FP / (TN + FP), excluding abstentions |
| `false_negative_rate_decided_fake` | FN / (FN + TP), excluding abstentions |
| `fake_precision` | TP / (TP + FP) |
| `fake_recall_all_fake` | TP / (TP + FN + U_fake): abstentions do not count as detections |
| `fake_miss_or_abstain_rate` | (FN + U_fake) / all actual FAKE |
| `coverage` | Number of non-UNCERTAIN decisions / all examples |
| `accuracy_among_decided` | (TP + TN) / all non-UNCERTAIN decisions |

Undefined rates are JSON `null`, never silently zero. In binary evaluation, the
all-case and decided-case rates coincide. Always report abstentions and coverage
alongside selective accuracy; a low false-negative decision rate can coexist with
low recall when the model abstains. ROC AUC and Brier score use the raw probabilities.

## Source-marker sensitivity

For each exact/controlled text, the evaluator also scores three isolated changes:
prefix `Reuters - `, prefix `WASHINGTON (Reuters) - `, and suffix
`Featured image: Getty Images.`. It reports each probability, mean change in FAKE
percentage points, decision-flip counts and the same metrics for each variant.
These additions are deliberately artificial stress tests. They are **not genuine
attributions, recommended preprocessing, or extra independent benchmark examples**.
Source/format shortcuts are exposed when factual and synthetic texts move together.

The holdout auditor reports performance conditional on source-marker occurrence and
counts in both split partitions. Occurrence is not verified publisher provenance.

## Holdout reconstruction and limitations

The auditor fills missing title/body fields, concatenates them, collapses whitespace,
casefolds combined text for deduplication, removes conflicting groups and retains the
first duplicate. It then uses stratified 80/20 splitting with `random_state=42`.
The expected split-index hash is pinned. It does not invoke the V3 trainer.

The investigation reconstructed 72,134 raw rows, 8,462 duplicate excess rows,
63,672 cleaned rows, 50,937 training rows and 12,735 holdout rows. All 50,000 saved
IDF values match training-partition document frequencies. V1 binary accuracy was
95.885355% with macro F1 0.958503. This supports the reconstructed split, not a
complete historical record of every training/tuning decision.

There were 99 holdout bodies also in training, or 187 after removing punctuation
and spacing, despite zero combined-content overlap. Source patterns occur in both
partitions. The auditor reports these overlaps, length slices and calibration bins
without fitting a calibrator. A high random in-corpus score does not establish
generalization to new publishers, domains, dates or factual counterexamples.

## Reproduction reference results

The exact user cohort gives `[[0, 2, 0], [0, 1, 0]]` at production thresholds.
The controlled 24-item cohort gives `[[1, 9, 2], [0, 9, 3]]`: false-positive rate
75%, fake precision 50%, fake recall 75%, zero false REAL decisions and five
abstentions. Only 5/12 pairs rank the synthetic version as more FAKE.

Reconstructed holdout binary matrix: `[[6691, 267, 0], [257, 5520, 0]]`.
Production-style holdout matrix: `[[6554, 172, 232], [150, 5344, 283]]`.
Fresh command output is authoritative; these reference numbers document the frozen
investigation, not a promise about future model or environment versions.

No deployment, retraining, threshold change, calibration or model replacement is
part of this harness. The active English and Albanian models, production endpoints,
frontend, backend, startup script, environment files and database remain untouched.
