"""
File Storage Service
=====================
Abstracts away *where* scanned images and generated PDFs live so the
rest of the app just deals with a `storage_key` string. Defaults to
local disk (zero setup for development); flip STORAGE_BACKEND=s3 and
fill in AWS_* in `.env` to use S3 in staging/production.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()
LOCAL_DIR = Path(settings.STORAGE_LOCAL_DIR)
LOCAL_DIR.mkdir(parents=True, exist_ok=True)


def _new_key(prefix: str, extension: str) -> str:
    return f"{prefix}/{uuid.uuid4()}.{extension}"


def save_bytes(data: bytes, prefix: str, extension: str) -> str:
    """Saves bytes and returns a storage_key that `load_bytes`/`get_url`
    can later resolve, regardless of backend."""
    key = _new_key(prefix, extension)

    if settings.STORAGE_BACKEND == "s3":
        import boto3

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        s3.put_object(Bucket=settings.AWS_S3_BUCKET, Key=key, Body=data)
        return key

    # local backend
    path = LOCAL_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def load_bytes(storage_key: str) -> bytes:
    if settings.STORAGE_BACKEND == "s3":
        import boto3

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        obj = s3.get_object(Bucket=settings.AWS_S3_BUCKET, Key=storage_key)
        return obj["Body"].read()

    return (LOCAL_DIR / storage_key).read_bytes()


def get_url(storage_key: str) -> str:
    """Returns a URL the frontend can load the asset from. Local dev
    serves files via the /static mount configured in main.py; for S3,
    generate a pre-signed URL instead so buckets can stay private."""
    if settings.STORAGE_BACKEND == "s3":
        import boto3

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_S3_BUCKET, "Key": storage_key},
            ExpiresIn=3600,
        )
    return f"/static/{storage_key}"


def delete_file(storage_key: str | None) -> None:
    """Deletes a single file from storage if present."""
    if not storage_key:
        return
    if settings.STORAGE_BACKEND == "s3":
        import boto3

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        try:
            s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=storage_key)
        except Exception:
            pass
        return

    path = LOCAL_DIR / storage_key
    if path.exists() and path.is_file():
        try:
            path.unlink()
        except Exception:
            pass


def purge_storage() -> None:
    """Cleans all stored scans and generated reports."""
    import shutil

    for sub in ["reports", "scans"]:
        sub_dir = LOCAL_DIR / sub
        if sub_dir.exists():
            shutil.rmtree(sub_dir, ignore_errors=True)
            sub_dir.mkdir(parents=True, exist_ok=True)

