"""
Computer Vision Service
========================
Handles everything that isn't "what does the text say":
  - Estimating the Principal Display Panel (PDP) area in real-world units
    (needed because Rule 7's font-size thresholds are banded by PDP area).
  - Converting OCR pixel-height measurements into millimetres, using a
    reference object (a fixed-size calibration marker, or the known
    physical dimensions of the pack if supplied by the operator).
  - Drawing the red/green annotated bounding-box overlay for the
    dashboard and the PDF evidence report.
  - Optionally, field-region localization via a trained YOLO detector
    (see app/ml/train_detector.py) -- OFF by default, see
    USE_TRAINED_DETECTOR below and app/ml/artifacts/detector_training_report.txt
    for exactly why this isn't trusted for classification yet.

IMPORTANT CALIBRATION NOTE
---------------------------
Pixels-to-millimetres conversion is only as good as its calibration.
Three supported modes (set per-scan via `calibration` param):
  1. "reference_card" - operator places a standard ID-1 card (85.6mm x
     53.98mm) in frame; we detect it via contour matching and derive
     px-per-mm from its known size. Most reliable for field captures.
  2. "known_pack_dims" - operator supplies the pack's real width/height
     (common for manufacturer pre-print QA where exact artwork specs
     are known); we derive px-per-mm from the PDP contour vs those dims.
  3. "dpi_estimate" - fallback for manufacturer print-file uploads (PDF/
     high-res PNG) where the file's embedded DPI gives us px-per-mm
     directly. Least reliable for photographed packaging.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

ID1_CARD_WIDTH_MM = 85.6
ID1_CARD_HEIGHT_MM = 53.98

# The trained detector (app/ml/train_detector.py) is a genuine
# proof-of-concept: bounding-box localization converges well, but
# classification accuracy is not yet trustworthy for compliance decisions
# (see app/ml/artifacts/detector_training_report.txt for the full
# per-class breakdown). Default OFF so the shipped pipeline relies on the
# well-tested heuristic contour method + OCR/regex/ML-text ensemble
# instead. Flip this on once you've retrained on real labeled photos and
# re-verified per-class mAP.
USE_TRAINED_DETECTOR = False
DETECTOR_WEIGHTS_PATH = Path(__file__).resolve().parent.parent / "ml" / "artifacts" / "pdp_detector" / "weights" / "best.pt"
DETECTOR_CONFIDENCE_THRESHOLD = 0.15


@lru_cache
def _load_detector():
    from ultralytics import YOLO

    return YOLO(str(DETECTOR_WEIGHTS_PATH))


def detect_field_regions(image_bgr: np.ndarray) -> list[dict]:
    """Runs the trained YOLO detector, if enabled and weights exist.
    Returns a list of {field, confidence, x, y, w, h} dicts in pixel
    coordinates. Returns an empty list if the detector is disabled,
    unavailable, or (deliberately) not yet trusted -- see module docstring.
    """
    if not USE_TRAINED_DETECTOR or not DETECTOR_WEIGHTS_PATH.exists():
        return []

    model = _load_detector()
    results = model.predict(image_bgr, conf=DETECTOR_CONFIDENCE_THRESHOLD, verbose=False)
    detections = []
    for box in results[0].boxes:
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        detections.append(
            {
                "field": model.names[int(box.cls[0])],
                "confidence": float(box.conf[0]),
                "x": int(x1),
                "y": int(y1),
                "w": int(x2 - x1),
                "h": int(y2 - y1),
            }
        )
    return detections


@dataclass
class Calibration:
    mode: str  # reference_card | known_pack_dims | dpi_estimate
    px_per_mm: float
    pdp_area_cm2: float | None = None


def estimate_pdp_contour(image_bgr: np.ndarray) -> tuple[int, int, int, int]:
    """Rough Principal Display Panel detection: largest rectangular
    contour that isn't the full image border. This is a heuristic --
    for production, consider a trained segmentation model (e.g. a small
    YOLO/segment-anything pass) once you have labeled packaging data.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = gray.shape
    full_area = h * w
    best = (0, 0, w, h)  # fallback: whole image
    best_area = 0
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if area < 0.98 * full_area and area > best_area:
            best_area = area
            best = (x, y, cw, ch)
    return best


def calibrate_reference_card(image_bgr: np.ndarray) -> Calibration | None:
    """Attempt to find a standard ID-1 sized card in the frame and derive
    px-per-mm from it. Returns None if no suitable rectangle is found --
    caller should fall back to another calibration mode."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    target_ratio = ID1_CARD_WIDTH_MM / ID1_CARD_HEIGHT_MM
    for c in contours:
        rect = cv2.minAreaRect(c)
        (rw, rh) = rect[1]
        if rw == 0 or rh == 0:
            continue
        ratio = max(rw, rh) / min(rw, rh)
        if abs(ratio - target_ratio) < 0.08 and cv2.contourArea(c) > 1500:
            px_per_mm = max(rw, rh) / ID1_CARD_WIDTH_MM
            return Calibration(mode="reference_card", px_per_mm=px_per_mm)
    return None


def calibrate_known_dims(pdp_box: tuple[int, int, int, int], real_width_mm: float, real_height_mm: float) -> Calibration:
    _, _, pw, ph = pdp_box
    px_per_mm = ((pw / real_width_mm) + (ph / real_height_mm)) / 2
    pdp_area_cm2 = (real_width_mm * real_height_mm) / 100
    return Calibration(mode="known_pack_dims", px_per_mm=px_per_mm, pdp_area_cm2=pdp_area_cm2)


def calibrate_dpi(dpi: float) -> Calibration:
    px_per_mm = dpi / 25.4
    return Calibration(mode="dpi_estimate", px_per_mm=px_per_mm)


def px_height_to_mm(px_height: int, calibration: Calibration) -> float:
    if calibration.px_per_mm <= 0:
        return 0.0
    return round(px_height / calibration.px_per_mm, 2)


def draw_annotations(
    image_bgr: np.ndarray,
    boxes: list[tuple[int, int, int, int, bool]],  # x, y, w, h, is_compliant
) -> np.ndarray:
    """Draws green boxes for compliant fields and red boxes for
    violations, matching the "Real-Time Result Dashboard" spec."""
    annotated = image_bgr.copy()
    for x, y, w, h, is_compliant in boxes:
        color = (60, 179, 60) if is_compliant else (30, 30, 220)  # BGR
        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 3)
    return annotated
