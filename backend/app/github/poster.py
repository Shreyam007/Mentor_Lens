import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.agents.schemas import Finding, PRReviewState
from app.github.auth import get_installation_token

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
MARKER_REGEX = re.compile(r"<!-- mentorlens:finding:([^\s]+) -->")


def create_finding_marker(finding: Finding) -> str:
    key = f"{finding.file}:{finding.line_start}:{finding.category.value}"
    return f"<!-- mentorlens:finding:{key} -->"


def format_inline_comment_body(finding: Finding, verified_citation_data: Optional[Dict[str, Any]] = None) -> str:
    """
    Renders pedagogical inline comment with Neo-Brutalist structured markdown sections.
    """
    marker = create_finding_marker(finding)
    severity_emoji = {
        "critical": "🔴 **Critical**",
        "warning": "🟡 **Warning**",
        "suggestion": "🔵 **Suggestion**",
        "info": "⚪ **Info**",
    }.get(finding.severity, "⚪ **Note**")

    parts = [
        marker,
        f"{severity_emoji} — **{finding.title}**",
        "",
        "### Why this is risky",
        finding.why_risky,
        "",
        "### How to fix",
        finding.fix,
    ]

    if finding.suggested_code:
        parts.extend([
            "",
            "```suggestion",
            finding.suggested_code.strip(),
            "```",
        ])

    parts.extend([
        "",
        "### From your team's history",
    ])

    if finding.cited_commits and verified_citation_data:
        sha = finding.cited_commits[0]
        cinfo = verified_citation_data.get(sha, {})
        author = cinfo.get("author", "Team Member")
        msg = cinfo.get("message", "Historical bugfix")
        snippet = cinfo.get("diff", "")
        parts.extend([
            f"🛡️ **Verified Team Fix** (`{sha}` by {author}): *\"{msg}\"*",
            "",
            "```diff",
            snippet[:400],
            "```",
        ])
    else:
        parts.append("*No similar past mistake found in repository history — general guidance.*")

    parts.extend([
        "",
        "---",
        "<sub>MentorLens AI • [Helpful 👍](https://mentorlens.dev/feedback?val=helpful) • [Not Helpful 👎](https://mentorlens.dev/feedback?val=not_helpful)</sub>",
    ])

    return "\n".join(parts)


def format_pr_summary(
    state: PRReviewState,
    gate_mode: str = "advisory",
    overflow_findings: Optional[List[Finding]] = None,
    unsupported_files: Optional[List[str]] = None,
) -> str:
    """
    Renders the PR-level review summary comment.
    """
    findings = state.verified_findings
    counts = {"critical": 0, "warning": 0, "suggestion": 0, "info": 0}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    gate_status = "Passing"
    if gate_mode == "blocking" and counts["critical"] > 0:
        gate_status = "Blocking on Critical"
    elif counts["critical"] > 0:
        gate_status = "Needs Attention"

    summary_lines = [
        "## 🔍 MentorLens Code Review Summary",
        "",
        f"**Gate Status:** `{gate_status}` | **Findings:** {len(findings)} ({counts['critical']} critical, {counts['warning']} warning, {counts['suggestion']} suggestion)",
        "",
        "| Severity | Category | File | Line |",
        "|---|---|---|---|",
    ]

    for f in findings:
        summary_lines.append(f"| {f.severity.capitalize()} | `{f.category.value}` | `{f.file}` | {f.line_start} |")

    if overflow_findings:
        summary_lines.extend([
            "",
            f"### Additional Findings ({len(overflow_findings)} overflow items capped by inline limit):",
        ])
        for of in overflow_findings:
            summary_lines.append(f"- **{of.title}** (`{of.file}:{of.line_start}`): {of.why_risky}")

    if unsupported_files:
        summary_lines.extend([
            "",
            "> ℹ️ **Note on unsupported files:** " + ", ".join(f"`{u}`" for u in unsupported_files) + " were not analyzed.",
        ])

    summary_lines.extend([
        "",
        "---",
        "<sub>MentorLens — Context-aware code review that teaches.</sub>",
    ])

    return "\n".join(summary_lines)


class ReviewPoster:
    def __init__(self, installation_id: int):
        self.installation_id = installation_id

    async def get_headers(self) -> Dict[str, str]:
        token = await get_installation_token(self.installation_id)
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def post_or_update_review(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        head_sha: str,
        state: PRReviewState,
        max_inline_comments: int = 10,
        gate_mode: str = "advisory",
        verified_citation_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Posts or updates review comments idempotently on the GitHub Pull Request.
        """
        headers = await self.get_headers()
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Fetch existing comments to prevent duplicates
            comments_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pull_number}/comments"
            existing_res = await client.get(comments_url, headers=headers)
            existing_comments = existing_res.json() if existing_res.status_code == 200 else []

            # Map marker -> comment_id
            existing_marker_map: Dict[str, int] = {}
            for c in existing_comments:
                c_body = c.get("body", "")
                m = MARKER_REGEX.search(c_body)
                if m:
                    existing_marker_map[m.group(0)] = c["id"]

            # 2. Partition inline vs overflow findings
            reviewable_inline = [f for f in state.verified_findings if f.line_start > 0]
            inline_to_post = reviewable_inline[:max_inline_comments]
            overflow = reviewable_inline[max_inline_comments:]

            # 3. Update existing inline comments or prepare batch review
            new_batch_comments = []
            for f in inline_to_post:
                marker = create_finding_marker(f)
                body = format_inline_comment_body(f, verified_citation_data)

                if marker in existing_marker_map:
                    # Update comment in-place
                    comment_id = existing_marker_map[marker]
                    patch_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/comments/{comment_id}"
                    await client.patch(patch_url, headers=headers, json={"body": body})
                else:
                    new_batch_comments.append({
                        "path": f.file,
                        "line": f.line_start,
                        "body": body,
                    })

            # 4. Post batch review for new comments & summary
            summary_body = format_pr_summary(state, gate_mode=gate_mode, overflow_findings=overflow)
            review_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pull_number}/reviews"
            review_payload = {
                "commit_id": head_sha,
                "body": summary_body,
                "event": "COMMENT",
                "comments": new_batch_comments,
            }

            post_res = await client.post(review_url, headers=headers, json=review_payload)
            if post_res.status_code == 422:
                # Fallback: if inline line fails in diff, post PR-level issue comment
                logger.warning("GitHub returned 422 for inline review comments. Falling back to PR summary comment.")
                fallback_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues/{pull_number}/comments"
                await client.post(fallback_url, headers=headers, json={"body": summary_body})

            # 5. Optional Checks API gate
            check_conclusion = "neutral"
            critical_count = sum(1 for f in state.verified_findings if f.severity == "critical")
            if gate_mode == "blocking":
                check_conclusion = "failure" if critical_count > 0 else "success"
            elif gate_mode == "advisory":
                check_conclusion = "neutral"

            check_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/check-runs"
            check_payload = {
                "name": "MentorLens Code Mentor",
                "head_sha": head_sha,
                "status": "completed",
                "conclusion": check_conclusion,
                "output": {
                    "title": f"MentorLens Review: {len(state.verified_findings)} findings",
                    "summary": summary_body[:65000],
                },
            }
            await client.post(check_url, headers=headers, json=check_payload)

            return {
                "status": "posted",
                "inline_updated": len(existing_marker_map),
                "inline_created": len(new_batch_comments),
                "gate_conclusion": check_conclusion,
            }
