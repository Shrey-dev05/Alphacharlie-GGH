"""
Migration script to reconcile existing scans in legal_metrology.db.
Updates violations where extracted packaging declarations had values
(especially expiry_date / best_before) that were previously flagged as defects.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.database import SessionLocal
from app.models.models import Scan
from app.api.scan import _reconcile_scan_declarations, _recalculate_scan_compliance

def run_migration():
    db = SessionLocal()
    try:
        scans = db.query(Scan).all()
        print(f"Total scans to review: {len(scans)}")
        updated_count = 0

        for s in scans:
            if _reconcile_scan_declarations(s, db):
                updated_count += 1
                print(f"Reconciled scan {s.id} ({s.brand_name} - {s.product_name}) -> Score: {s.compliance_score}%, Status: {s.compliance_status}")

        print(f"Migration completed. Successfully reconciled {updated_count} scan(s).")
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
