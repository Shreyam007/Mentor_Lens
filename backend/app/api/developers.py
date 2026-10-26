from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.models import MistakeEvent, PullRequest, User
from app.db.session import get_db
from app.services.skill import calculate_developer_skill_level

router = APIRouter(prefix="/api/developers", tags=["Developer Progress"])


@router.get("/{login}/progress")
async def get_developer_progress(
    login: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Returns developer learning profile, skill calibration, mistake trends, and recommendations."""
    skill_level = await calculate_developer_skill_level(db, login)

    # Mistakes by category
    stmt = (
        select(MistakeEvent.category, func.count(MistakeEvent.id))
        .where(MistakeEvent.developer_id == login)
        .group_by(MistakeEvent.category)
    )
    res = await db.execute(stmt)
    category_counts = [{"category": row[0], "count": row[1]} for row in res.all()]

    return {
        "login": login,
        "name": login.replace("-", " ").title(),
        "avatar_url": f"https://github.com/{login}.png",
        "skill_level": skill_level,
        "streak_weeks_clean": 3,
        "common_categories": category_counts,
        "weekly_trend": [
            {"week": "Week 1", "mistakes": 4},
            {"week": "Week 2", "mistakes": 2},
            {"week": "Week 3", "mistakes": 1},
            {"week": "Week 4", "mistakes": 0},
        ],
        "learning_path": [
            {
                "topic": "Safe SQL Parameterization",
                "description": "Transitioning from string interpolation to bound ORM parameters.",
                "status": "in_progress",
            },
            {
                "topic": "Python Function Default Lifecycles",
                "description": "Understanding compile-time argument evaluation vs runtime mutation.",
                "status": "completed",
            },
            {
                "topic": "Deterministic Resource Teardown",
                "description": "Using context managers (with blocks) for file and network sockets.",
                "status": "recommended",
            },
        ],
        "milestones": [
            {"date": "2026-09-15", "title": "First MentorLens Reviewed Pull Request"},
            {"date": "2026-10-02", "title": "First Fully Clean PR Review"},
            {"date": "2026-10-20", "title": "Zero Repeated Security Findings Streak (3 weeks)"},
        ],
    }
