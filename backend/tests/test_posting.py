import pytest
import respx
from httpx import Response

from app.agents.schemas import Finding, MistakeCategory, PRReviewState
from app.github.poster import (
    ReviewPoster,
    create_finding_marker,
    format_inline_comment_body,
    format_pr_summary,
)


@pytest.fixture
def sample_review_state():
    finding = Finding(
        file="app/auth.py",
        line_start=12,
        line_end=12,
        category=MistakeCategory.SECURITY_SQL_INJECTION,
        severity="critical",
        title="SQL Injection Vulnerability",
        why_risky="Unescaped input in query allows unauthorized data extraction.",
        fix="Use parameterized queries.",
        suggested_code="cursor.execute('SELECT * FROM users WHERE id = :id', {'id': user_id})",
        cited_commits=["a3f21c9"],
    )

    return PRReviewState(
        pr_id="pr-123",
        run_id="run-456",
        repo_name="acme/campus-portal",
        head_sha="sha999",
        author="meera",
        files=[],
        verified_findings=[finding],
    )


@respx.mock
@pytest.mark.asyncio
async def test_initial_review_posting(sample_review_state):
    poster = ReviewPoster(installation_id=123)

    # 1. Mock existing comments GET (empty)
    respx.get("https://api.github.com/repos/acme/campus-portal/pulls/10/comments").mock(
        return_value=Response(200, json=[])
    )

    # 2. Mock batch review POST
    review_route = respx.post("https://api.github.com/repos/acme/campus-portal/pulls/10/reviews").mock(
        return_value=Response(200, json={"id": 1, "state": "COMMENTED"})
    )

    # 3. Mock Check run POST
    check_route = respx.post("https://api.github.com/repos/acme/campus-portal/check-runs").mock(
        return_value=Response(201, json={"id": 99, "status": "completed"})
    )

    citation_data = {
        "a3f21c9": {
            "author": "Rohan",
            "message": "Fix SQL injection",
            "diff": "+ cursor.execute(query, params)",
        }
    }

    res = await poster.post_or_update_review(
        owner="acme",
        repo="campus-portal",
        pull_number=10,
        head_sha="sha999",
        state=sample_review_state,
        gate_mode="blocking",
        verified_citation_data=citation_data,
    )

    assert res["status"] == "posted"
    assert res["inline_created"] == 1
    assert res["gate_conclusion"] == "failure"  # 1 critical finding in blocking mode
    assert review_route.called
    assert check_route.called


@respx.mock
@pytest.mark.asyncio
async def test_update_on_synchronize_idempotency(sample_review_state):
    poster = ReviewPoster(installation_id=123)

    # Finding marker
    marker = create_finding_marker(sample_review_state.verified_findings[0])

    # 1. Mock existing comments GET returning comment with existing marker
    respx.get("https://api.github.com/repos/acme/campus-portal/pulls/10/comments").mock(
        return_value=Response(
            200,
            json=[
                {
                    "id": 8888,
                    "body": f"{marker}\nOld comment body",
                }
            ],
        )
    )

    # 2. Mock PATCH for existing comment
    patch_route = respx.patch("https://api.github.com/repos/acme/campus-portal/pulls/comments/8888").mock(
        return_value=Response(200, json={"id": 8888})
    )

    # 3. Mock batch review POST (for summary)
    respx.post("https://api.github.com/repos/acme/campus-portal/pulls/10/reviews").mock(
        return_value=Response(200, json={"id": 2})
    )

    # 4. Mock Check run POST
    respx.post("https://api.github.com/repos/acme/campus-portal/check-runs").mock(
        return_value=Response(201, json={"id": 100})
    )

    res = await poster.post_or_update_review(
        owner="acme",
        repo="campus-portal",
        pull_number=10,
        head_sha="sha999",
        state=sample_review_state,
        gate_mode="advisory",
    )

    assert res["status"] == "posted"
    assert res["inline_updated"] == 1
    assert res["inline_created"] == 0  # No new duplicate comment created!
    assert res["gate_conclusion"] == "neutral"  # advisory mode
    assert patch_route.called


@respx.mock
@pytest.mark.asyncio
async def test_fallback_on_422_line_not_in_diff(sample_review_state):
    poster = ReviewPoster(installation_id=123)

    respx.get("https://api.github.com/repos/acme/campus-portal/pulls/10/comments").mock(
        return_value=Response(200, json=[])
    )

    # Simulate GitHub returning 422 for outdated diff position
    respx.post("https://api.github.com/repos/acme/campus-portal/pulls/10/reviews").mock(
        return_value=Response(422, json={"message": "Validation Failed", "errors": ["Line not in diff"]})
    )

    # Fallback issue comment
    fallback_route = respx.post("https://api.github.com/repos/acme/campus-portal/issues/10/comments").mock(
        return_value=Response(201, json={"id": 777})
    )

    respx.post("https://api.github.com/repos/acme/campus-portal/check-runs").mock(
        return_value=Response(201, json={"id": 101})
    )

    res = await poster.post_or_update_review(
        owner="acme",
        repo="campus-portal",
        pull_number=10,
        head_sha="sha999",
        state=sample_review_state,
    )

    assert res["status"] == "posted"
    assert fallback_route.called
