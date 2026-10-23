"""
OCR Service
===========
Extracts text + per-word bounding boxes from a packaging image.

Default engine is Tesseract (via pytesseract) because it runs fully
offline with no cloud credentials -- good for local dev and for
air-gapped government deployments. For production accuracy on curved /
glossy packaging, swap OCR_ENGINE to "gcv" (Google Cloud Vision) or
"textract" (AWS Textract) in `.env`; both stubs are wired up below so
you only need to fill in the API call.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import os
import shutil
import cv2
import numpy as np
import pytesseract

from app.core.config import get_settings

settings = get_settings()

# Auto-detect Tesseract executable on Windows if not already on PATH
if not shutil.which("tesseract"):
    for candidate in [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
        r"C:\Users\shrey\.tools\tesseract\tesseract.exe",
    ]:
        if os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            break


@dataclass
class OcrWord:
    text: str
    left: int
    top: int
    width: int
    height: int
    confidence: float


@dataclass
class OcrResult:
    full_text: str
    words: list[OcrWord] = field(default_factory=list)
    lines: list[str] = field(default_factory=list)
    image_width: int = 0
    image_height: int = 0


def _preprocess(image_bgr: np.ndarray) -> tuple[np.ndarray, float]:
    """High-fidelity preprocessing for packaging photos:
    1. Converts to grayscale
    2. Upscales low-res packaging images so small printed declarations (1-2mm fonts) are legible to OCR
    3. Applies edge-preserving bilateral filtering to remove camera noise without blurring text edges
    4. Applies CLAHE (Contrast-Limited Adaptive Histogram Equalization) to balance bright/dark packaging regions.
    Returns (enhanced_image, scale_factor).
    """
    h, w = image_bgr.shape[:2]
    scale = 1.0
    # If image resolution is low, upscale so small text has enough pixel height
    if max(h, w) < 1600:
        scale = min(2.0, 1600.0 / max(h, w))
        resized = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    elif max(h, w) > 2048:
        scale = 2048.0 / max(h, w)
        resized = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        resized = image_bgr

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    filtered = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(filtered)

    return enhanced, scale


def _extract_words_from_image(processed: np.ndarray, scale: float, config: str = "--oem 3 --psm 11") -> list[OcrWord]:
    data = pytesseract.image_to_data(
        processed,
        output_type=pytesseract.Output.DICT,
        config=config,
    )
    words: list[OcrWord] = []
    n = len(data["text"])
    for i in range(n):
        text = data["text"][i].strip()
        conf = float(data["conf"][i]) if data["conf"][i] not in ("-1", "") else -1.0
        if text and (conf >= 20 or conf == -1.0):
            left = int(data["left"][i] / scale)
            top = int(data["top"][i] / scale)
            width = max(1, int(data["width"][i] / scale))
            height = max(1, int(data["height"][i] / scale))
            words.append(
                OcrWord(
                    text=text,
                    left=left,
                    top=top,
                    width=width,
                    height=height,
                    confidence=conf,
                )
            )
    return words


def _word_iou(w1: OcrWord, w2: OcrWord) -> float:
    xA = max(w1.left, w2.left)
    yA = max(w1.top, w2.top)
    xB = min(w1.left + w1.width, w2.left + w2.width)
    yB = min(w1.top + w1.height, w2.top + w2.height)
    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH
    boxAArea = w1.width * w1.height
    boxBArea = w2.width * w2.height
    unionArea = float(boxAArea + boxBArea - interArea)
    return interArea / unionArea if unionArea > 0 else 0.0


def run_ocr_tesseract(image_bgr: np.ndarray) -> OcrResult:
    processed, scale = _preprocess(image_bgr)
    orig_h, orig_w = image_bgr.shape[:2]

    # Pass 1: Standard contrast (dark text on light background)
    primary_words = _extract_words_from_image(processed, scale, config="--oem 3 --psm 11")

    # Pass 2: Inverted contrast (light/white text on dark/colored packaging background)
    inverted = cv2.bitwise_not(processed)
    inverted_words = _extract_words_from_image(inverted, scale, config="--oem 3 --psm 11")

    # Merge: keep all primary words; append inverted words that don't overlap existing words
    merged_words = list(primary_words)
    for inv_w in inverted_words:
        # Check if already covered by an existing word with IoU > 0.35
        if not any(_word_iou(inv_w, pw) > 0.35 for pw in primary_words):
            merged_words.append(inv_w)

    words = merged_words

    # Spatial line clustering: group words into coherent packaging lines by vertical proximity
    # rather than relying solely on Tesseract's noisy block/par indices
    lines: list[str] = []
    if words:
        # Sort words primarily by top coordinate
        sorted_words = sorted(words, key=lambda w: (w.top, w.left))
        line_clusters: list[list[OcrWord]] = []

        for w in sorted_words:
            word_mid_y = w.top + (w.height / 2.0)
            placed = False
            for cluster in line_clusters:
                # Calculate cluster average mid_y and height
                cluster_mid_y = sum(cw.top + (cw.height / 2.0) for cw in cluster) / len(cluster)
                cluster_avg_h = sum(cw.height for cw in cluster) / len(cluster)
                # If word is within vertical tolerance of the line cluster
                if abs(word_mid_y - cluster_mid_y) <= max(12.0, cluster_avg_h * 0.70):
                    cluster.append(w)
                    placed = True
                    break
            if not placed:
                line_clusters.append([w])

        # Sort words within each line from left to right, and sort lines from top to bottom
        line_clusters.sort(key=lambda c: sum(cw.top for cw in c) / len(c))
        for cluster in line_clusters:
            cluster.sort(key=lambda cw: cw.left)
            line_text = " ".join(cw.text for cw in cluster).strip()
            if line_text:
                lines.append(line_text)

    full_text = "\n".join(lines) if lines else " ".join(w.text for w in words)
    return OcrResult(
        full_text=full_text,
        words=words,
        lines=lines,
        image_width=orig_w,
        image_height=orig_h,
    )


def run_ocr_google_cloud_vision(image_bgr: np.ndarray) -> OcrResult:
    """Stub: wire up `google-cloud-vision` here once GOOGLE_APPLICATION_CREDENTIALS
    is configured. Recommended for production -- handles glare/curved
    surfaces noticeably better than Tesseract on real packaging photos.
    """
    raise NotImplementedError(
        "Google Cloud Vision OCR not yet configured. Set OCR_ENGINE=tesseract "
        "for local development, or implement this using google-cloud-vision "
        "and GOOGLE_APPLICATION_CREDENTIALS."
    )


def run_ocr_aws_textract(image_bgr: np.ndarray) -> OcrResult:
    """Stub: wire up boto3 `textract` client here once AWS credentials
    are configured. Textract's AnalyzeDocument (FORMS/TABLES) is useful
    for structured labels like nutrition/ingredient panels."""
    raise NotImplementedError(
        "AWS Textract OCR not yet configured. Set OCR_ENGINE=tesseract for "
        "local development, or implement this using boto3 + AWS credentials."
    )


def extract_text(image_bgr: np.ndarray) -> OcrResult:
    engine = settings.OCR_ENGINE
    if engine == "tesseract":
        return run_ocr_tesseract(image_bgr)
    if engine == "gcv":
        return run_ocr_google_cloud_vision(image_bgr)
    if engine == "textract":
        return run_ocr_aws_textract(image_bgr)
    raise ValueError(f"Unknown OCR_ENGINE: {engine}")
