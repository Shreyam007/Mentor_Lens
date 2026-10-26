import pytest
from app.agents.schemas import Finding, MistakeCategory
from app.analysis.normalizer import (
    deduplicate_findings,
    filter_findings_to_changed_lines,
    normalize_static_findings,
)
from app.analysis.runner import analyze_code_file, check_python_syntax

VULNERABLE_SQL_CODE = """def query_user(user_id):
    query = "SELECT * FROM accounts WHERE id = '%s'" % user_id
    return query
"""

MUTABLE_DEFAULT_CODE = """def add_item(item, basket=[]):
    basket.append(item)
    return basket
"""

SYNTAX_ERROR_CODE = """def broken_function(
    print("Missing closing parenthesis and colon"
"""


def test_syntax_error_detection():
    finding = check_python_syntax(SYNTAX_ERROR_CODE, "bad.py")
    assert finding is not None
    assert finding.category == MistakeCategory.CODE_QUALITY_SYNTAX_ERROR
    assert finding.severity == "critical"
    assert "Syntax Error" in finding.title


def test_syntax_error_skips_other_tools():
    findings = analyze_code_file("bad.py", SYNTAX_ERROR_CODE)
    assert len(findings) == 1
    assert findings[0].category == MistakeCategory.CODE_QUALITY_SYNTAX_ERROR


def test_bandit_sql_injection_detection():
    findings = analyze_code_file("query.py", VULNERABLE_SQL_CODE)
    # Bandit should catch B608 (hardcoded SQL string)
    sql_findings = [f for f in findings if f.category == MistakeCategory.SECURITY_SQL_INJECTION]
    assert len(sql_findings) >= 1
    assert sql_findings[0].severity == "critical"
    assert "SQL" in sql_findings[0].title


def test_pylint_mutable_default_detection():
    findings = analyze_code_file("basket.py", MUTABLE_DEFAULT_CODE)
    # Pylint should catch W0102 (dangerous default value)
    mutable_findings = [f for f in findings if f.category == MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG]
    assert len(mutable_findings) >= 1
    assert mutable_findings[0].severity == "warning"


def test_filter_findings_to_changed_lines():
    findings = [
        Finding(
            file="auth.py",
            line_start=5,
            line_end=5,
            category=MistakeCategory.SECURITY_SQL_INJECTION,
            severity="critical",
            title="SQL Injection",
            why_risky="Risky",
            fix="Fix",
        ),
        Finding(
            file="auth.py",
            line_start=25,
            line_end=25,
            category=MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG,
            severity="warning",
            title="Mutable Default",
            why_risky="Risky",
            fix="Fix",
        ),
    ]

    # Only line 5 was modified in the diff
    line_map = {5: 10, 6: 11}
    filtered = filter_findings_to_changed_lines(findings, line_map)

    assert len(filtered) == 1
    assert filtered[0].line_start == 5
    assert filtered[0].category == MistakeCategory.SECURITY_SQL_INJECTION


def test_deduplicate_overlapping_findings():
    # Two tools flagging line 10: one critical and one warning
    findings = [
        Finding(
            file="app.py",
            line_start=10,
            line_end=10,
            category=MistakeCategory.GENERAL_GUIDANCE,
            severity="warning",
            title="Warning on 10",
            why_risky="Risky",
            fix="Fix",
            confidence=0.8,
        ),
        Finding(
            file="app.py",
            line_start=10,
            line_end=10,
            category=MistakeCategory.SECURITY_SQL_INJECTION,
            severity="critical",
            title="Critical on 10",
            why_risky="Risky",
            fix="Fix",
            confidence=0.9,
        ),
    ]

    deduped = deduplicate_findings(findings)
    assert len(deduped) == 1
    # Critical must win
    assert deduped[0].severity == "critical"
    assert deduped[0].category == MistakeCategory.SECURITY_SQL_INJECTION


def test_full_normalization_pipeline():
    raw_findings = [
        Finding(
            file="db.py",
            line_start=2,
            line_end=2,
            category=MistakeCategory.SECURITY_SQL_INJECTION,
            severity="critical",
            title="SQL Injection",
            why_risky="Risky",
            fix="Fix",
        ),
        Finding(
            file="db.py",
            line_start=99,
            line_end=99,
            category=MistakeCategory.RESOURCE_UNCLOSED_FILE,
            severity="warning",
            title="Unclosed File",
            why_risky="Risky",
            fix="Fix",
        ),
    ]

    line_map = {2: 4}
    results = normalize_static_findings(raw_findings, line_map)

    assert len(results) == 1
    assert results[0].line_start == 2
    assert results[0].source == "static"
