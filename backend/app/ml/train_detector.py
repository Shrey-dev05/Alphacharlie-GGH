"""
Object Detector Training Script (proof of concept)
=====================================================
Trains a YOLOv8n model to localize declaration fields (net quantity, MRP,
manufacturer details, etc.) as bounding boxes directly on the packaging
image — this is the visual counterpart to the text classifier in
train_field_classifier.py, and it's what would eventually replace/augment
the heuristic contour-based PDP detection in services/cv_service.py.

HONEST SCOPE OF THIS SCRIPT, READ BEFORE TRUSTING ITS OUTPUT
----------------------------------------------------------------
This trains on PURELY SYNTHETIC images (see generate_image_dataset.py) —
clean renders with no glare, no curvature, no wrinkles, no busy backgrounds,
a handful of fonts. A model trained only on this data will overfit to that
synthetic distribution and should NOT be expected to perform well on real
photographed packaging without additional training on real, labeled photos.

Running this script proves three things that matter for extending the
project, and no more than that:
  1. The YOLO training pipeline (data format, training loop, checkpoint
     export) is wired correctly end-to-end.
  2. The resulting weights file loads and runs inference correctly, so the
     integration hook in cv_service.py has something real to call.
  3. Training converges at all on this data (loss decreases, mAP > 0),
     which is a useful sanity check before investing in real data collection.

To make this genuinely useful on real packaging: collect real photos (a
few hundred minimum), annotate them in the same YOLO format (Roboflow,
CVAT, or LabelImg all export this format directly), drop them into
app/ml/datasets/real_pdp/ alongside or instead of the synthetic set, and
increase `epochs` substantially (50-150+ depending on dataset size).

Run: `python -m app.ml.train_detector`
"""
from __future__ import annotations

from pathlib import Path

from app.ml.generate_image_dataset import DATASET_DIR, generate

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"


def train(n_images: int = 60, epochs: int = 15, imgsz: int = 640):
    from ultralytics import YOLO

    data_yaml = DATASET_DIR / "data.yaml"
    if not data_yaml.exists():
        print("No dataset found — generating synthetic dataset first...")
        generate(n_images=n_images)

    print(f"Loading YOLOv8n base weights and training for {epochs} epochs on synthetic PDP dataset...")
    model = YOLO("yolov8n.pt")  # nano variant: fastest to train/run on CPU

    results = model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=8,
        project=str(ARTIFACT_DIR),
        name="pdp_detector",
        exist_ok=True,
        verbose=True,
        patience=epochs,  # don't early-stop on this tiny proof-of-concept run
    )

    best_weights = ARTIFACT_DIR / "pdp_detector" / "weights" / "best.pt"
    print(f"\nTraining complete. Best weights: {best_weights}")
    print(f"Final metrics: {results.results_dict if hasattr(results, 'results_dict') else 'see training log above'}")
    return best_weights


if __name__ == "__main__":
    train()
