from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.db.database import init_db

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-driven scanning and validation engine for the Legal Metrology (Packaged Commodities) Rules, 2011.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serves locally-stored scan images/PDFs at /static/... when
# STORAGE_BACKEND=local (see services/storage_service.py).
app.mount("/static", StaticFiles(directory=settings.STORAGE_LOCAL_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
