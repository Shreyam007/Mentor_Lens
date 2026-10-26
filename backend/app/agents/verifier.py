import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from app.agents.schemas import Finding, VerifierResult
from app.rag.store import cosine_similarity, compute_text_embedding_vector, memory_store

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.40


def verify_finding(
    finding: Finding,
    repo_id: str,
    known_commit_shas: Set[str],
    pr_changed_lines: Set[int],
    pr_code_snippet: str,
    commit_data_by_sha: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Tuple[Finding, VerifierResult]:
    """
    Applies the four mandatory verification rules:
    1. Cited SHA exists in the repository history.
    2. Commit actually touches code similar to the PR snippet (similarity >= threshold).
    3. The claim in the comment matches the commit message/diff.
    4. Reported line numbers exist in the PR diff.

    Failure of 1-3 -> verdict: "citation_stripped" (strip cited_commits, keep educational guidance).
    Failure of 4 -> verdict: "rejected" (strip inline location to move to PR summary).
    """
    checks = {
        "sha_exists": True,
        "touches_similar_code": True,
        "claim_matches": True,
        "line_in_diff": True,
    }
    reasons: List[str] = []

    # Rule 4: Reported line numbers exist in PR diff
    if finding.line_start not in pr_changed_lines and finding.line_end not in pr_changed_lines:
        checks["line_in_diff"] = False
        reasons.append(f"Line {finding.line_start} is not within modified lines of the PR diff.")

    # Rules 1-3: Verify cited commits (if any are cited)
    verified_shas: List[str] = []
    if finding.cited_commits:
        for sha in finding.cited_commits:
            # Rule 1: SHA exists in repo history
            if sha not in known_commit_shas:
                checks["sha_exists"] = False
                reasons.append(f"Commit SHA {sha} does not exist in the repository history.")
                continue

            # Get commit data
            cdata = (commit_data_by_sha or {}).get(sha)
            if cdata:
                # Rule 2: Similarity check
                commit_diff = cdata.get("diff", "")
                v_pr = compute_text_embedding_vector(pr_code_snippet)
                v_commit = compute_text_embedding_vector(commit_diff)
                sim = cosine_similarity(v_pr, v_commit)

                if sim < SIMILARITY_THRESHOLD:
                    checks["touches_similar_code"] = False
                    reasons.append(f"Commit {sha} diff similarity ({sim:.2f}) below threshold {SIMILARITY_THRESHOLD}.")
                    continue

                # Rule 3: Claim / Category check
                commit_msg = cdata.get("message", "").lower()
                # Check if commit message has relation to the finding title or category
                finding_keywords = finding.category.value.split(".")
                if not any(kw in commit_msg for kw in finding_keywords) and "fix" not in commit_msg:
                    checks["claim_matches"] = False
                    reasons.append(f"Claim in finding does not match commit message for {sha}.")
                    continue

            verified_shas.append(sha)

    # Determine verdict
    if not checks["line_in_diff"]:
        verdict = "rejected"
        reason = "; ".join(reasons)
        # Move finding to line 0 (PR-level)
        finding_copy = finding.model_copy(update={"line_start": 0, "line_end": 0, "cited_commits": []})
    elif not checks["sha_exists"] or not checks["touches_similar_code"] or not checks["claim_matches"]:
        verdict = "citation_stripped"
        reason = "; ".join(reasons)
        # Strip citations but preserve the educational guidance
        finding_copy = finding.model_copy(update={"cited_commits": []})
    else:
        verdict = "approved"
        reason = "All verification checks passed."
        finding_copy = finding.model_copy(update={"cited_commits": verified_shas})

    result = VerifierResult(
        finding_id=f"{finding.file}:{finding.line_start}",
        verdict=verdict,
        checks=checks,
        reason=reason,
    )

    return finding_copy, result
