FROM python:3.12-slim

# tesseract-ocr: local OCR engine (see app/services/ocr_service.py)
# libzbar0: barcode/QR decoding engine (see app/services/barcode_service.py)
# libgl1: required by opencv-python-headless at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libzbar0 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/storage

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
