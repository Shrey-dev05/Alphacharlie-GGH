"""
Synthetic Image Dataset Generator (for object detection training)
=====================================================================
Generates packaging-label images with known ground-truth bounding boxes
per declaration field, in YOLO format (images/ + labels/*.txt + data.yaml).

WHY SYNTHETIC, AND WHAT IT'S FOR
----------------------------------
There is no accessible dataset of real, labeled Indian packaging photos in
this environment (no GPU-hosting dataset registries, no camera, no bulk
image search reachable from the sandbox this was built in). Training a
detector on synthetic renders only and expecting it to work on real
photographed packaging is NOT realistic — real packages have glare, curved
surfaces, varied fonts, wrinkles, and busy backgrounds that this generator
does not simulate.

What this module IS good for:
  1. Proving the training pipeline (data format, training script, model
     integration hook) is wired correctly end-to-end — see
     train_detector.py, which runs a real (if tiny) training job against
     this data and produces a loadable model.
  2. Bootstrapping — a detector pretrained on this synthetic data will
     converge faster once you add real labeled photos, versus training
     from random initialization.
  3. As a template: point PACKAGING_PHOTOS_DIR at a folder of real,
     manually-annotated (e.g. via Roboflow/CVAT/LabelImg) packaging photos
     in the same YOLO format, and the training script works unmodified.

Classes correspond to the same field categories the text classifier uses
(app/ml/data_generation.py), so both models stay conceptually aligned.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

random.seed(7)

DATASET_DIR = Path(__file__).resolve().parent / "datasets" / "synthetic_pdp"
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Detection classes -- a subset of the text-classifier's categories that
# make sense as *visual regions* to localize (as opposed to e.g.
# "fssai_veg_nonveg" which is more of a small logo/mark than a text block,
# left for a future logo-detection pass — see README's roadmap note).
CLASSES = [
    "net_quantity",
    "mrp",
    "manufacturer_details",
    "mfg_date",
    "consumer_care",
    "common_name",
    "country_of_origin",
    "best_before",
    "fssai_license",
]

SAMPLE_LINES = {
    "net_quantity": ["Net Wt {n} g", "Net Quantity: {n} ml", "Contents {n}g"],
    "mrp": ["MRP Rs.{n} Incl. of all taxes", "M.R.P Rs {n}/- incl. taxes"],
    "manufacturer_details": ["Mfg by: Sunrise Foods Pvt Ltd, Indore", "Marketed by Vantage Traders"],
    "mfg_date": ["Mfg Date: 0{m}/2026", "Pkd on 202{y}"],
    "consumer_care": ["Consumer Care: 1800{n}", "Helpline: 1800{n}"],
    "common_name": ["Classic Biscuits", "Masala Namkeen"],
    "country_of_origin": ["Country of Origin: Vietnam", "Made in Thailand"],
    "best_before": ["Best Before 6 months", "Use By 0{m}/2027"],
    "fssai_license": ["FSSAI Lic No. 1234567890{n}", "Lic. No 987654321{n}"],
}


def _render_label(idx: int) -> tuple[Image.Image, list[tuple[int, int, int, int, int]]]:
    """Renders one synthetic packaging label. Returns (image, boxes) where
    boxes are (class_id, x, y, w, h) in pixel coordinates."""
    width, height = random.choice([(800, 600), (900, 700), (700, 900)])
    bg_color = random.choice(["white", "#f5f5f0", "#fafafa"])
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(FONT_BOLD_PATH, random.randint(24, 32))
    body_font_size = random.randint(15, 20)
    body_font = ImageFont.truetype(FONT_PATH, body_font_size)

    boxes: list[tuple[int, int, int, int, int]] = []
    y = random.randint(20, 40)

    # Title (common_name) always present
    text = random.choice(SAMPLE_LINES["common_name"])
    draw.text((30, y), text, fill="black", font=title_font)
    bbox = draw.textbbox((30, y), text, font=title_font)
    boxes.append((CLASSES.index("common_name"), bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]))
    y += 55

    # Randomly include a subset of the other fields, in random order, to
    # teach the model field *appearance* rather than fixed layout position.
    other_fields = [c for c in CLASSES if c != "common_name"]
    random.shuffle(other_fields)
    n_fields = random.randint(5, len(other_fields))
    for field in other_fields[:n_fields]:
        template = random.choice(SAMPLE_LINES[field])
        text = template.format(n=random.randint(10, 999), m=random.randint(1, 9), y=random.randint(4, 7))
        if y > height - 40:
            break
        draw.text((30, y), text, fill="black", font=body_font)
        bbox = draw.textbbox((30, y), text, font=body_font)
        boxes.append((CLASSES.index(field), bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]))
        y += body_font_size + 20

    return img, boxes


def _to_yolo_line(class_id: int, x: int, y: int, w: int, h: int, img_w: int, img_h: int) -> str:
    x_center = (x + w / 2) / img_w
    y_center = (y + h / 2) / img_h
    return f"{class_id} {x_center:.6f} {y_center:.6f} {w / img_w:.6f} {h / img_h:.6f}"


def generate(n_images: int = 60, val_split: float = 0.2) -> Path:
    """Builds the full YOLO-format dataset on disk and returns its root path."""
    for split in ("train", "val"):
        (DATASET_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (DATASET_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    n_val = max(1, int(n_images * val_split))
    for i in range(n_images):
        split = "val" if i < n_val else "train"
        img, boxes = _render_label(i)
        img_path = DATASET_DIR / "images" / split / f"label_{i:04d}.jpg"
        label_path = DATASET_DIR / "labels" / split / f"label_{i:04d}.txt"
        img.save(img_path, quality=88)
        with open(label_path, "w") as f:
            for class_id, x, y, w, h in boxes:
                f.write(_to_yolo_line(class_id, x, y, w, h, img.width, img.height) + "\n")

    yaml_content = (
        f"path: {DATASET_DIR}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"names:\n" + "\n".join(f"  {i}: {name}" for i, name in enumerate(CLASSES)) + "\n"
    )
    (DATASET_DIR / "data.yaml").write_text(yaml_content)

    print(f"Generated {n_images} synthetic labeled images ({n_images - n_val} train / {n_val} val)")
    print(f"Dataset root: {DATASET_DIR}")
    return DATASET_DIR


if __name__ == "__main__":
    generate()
