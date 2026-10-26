import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.explainer import run_explainer
from app.agents.schemas import Finding, PRFileContext, PRReviewState, RetrievedCommit
from app.agents.verifier import verify_finding
from app.analysis.normalizer import normalize_static_findings
from app.analysis.runner import analyze_code_file
from app.db.models import CommitIndex, ReviewRun
from app.rag.retriever import retrieve_team_memory
from app.services.skill import calculate_developer_skill_level

logger = logging.getLogger(__name__)


from app.github.diff import extract_new_code_from_patch


async def node_static_analysis(state: PRReviewState, trace: Dict[str, Any]) -> List[Finding]:
    """Node 1: Runs sandboxed static analysis on modified files."""
    start_time = time.time()
    raw_findings: List[Finding] = []

    for file_ctx in state.files:
        if file_ctx.status == "removed":
            continue
        # Extract clean executable code representation from patch
        clean_code = extract_new_code_from_patch(file_ctx.patch)
        file_findings = analyze_code_file(file_ctx.filename, clean_code)
        # Normalize and filter to changed lines
        normalized = normalize_static_findings(file_findings, file_ctx.line_map)
        raw_findings.extend(normalized)

    duration_ms = int((time.time() - start_time) * 1000)
    trace["static_analysis"] = {
        "status": "success",
        "duration_ms": duration_ms,
        "findings_count": len(raw_findings),
    }
    return raw_findings


async def node_retriever(
    state: PRReviewState,
    repo_id: str,
    trace: Dict[str, Any],
) -> Dict[str, List[RetrievedCommit]]:
    """Node 2: Retrieves similar past bug-fix commits from ChromaDB team memory."""
    start_time = time.time()
    history: Dict[str, List[RetrievedCommit]] = {}

    for finding in state.static_findings:
        search_res = retrieve_team_memory(
            repo_id=repo_id,
            pr_snippet=finding.fix,
            category=finding.category.value,
            top_k=2,
        )
        if search_res.get("status") == "found":
            history[finding.file] = search_res.get("commits", [])

    duration_ms = int((time.time() - start_time) * 1000)
    trace["retriever"] = {
        "status": "success",
        "duration_ms": duration_ms,
        "citations_retrieved": sum(len(c) for c in history.values()),
    }
    return history


async def node_explainer(
    state: PRReviewState,
    db: AsyncSession,
    trace: Dict[str, Any],
) -> List[Finding]:
    """Node 3: Explainer agent synthesizes pedagogical comments calibrated to skill."""
    start_time = time.time()
    skill_level = await calculate_developer_skill_level(db, state.author)

    drafts = await run_explainer(
        findings=state.static_findings,
        retrieved_history=state.retrieved_history,
        skill_level=skill_level,
    )

    duration_ms = int((time.time() - start_time) * 1000)
    trace["explainer"] = {
        "status": "success",
        "duration_ms": duration_ms,
        "skill_level": skill_level,
        "drafts_count": len(drafts),
    }
    return drafts


async def node_verifier(
    state: PRReviewState,
    repo_id: str,
    db: AsyncSession,
    trace: Dict[str, Any],
) -> List[Finding]:
    """Node 4: Fact-checks every cited SHA, claim, and line position."""
    start_time = time.time()

    # Load all known commit SHAs for this repository
    stmt = select(CommitIndex.sha).where(CommitIndex.repo_id == repo_id)
    res = await db.execute(stmt)
    known_shas: Set[str] = set(res.scalars().all())

    # Build map of changed line numbers per file
    changed_lines_by_file: Dict[str, Set[int]] = {}
    for f in state.files:
        changed_lines_by_file[f.filename] = set(f.line_map.keys())

    verified: List[Finding] = []
    decisions: List[Dict[str, Any]] = []

    for draft in state.draft_findings:
        pr_lines = changed_lines_by_file.get(draft.file, set())
        # Find file patch
        file_patch = next((f.patch for f in state.files if f.filename == draft.file), "")

        verified_finding, result = verify_finding(
            finding=draft,
            repo_id=repo_id,
            known_commit_shas=known_shas,
            pr_changed_lines=pr_lines,
            pr_code_snippet=file_patch,
        )
        verified.append(verified_finding)
        decisions.append({
            "finding_id": result.finding_id,
            "verdict": result.verdict,
            "checks": result.checks,
            "reason": result.reason,
        })

    duration_ms = int((time.time() - start_time) * 1000)
    trace["verifier"] = {
        "status": "success",
        "duration_ms": duration_ms,
        "decisions": decisions,
    }
    return verified


async def run_review_pipeline(
    db: AsyncSession,
    run_id: str,
    repo_id: str,
    repo_name: str,
    pr_id: str,
    head_sha: str,
    author: str,
    files: List[PRFileContext],
) -> PRReviewState:
    """
    Executes the multi-agent pipeline and persists trace into review_runs.trace_json.
    """
    trace: Dict[str, Any] = {
        "started_at": time.time(),
        "stages": {},
    }

    state = PRReviewState(
        pr_id=pr_id,
        run_id=run_id,
        repo_name=repo_name,
        head_sha=head_sha,
        author=author,
        files=files,
    )

    try:
        # Stage 1: Static Analysis
        state.static_findings = await node_static_analysis(state, trace["stages"])

        # Stage 2: Retriever Agent
        state.retrieved_history = await node_retriever(state, repo_id, trace["stages"])

        # Stage 3: Explainer Agent
        state.draft_findings = await node_explainer(state, db, trace["stages"])

        # Stage 4: Verifier Agent
        state.verified_findings = await node_verifier(state, repo_id, db, trace["stages"])

        trace["finished_at"] = time.time()
        trace["status"] = "success"

    except Exception as e:
        logger.exception(f"Pipeline error for run {run_id}: {e}")
        trace["finished_at"] = time.time()
        trace["status"] = "degraded"
        trace["error"] = str(e)
        # In degraded mode, fall back to static findings without citations
        state.verified_findings = [
            f.model_copy(update={"cited_commits": []}) for f in state.static_findings
        ]

    # Persist trace into ReviewRun
    stmt = select(ReviewRun).where(ReviewRun.id == run_id)
    res = await db.execute(stmt)
    run_obj = res.scalars().first()
    if run_obj:
        run_obj.trace_json = trace
        run_obj.stage = "verified"
        await db.commit()

    state.trace = trace
    return state
