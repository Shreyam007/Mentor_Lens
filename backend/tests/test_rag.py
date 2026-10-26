import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import select

from app.agents.schemas import MistakeCategory
from app.db.init_db import init_db
from app.db.models import Installation, Repository
from app.db.session import AsyncSessionLocal
from app.rag.heuristics import is_bugfix_commit
from app.rag.ingestion import run_repo_ingestion
from app.rag.redaction import redact_secrets
from app.rag.retriever import retrieve_team_memory
from app.rag.store import memory_store


def test_secret_redaction():
    text_with_secrets = """
    # Configuration
    AWS_ACCESS_KEY = "AKIA1234567890ABCDEF"
    ANTHROPIC_KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456"
    password = 'SuperSecretPassword123!'
    """
    clean_text = redact_secrets(text_with_secrets)
    assert "AKIA1234567890ABCDEF" not in clean_text
    assert "[REDACTED_AWS_KEY]" in clean_text
    assert "sk-ant-api03" not in clean_text
    assert "[REDACTED_ANTHROPIC_KEY]" in clean_text
    assert "SuperSecretPassword123!" not in clean_text
    assert "[REDACTED_SECRET]" in clean_text


def test_bugfix_heuristics():
    is_bf, cat = is_bugfix_commit("Fix critical SQL injection vulnerability in user login")
    assert is_bf is True
    assert cat == MistakeCategory.SECURITY_SQL_INJECTION

    is_bf, cat = is_bugfix_commit("Patch unclosed file handle leak in report exporter (closes #44)")
    assert is_bf is True
    assert cat == MistakeCategory.RESOURCE_UNCLOSED_FILE

    is_bf, cat = is_bugfix_commit("Remove mutable default list argument in handler")
    assert is_bf is True
    assert cat == MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG

    is_bf, _ = is_bugfix_commit("Update documentation and bump copyright year")
    assert is_bf is False


@pytest.mark.asyncio
async def test_repo_ingestion_and_retriever():
    await init_db()
    repo_uid = str(uuid.uuid4())

    async with AsyncSessionLocal() as session:
        inst = Installation(
            github_installation_id=int(uuid.uuid4().int % 10000000),
            account_login="acme-corp",
            status="active",
        )
        session.add(inst)
        await session.flush()

        repo = Repository(
            id=repo_uid,
            installation_id=inst.id,
            full_name=f"acme-corp/test-rag-{repo_uid[:8]}",
            default_branch="main",
        )
        session.add(repo)
        await session.commit()

    # Sample commit history with SQL injection bug fix
    sample_commits = [
        {
            "sha": "a3f21c9",
            "message": "Fix SQL injection vulnerability in account authentication (#104)",
            "author": "Rohan Patel",
            "committed_at": datetime.now(timezone.utc).isoformat(),
            "file": "app/auth.py",
            "diff": """- query = f"SELECT * FROM users WHERE email = '{email}'"
+ query = "SELECT * FROM users WHERE email = :email"
+ cursor.execute(query, {"email": email})""",
            "function": "authenticate_user",
        },
        {
            "sha": "b7e41d2",
            "message": "Fix mutable default argument in cart calculation",
            "author": "Ishita Roy",
            "committed_at": datetime.now(timezone.utc).isoformat(),
            "file": "app/cart.py",
            "diff": """- def calc_cart(items=[]):
+ def calc_cart(items=None):
+     if items is None: items = []""",
            "function": "calc_cart",
        },
        {
            "sha": "c9a00f1",
            "message": "Refactor UI styling tokens",
            "author": "Meera Sharma",
            "committed_at": datetime.now(timezone.utc).isoformat(),
            "file": "styles.css",
            "diff": "+ color: red;",
            "function": "styles",
        },
    ]

    stages_recorded = []

    def on_progress(stage, cur, tot):
        stages_recorded.append(stage)

    async with AsyncSessionLocal() as session:
        result = await run_repo_ingestion(
            db=session,
            repo_id=repo_uid,
            commits_data=sample_commits,
            progress_callback=on_progress,
        )
        assert result["status"] == "ready"
        assert result["bugfix_commits_indexed"] == 2  # Only the 2 bugfix commits indexed

    assert "fetching_commits" in stages_recorded
    assert "extracting_bugfixes" in stages_recorded
    assert "embedding" in stages_recorded
    assert "ready" in stages_recorded

    # Now query Retriever with a similar vulnerable PR code snippet
    pr_vulnerable_snippet = """
    query = f"SELECT * FROM users WHERE email = '{user_email}'"
    db.execute(query)
    """

    search_result = retrieve_team_memory(
        repo_id=repo_uid,
        pr_snippet=pr_vulnerable_snippet,
        category=MistakeCategory.SECURITY_SQL_INJECTION.value,
        top_k=2,
    )

    assert search_result["status"] == "found"
    assert search_result["count"] >= 1
    top_hit = search_result["commits"][0]
    assert top_hit.sha == "a3f21c9"
    assert "SQL injection" in top_hit.message
    assert "cursor.execute" in top_hit.diff_snippet


@pytest.mark.asyncio
async def test_cold_start_detection():
    # Empty repo with no historical bugfixes
    empty_repo_id = str(uuid.uuid4())
    search_result = retrieve_team_memory(
        repo_id=empty_repo_id,
        pr_snippet="def process(): pass",
    )
    assert search_result["status"] == "no_history"
    assert len(search_result["commits"]) == 0
    assert "general guidance" in search_result["message"]


@pytest.mark.asyncio
async def test_stale_commit_exclusion():
    repo_uid = str(uuid.uuid4())
    sha_to_rewrite = "deadbeef123"

    memory_store.upsert_chunk(
        repo_id=repo_uid,
        sha=sha_to_rewrite,
        file="auth.py",
        function="login",
        category=MistakeCategory.SECURITY_SQL_INJECTION.value,
        snippet="fixed sql vulnerability",
        commit_message="Fix SQL injection",
        author="Dev",
        committed_at=datetime.now(timezone.utc).isoformat(),
        is_stale=False,
    )

    # Verify hit before marking stale
    res1 = retrieve_team_memory(repo_uid, "sql vulnerability", min_similarity=0.3)
    assert res1["status"] == "found"

    # Mark as stale (history rewritten)
    memory_store.mark_stale(repo_uid, [sha_to_rewrite])

    # Verify excluded after marking stale
    res2 = retrieve_team_memory(repo_uid, "sql vulnerability", min_similarity=0.3)
    assert res2["status"] == "no_history"
