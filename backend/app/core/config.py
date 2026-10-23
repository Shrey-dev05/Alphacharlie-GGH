"""
Central application configuration.

All values are overridable via environment variables or a `.env` file in
`backend/`. See `.env.example` at the project root for the full list.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- General ---
    APP_NAME: str = "Pramaan Portal - Legal Metrology Compliance Engine"
    ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # --- Security / Auth ---
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hour shift for field inspectors

    # --- Database ---
    # Defaults to a local SQLite file so the backend runs out-of-the-box
    # without a Postgres instance. Point DATABASE_URL at Postgres for
    # anything beyond local development.
    DATABASE_URL: str = "sqlite:///./legal_metrology.db"

    # --- File storage ---
    # "local" writes to STORAGE_LOCAL_DIR. Set STORAGE_BACKEND=s3 and fill
    # in the AWS_* values to use S3 instead (see services/storage_service.py).
    STORAGE_BACKEND: str = "local"
    STORAGE_LOCAL_DIR: str = "./storage"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str | None = None

    # --- OCR ---
    # "tesseract" runs fully offline/local. Swap in "gcv" or "textract" once
    # cloud credentials are available -- see services/ocr_service.py.
    OCR_ENGINE: str = "tesseract"
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None

    # --- AI Legal Assistant (RAG chatbot) ---
    # "gemini" (default) uses Google's Gemini API; "anthropic" uses Claude.
    # Both share the same retrieval + system prompt in rag_chatbot_service.py.
    CHATBOT_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    ANTHROPIC_API_KEY: str | None = None
    CHATBOT_MODEL: str = "claude-sonnet-4-6"

    # --- Samadhan AI Image Model ---
    SAMADHAN_IMAGE_MODEL: str = "gemini-nano-banana-2.1"

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
