from typing import Literal, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import MistakeEvent, PullRequest

SkillLevel = Literal["beginner", "intermediate", "advanced"]


async def calculate_developer_skill_level(
    db: AsyncSession,
    developer_id: str,
) -> SkillLevel:
    """
    Calibrates educational review depth based on developer experience and repeat mistakes.
    - If developer has < 3 reviewed PRs: default to "intermediate".
    - If repeated mistakes in last 30 days >= 4: "beginner" (extra teaching depth & explanation).
    - If repeated mistakes == 0 and >= 10 PRs: "advanced" (concise, direct code-level feedback).
    - Otherwise: "intermediate".
    """
    # 1. Count reviewed PRs
    pr_count_stmt = select(func.count(PullRequest.id)).where(PullRequest.author_id == developer_id)
    pr_count_res = await db.execute(pr_count_stmt)
    pr_count = pr_count_res.scalar() or 0

    if pr_count < 3:
        return "intermediate"

    # 2. Count mistake events
    mistake_stmt = select(func.count(MistakeEvent.id)).where(MistakeEvent.developer_id == developer_id)
    mistake_res = await db.execute(mistake_stmt)
    mistake_count = mistake_res.scalar() or 0

    if mistake_count >= 4:
        return "beginner"
    elif mistake_count == 0 and pr_count >= 10:
        return "advanced"

    return "intermediate"
