import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.schemas import MistakeCategory
from app.db.models import CommitIndex, FindingModel, Installation, PullRequest, Repository, ReviewRun
from app.db.session import get_db
from app.rag.store import memory_store

router = APIRouter(prefix="/api/demo", tags=["Demo Mode"])

DEMO_REPO_NAME = "campus-portal"

DELIBERATE_PAST_BUGS = [
    {
        "sha": "a3f21c9",
        "title": "SQL Injection in User Search",
        "category": MistakeCategory.SECURITY_SQL_INJECTION.value,
        "message": "Fix SQL injection vulnerability in user search query (#42)",
        "author": "Rohan Patel",
        "diff": """- query = f"SELECT * FROM users WHERE name LIKE '%{q}%'"
+ query = "SELECT * FROM users WHERE name LIKE :pattern"
+ cursor.execute(query, {"pattern": f"%{q}%"})""",
    },
    {
        "sha": "b4e88a1",
        "title": "Unclosed File Handle in Report Generator",
        "category": MistakeCategory.RESOURCE_UNCLOSED_FILE.value,
        "message": "Fix unclosed file handle leak in report exporter",
        "author": "Ishita Roy",
        "diff": """- f = open(filepath, 'w')
- f.write(data)
+ with open(filepath, 'w', encoding='utf-8') as f:
+     f.write(data)""",
    },
    {
        "sha": "c5d11e2",
        "title": "Mutable Default Argument in Order Basket",
        "category": MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG.value,
        "message": "Fix dangerous mutable default argument in cart items",
        "author": "Meera Sharma",
        "diff": """- def add_item(item, basket=[]):
+ def add_item(item, basket=None):
+     if basket is None: basket = []""",
    },
    {
        "sha": "d6c22f3",
        "title": "Hardcoded Production Secret Key",
        "category": MistakeCategory.SECURITY_HARDCODED_SECRET.value,
        "message": "Remove hardcoded JWT secret key from auth middleware",
        "author": "Aarav Gupta",
        "diff": """- JWT_SECRET = 'super-secret-jwt-key-do-not-share'
+ JWT_SECRET = os.environ.get('JWT_SECRET')""",
    },
]


@router.post("/reset")
async def reset_demo_state(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Resets the demo repository 'campus-portal' with deliberate past bug-fix commits."""
    # Ensure installation exists
    stmt_inst = select(Installation).where(Installation.github_installation_id == 1001)
    inst = (await db.execute(stmt_inst)).scalars().first()
    if not inst:
        inst = Installation(
            github_installation_id=1001,
            account_login="demo-org",
            status="active",
        )
        db.add(inst)
        await db.flush()

    # Ensure demo repo exists
    stmt_repo = select(Repository).where(Repository.full_name == DEMO_REPO_NAME)
    repo = (await db.execute(stmt_repo)).scalars().first()
    if not repo:
        repo = Repository(
            installation_id=inst.id,
            full_name=DEMO_REPO_NAME,
            default_branch="main",
            language_set=["python", "javascript", "typescript"],
            index_status="ready",
        )
        db.add(repo)
        await db.flush()
    else:
        repo.index_status = "ready"

    # Seed the deliberate past bug-fix commits into DB and vector store
    for bug in DELIBERATE_PAST_BUGS:
        stmt_commit = select(CommitIndex).where(
            CommitIndex.repo_id == repo.id,
            CommitIndex.sha == bug["sha"],
        )
        existing = (await db.execute(stmt_commit)).scalars().first()
        if not existing:
            c = CommitIndex(
                repo_id=repo.id,
                sha=bug["sha"],
                message=bug["message"],
                author=bug["author"],
                committed_at=datetime.now(timezone.utc),
                category=bug["category"],
            )
            db.add(c)

        memory_store.upsert_chunk(
            repo_id=repo.id,
            sha=bug["sha"],
            file="app/services.py",
            function="handler",
            category=bug["category"],
            snippet=bug["diff"],
            commit_message=bug["message"],
            author=bug["author"],
            committed_at=datetime.now(timezone.utc).isoformat(),
        )

    await db.commit()

    return {
        "status": "demo_reset_complete",
        "repo": DEMO_REPO_NAME,
        "seeded_commits": len(DELIBERATE_PAST_BUGS),
    }


@router.post("/create-pr")
async def create_demo_pr(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Creates a sample demo pull request with a deliberate SQL injection mistake."""
    stmt_repo = select(Repository).where(Repository.full_name == DEMO_REPO_NAME)
    repo = (await db.execute(stmt_repo)).scalars().first()
    if not repo:
        await reset_demo_state(db)
        repo = (await db.execute(stmt_repo)).scalars().first()

    pr_number = 104
    stmt_pr = select(PullRequest).where(PullRequest.repo_id == repo.id, PullRequest.number == pr_number)
    pr = (await db.execute(stmt_pr)).scalars().first()

    if not pr:
        pr = PullRequest(
            repo_id=repo.id,
            number=pr_number,
            title="feat: add user lookup by query string",
            author_id="meera",
            head_sha="a1b2c3d4",
            base_branch="main",
            state="open",
        )
        db.add(pr)
        await db.flush()

    run = ReviewRun(
        pr_id=pr.id,
        head_sha="a1b2c3d4",
        status="succeeded",
        stage="posted",
        delivery_id=f"demo-deliv-{str(uuid.uuid4())[:8]}",
    )
    db.add(run)
    await db.commit()

    return {
        "status": "demo_pr_created",
        "pr_id": pr.id,
        "pr_number": pr_number,
        "run_id": run.id,
    }


@router.get("/replay")
async def get_offline_replay_feed() -> Dict[str, Any]:
    """Provides recorded offline replay events for reliable viva presentations."""
    return {
        "status": "replay_ready",
        "steps": [
            {"time_ms": 100, "event": "webhook_received", "detail": "POST /webhooks/github delivery 8a1b2c"},
            {"time_ms": 400, "event": "diff_fetched", "detail": "Parsed 1 file with 1 hunk and line map"},
            {"time_ms": 800, "event": "static_analysis", "detail": "Bandit detected B608 (SQL injection) on line 12"},
            {"time_ms": 1200, "event": "retriever_agent", "detail": "Found past bugfix commit a3f21c9 (similarity 0.82)"},
            {"time_ms": 1600, "event": "explainer_agent", "detail": "Synthesized 4-section pedagogical review"},
            {"time_ms": 1900, "event": "verifier_agent", "detail": "Approved citation a3f21c9: SHA exists, claim matches, line in diff"},
            {"time_ms": 2200, "event": "posted_review", "detail": "Batch review posted to GitHub PR #104 with Verified shield badge"},
        ],
    }
