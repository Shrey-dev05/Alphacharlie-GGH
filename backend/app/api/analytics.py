from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import Role, TokenData, require_roles
from app.db.database import get_db
from app.models.models import Scan, Violation
from app.schemas.schemas import AnalyticsSummary, StateCompliance, ViolationBreakdown

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def summary(
    current: TokenData = Depends(require_roles(Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Nationwide/statewide compliance metrics for the Super Admin
    dashboard: totals, most common violations, and a state-by-state
    compliance-rate breakdown (heatmap-ready)."""
    scans = db.query(Scan).filter(Scan.status == "completed").all()

    total = len(scans)
    compliant = sum(1 for s in scans if s.compliance_status == "compliant")
    non_compliant = sum(1 for s in scans if s.compliance_status == "non_compliant")
    partial = sum(1 for s in scans if s.compliance_status == "partial")
    avg_score = round(sum(s.compliance_score or 0 for s in scans) / total, 1) if total else 0.0

    violation_counter: Counter[str] = Counter()
    for v in db.query(Violation).filter(Violation.passed == False).all():  # noqa: E712
        violation_counter[v.rule_reference] += 1
    top_violations = [ViolationBreakdown(rule_reference=r, count=c) for r, c in violation_counter.most_common(10)]

    state_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "compliant": 0, "non_compliant": 0})
    for s in scans:
        if not s.state:
            continue
        state_stats[s.state]["total"] += 1
        if s.compliance_status == "compliant":
            state_stats[s.state]["compliant"] += 1
        elif s.compliance_status == "non_compliant":
            state_stats[s.state]["non_compliant"] += 1

    state_breakdown = [
        StateCompliance(
            state=state,
            total_scans=stats["total"],
            compliant=stats["compliant"],
            non_compliant=stats["non_compliant"],
            compliance_rate=round((stats["compliant"] / stats["total"]) * 100, 1) if stats["total"] else 0.0,
        )
        for state, stats in state_stats.items()
    ]

    return AnalyticsSummary(
        total_scans=total,
        compliant_scans=compliant,
        non_compliant_scans=non_compliant,
        partial_scans=partial,
        average_compliance_score=avg_score,
        top_violations=top_violations,
        state_breakdown=state_breakdown,
    )
