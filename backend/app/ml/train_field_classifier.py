"""
Field Classifier Training Script
===================================
Trains a text classifier that reads one OCR'd line from a packaging label
and predicts which regulatory declaration category it belongs to (or
"other_noise" if it's not a declaration at all).

Why this approach instead of the regex/keyword matching already in
validation_engine.py:
  - Regex is exact and fast, but brittle — it misses phrasing variations
    and breaks on the OCR errors that are routine on real packaging photos
    (glare, small print, curved surfaces).
  - This classifier is trained WITH simulated OCR noise baked into half its
    training examples (see app/ml/data_generation.py), so it's specifically
    robust to the kind of corrupted text Tesseract actually produces.
  - It's used as an additional signal in validation_engine.py: if regex
    doesn't match a required field but the classifier is highly confident
    a line belongs to that category, the check still passes — catching
    genuine declarations that pure regex would have flagged as "missing".

Model: character n-gram (2-4) TF-IDF features + a linear SVM, calibrated via
Platt scaling (CalibratedClassifierCV) so `predict_proba` gives usable
confidence scores. Character n-grams (rather than word tokens) are the right
choice here because OCR noise corrupts individual characters, not whole
words — an n-gram model degrades gracefully where a word-token model would
simply miss the word entirely.

Run: `python -m app.ml.train_field_classifier`
Outputs: app/ml/artifacts/field_classifier.joblib + a printed evaluation report.
"""
from __future__ import annotations

import time
from pathlib import Path

import joblib
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from app.ml.data_generation import generate_dataset

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
ARTIFACT_PATH = ARTIFACT_DIR / "field_classifier.joblib"
REPORT_PATH = ARTIFACT_DIR / "training_report.txt"


def build_pipeline() -> Pipeline:
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",  # character n-grams within word boundaries
        ngram_range=(2, 4),
        min_df=2,
        sublinear_tf=True,
    )
    base_clf = LinearSVC(C=1.0, class_weight="balanced")
    # LinearSVC has no predict_proba; calibrate it so the validation engine
    # can threshold on a genuine confidence score rather than a raw margin.
    calibrated = CalibratedClassifierCV(base_clf, method="sigmoid", cv=3)
    return Pipeline([("tfidf", vectorizer), ("clf", calibrated)])


def train(examples_per_class: int = 400) -> dict:
    print(f"Generating synthetic dataset ({examples_per_class} examples/class, with OCR-noise augmentation)...")
    dataset = generate_dataset(examples_per_class=examples_per_class, noise_fraction=0.5)
    texts = [t for t, _ in dataset]
    labels = [l for _, l in dataset]
    print(f"Total examples: {len(texts)} across {len(set(labels))} categories")

    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )

    pipeline = build_pipeline()
    print("Training TF-IDF (char 2-4gram) + Calibrated LinearSVC ...")
    start = time.time()
    pipeline.fit(x_train, y_train)
    elapsed = time.time() - start
    print(f"Training completed in {elapsed:.1f}s")

    y_pred = pipeline.predict(x_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, digits=3)

    print(f"\nHeld-out accuracy: {acc:.3%}\n")
    print(report)

    # Also evaluate on a fresh, independently-generated (unseen-seed) batch
    # to sanity-check we're not just memorizing the train/test split's RNG state.
    fresh = generate_dataset(examples_per_class=60, noise_fraction=0.7)  # heavier noise: harder test
    fresh_texts = [t for t, _ in fresh]
    fresh_labels = [l for _, l in fresh]
    fresh_acc = accuracy_score(fresh_labels, pipeline.predict(fresh_texts))
    print(f"Held-out accuracy on a fresh high-noise batch (noise_fraction=0.7): {fresh_acc:.3%}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, ARTIFACT_PATH)
    print(f"\nSaved model to {ARTIFACT_PATH}")

    with open(REPORT_PATH, "w") as f:
        f.write(f"Training examples/class: {examples_per_class}\n")
        f.write(f"Held-out accuracy: {acc:.3%}\n")
        f.write(f"Fresh high-noise batch accuracy: {fresh_acc:.3%}\n\n")
        f.write(report)
    print(f"Saved report to {REPORT_PATH}")

    return {"accuracy": acc, "fresh_noise_accuracy": fresh_acc, "report": report}


if __name__ == "__main__":
    train()
