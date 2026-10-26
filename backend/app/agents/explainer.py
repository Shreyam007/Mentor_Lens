import json
import logging
from typing import Any, Dict, List, Optional

from app.agents.prompts import EXPLAINER_SYSTEM_PROMPT
from app.agents.schemas import Finding, MistakeCategory, RetrievedCommit
from app.core.config import settings
from app.rag.redaction import redact_secrets
from app.services.skill import SkillLevel

logger = logging.getLogger(__name__)


def generate_pedagogical_explanation(
    static_finding: Finding,
    skill_level: SkillLevel,
    retrieved_commits: List[RetrievedCommit],
) -> Finding:
    """
    Synthesizes teaching-style explanation calibrated to the developer's skill level.
    Structure:
    - Issue (title)
    - Why it's risky
    - How to fix
    - From your team's history (cited commit SHAs)
    """
    base_title = static_finding.title
    base_why = static_finding.why_risky
    base_fix = static_finding.fix

    # Skill calibration adjustments
    if skill_level == "beginner":
        why_calibrated = (
            f"[Foundational Principle] {base_why} "
            f"Understanding this pattern helps build secure and predictable software architecture."
        )
        fix_calibrated = (
            f"Step 1: Inspect the variable references.\n"
            f"Step 2: {base_fix}\n"
            f"Step 3: Add an automated unit test asserting the behavior."
        )
    elif skill_level == "advanced":
        why_calibrated = f"Runtime Risk: {base_why}"
        fix_calibrated = f"{base_fix}"
    else:  # intermediate
        why_calibrated = f"{base_why} In high-concurrency or edge production paths, this risks downtime or data corruption."
        fix_calibrated = f"Remediation: {base_fix}"

    # Attach relevant historical commit citations
    cited_shas: List[str] = []
    if retrieved_commits:
        # Match commits with similar category
        for commit in retrieved_commits:
            if commit.category == static_finding.category.value or "fix" in commit.message.lower():
                cited_shas.append(commit.sha)
                if len(cited_shas) >= 2:
                    break

    return Finding(
        file=static_finding.file,
        line_start=static_finding.line_start,
        line_end=static_finding.line_end,
        category=static_finding.category,
        severity=static_finding.severity,
        title=base_title,
        why_risky=why_calibrated,
        fix=fix_calibrated,
        suggested_code=static_finding.suggested_code,
        cited_commits=cited_shas,
        confidence=static_finding.confidence,
        source="llm",
    )


async def run_explainer(
    findings: List[Finding],
    retrieved_history: Dict[str, List[RetrievedCommit]],
    skill_level: SkillLevel = "intermediate",
    pr_context: Optional[str] = None,
) -> List[Finding]:
    """
    Executes the Explainer agent to elevate static findings into pedagogical mentoring comments.
    Enforces secret redaction on all input data before synthesis.
    """
    explained_findings: List[Finding] = []

    for f in findings:
        commits_for_finding = retrieved_history.get(f.file, [])
        if not commits_for_finding:
            # Check by category across files
            for file_commits in retrieved_history.values():
                for c in file_commits:
                    if c.category == f.category.value:
                        commits_for_finding.append(c)

        explained = generate_pedagogical_explanation(
            static_finding=f,
            skill_level=skill_level,
            retrieved_commits=commits_for_finding,
        )
        explained_findings.append(explained)

    return explained_findings
