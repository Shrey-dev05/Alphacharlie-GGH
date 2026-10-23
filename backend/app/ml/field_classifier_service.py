"""
Field Classifier Service
==========================
Runtime wrapper around the trained model in app/ml/artifacts/field_classifier.joblib
(see train_field_classifier.py for how it was trained). Loaded once and
cached; used by validation_engine.py as a second, ML-based signal alongside
regex/keyword matching — the two are combined so a declaration is counted as
present if EITHER method finds it, which is more robust than either alone.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

ARTIFACT_PATH = Path(__file__).resolve().parent / "artifacts" / "field_classifier.joblib"

# Only these labels correspond to checks the validation engine cares about;
# "other_noise" is a valid prediction but never counts as evidence for a rule.
NOISE_LABEL = "other_noise"

# Minimum calibrated confidence before we trust the classifier's opinion.
# Set conservatively: false positives here mean marking a real violation as
# compliant, which is the worse failure mode for a regulatory tool.
DEFAULT_CONFIDENCE_THRESHOLD = 0.6


class ClassifierUnavailable(Exception):
    """Raised when the model artifact hasn't been trained/saved yet."""


@lru_cache
def _load_model():
    if not ARTIFACT_PATH.exists():
        raise ClassifierUnavailable(
            f"No trained model found at {ARTIFACT_PATH}. Run "
            f"`python -m app.ml.train_field_classifier` from backend/ first."
        )
    import joblib

    return joblib.load(ARTIFACT_PATH)


def is_available() -> bool:
    return ARTIFACT_PATH.exists()


def classify_line(text: str) -> tuple[str, float]:
    """Returns (predicted_label, confidence) for one OCR'd line."""
    model = _load_model()
    label = model.predict([text])[0]
    proba = model.predict_proba([text])[0]
    confidence = float(max(proba))
    return label, confidence


def find_best_match(lines: list[str], target_field: str, threshold: float = DEFAULT_CONFIDENCE_THRESHOLD):
    """Scans OCR lines for the best classifier match to `target_field`.
    Returns (line_text, confidence) for the highest-confidence match above
    `threshold`, or None if nothing qualifies.
    """
    if not is_available() or not lines:
        return None

    best: tuple[str, float] | None = None
    for line in lines:
        label, confidence = classify_line(line)
        if label == target_field and confidence >= threshold:
            if best is None or confidence > best[1]:
                best = (line, confidence)
    return best
