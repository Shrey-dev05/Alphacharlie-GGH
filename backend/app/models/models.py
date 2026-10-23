"""SQLAlchemy ORM models.

Relational data (users, roles, scan metadata, violations, audit trail)
lives here in PostgreSQL. The raw OCR/CV JSON payload for each scan is
large and semi-structured, so it's stored in the `raw_analysis` JSON
column here for simplicity -- swap for a MongoDB document store by
replacing ScanRepository in services/scan_repository.py if you need to
scale that independently (see README "Database" section).
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # see core.security.Role
    organization: Mapped[str | None] = mapped_column(String, nullable=True)
    state: Mapped[str | None] = mapped_column(String, nullable=True)  # for state-wise analytics
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    scans: Mapped[list["Scan"]] = relationship(back_populates="created_by_user")


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String, default="upload")  # upload | camera | url | bulk
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)  # for e-commerce audits
    brand_name: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    product_name: Mapped[str | None] = mapped_column(String, nullable=True)

    image_storage_key: Mapped[str] = mapped_column(String, nullable=False)
    annotated_image_storage_key: Mapped[str | None] = mapped_column(String, nullable=True)

    status: Mapped[str] = mapped_column(String, default="processing")  # processing|completed|failed
    compliance_status: Mapped[str | None] = mapped_column(String, nullable=True)  # compliant|non_compliant|partial
    compliance_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-100

    raw_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # full OCR+CV+validation payload
    state: Mapped[str | None] = mapped_column(String, nullable=True)  # geo tag for analytics

    barcode_value: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    barcode_symbology: Mapped[str | None] = mapped_column(String, nullable=True)  # EAN13, UPCA, QRCODE, ...
    product_lookup_source: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "openfoodfacts"
    product_lookup_found: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    inspector_override: Mapped[bool] = mapped_column(Boolean, default=False)
    inspector_override_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    created_by_user: Mapped["User"] = relationship(back_populates="scans")
    violations: Mapped[list["Violation"]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="scan", cascade="all, delete-orphan")


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"))
    rule_id: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "LM_PCR_2011_R6_1_A"
    rule_reference: Mapped[str] = mapped_column(String, nullable=False)  # human readable, e.g. "Rule 6(1)(a)"
    regulation: Mapped[str] = mapped_column(String, default="Legal Metrology (Packaged Commodities) Rules, 2011")
    field: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "net_quantity"
    severity: Mapped[str] = mapped_column(String, default="major")  # minor|major|critical
    description: Mapped[str] = mapped_column(Text, nullable=False)
    detection_method: Mapped[str] = mapped_column(String, default="none")  # regex|keyword|ml_classifier|both|cv_measurement|none
    bounding_box: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {x,y,w,h} on the source image
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    ignored: Mapped[bool] = mapped_column(Boolean, default=False)
    override_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    overridden_by: Mapped[str | None] = mapped_column(String, nullable=True)
    overridden_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    scan: Mapped["Scan"] = relationship(back_populates="violations")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"))
    generated_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    pdf_storage_key: Mapped[str] = mapped_column(String, nullable=False)
    report_type: Mapped[str] = mapped_column(String, default="compliance_notice")  # compliance_notice|qa_summary
    checksum_sha256: Mapped[str] = mapped_column(String, nullable=False)  # tamper-evidence
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    scan: Mapped["Scan"] = relationship(back_populates="reports")


class ChatMessage(Base):
    """Stores Metrology Bot conversation turns for audit/analytics purposes."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String)  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    cited_rules: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
