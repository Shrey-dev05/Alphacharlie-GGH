from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables if they don't exist and run light schema migrations for new columns."""
    from sqlalchemy import inspect, text
    from app.models import models  # noqa: F401  (ensures models are registered)

    Base.metadata.create_all(bind=engine)

    # Safe non-destructive column migrations for SQLite / relational DBs
    with engine.connect() as conn:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        if "violations" in table_names:
            v_cols = [c["name"] for c in inspector.get_columns("violations")]
            if "ignored" not in v_cols:
                conn.execute(text("ALTER TABLE violations ADD COLUMN ignored BOOLEAN DEFAULT 0"))
            if "override_reason" not in v_cols:
                conn.execute(text("ALTER TABLE violations ADD COLUMN override_reason VARCHAR DEFAULT NULL"))
            if "overridden_by" not in v_cols:
                conn.execute(text("ALTER TABLE violations ADD COLUMN overridden_by VARCHAR DEFAULT NULL"))
            if "overridden_at" not in v_cols:
                conn.execute(text("ALTER TABLE violations ADD COLUMN overridden_at DATETIME DEFAULT NULL"))

        if "scans" in table_names:
            s_cols = [c["name"] for c in inspector.get_columns("scans")]
            if "inspector_override" not in s_cols:
                conn.execute(text("ALTER TABLE scans ADD COLUMN inspector_override BOOLEAN DEFAULT 0"))
            if "inspector_override_notes" not in s_cols:
                conn.execute(text("ALTER TABLE scans ADD COLUMN inspector_override_notes VARCHAR DEFAULT NULL"))

        conn.commit()
