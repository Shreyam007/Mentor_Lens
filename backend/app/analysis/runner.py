import ast
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Any, Dict, List, Optional, Tuple

from app.agents.schemas import Finding, MistakeCategory
from app.services.taxonomy import PYLINT_RULE_MAP, map_bandit_rule, map_pylint_rule

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15
MAX_OUTPUT_BYTES = 1024 * 1024  # 1 MB output limit


def check_python_syntax(code: str, filename: str) -> Optional[Finding]:
    """
    Checks for Python syntax errors before executing linters.
    Returns a Finding if syntax error is present, else None.
    """
    try:
        ast.parse(code, filename=filename)
        return None
    except SyntaxError as e:
        line = e.lineno or 1
        return Finding(
            file=filename,
            line_start=line,
            line_end=line,
            category=MistakeCategory.CODE_QUALITY_SYNTAX_ERROR,
            severity="critical",
            title=f"Syntax Error: {e.msg}",
            why_risky="Code contains invalid syntax and will fail immediately during import or runtime.",
            fix=f"Correct line {line}: {e.text.strip() if e.text else ''}",
            confidence=1.0,
            source="static",
        )


def run_bandit(temp_dir: str, file_rel_path: str) -> List[Dict[str, Any]]:
    """Runs Bandit in a sandboxed directory with timeout and json output."""
    cmd = [sys.executable, "-m", "bandit", "-f", "json", "-q", file_rel_path]
    try:
        proc = subprocess.run(
            cmd,
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        if proc.stdout:
            data = json.loads(proc.stdout[:MAX_OUTPUT_BYTES])
            return data.get("results", [])
    except subprocess.TimeoutExpired:
        logger.warning(f"Bandit timed out after {TIMEOUT_SECONDS}s on {file_rel_path}")
    except Exception as e:
        logger.warning(f"Bandit run error on {file_rel_path}: {e}")
    return []


def run_pylint(temp_dir: str, file_rel_path: str) -> List[Dict[str, Any]]:
    """Runs Pylint in a sandboxed directory with timeout and json output."""
    cmd = [
        sys.executable,
        "-m",
        "pylint",
        "--output-format=json",
        "--score=no",
        "--disable=all",
        "--enable=W0102,W0702,E0001,dangerous-default-value,bare-except,syntax-error",
        file_rel_path,
    ]
    try:
        proc = subprocess.run(
            cmd,
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        if proc.stdout:
            return json.loads(proc.stdout[:MAX_OUTPUT_BYTES])
    except subprocess.TimeoutExpired:
        logger.warning(f"Pylint timed out after {TIMEOUT_SECONDS}s on {file_rel_path}")
    except Exception as e:
        logger.warning(f"Pylint run error on {file_rel_path}: {e}")
    return []


def analyze_code_file(filename: str, content: str) -> List[Finding]:
    """
    Sandboxes file content in a temp directory and executes static analysis runners.
    Never executes PR code, only parses and analyzes AST/tokens.
    """
    findings: List[Finding] = []

    # Check for syntax error first
    if filename.endswith(".py"):
        syntax_err = check_python_syntax(content, filename)
        if syntax_err:
            # Report syntax error finding and skip further tool runs for this file
            return [syntax_err]

    temp_dir = tempfile.mkdtemp(prefix="mentorlens_analysis_")
    try:
        # Write code to sandboxed temp directory
        temp_file_path = os.path.join(temp_dir, os.path.basename(filename))
        with open(temp_file_path, "w", encoding="utf-8") as f:
            f.write(content)

        rel_name = os.path.basename(filename)

        if filename.endswith(".py"):
            # 1. Run Bandit
            bandit_results = run_bandit(temp_dir, rel_name)
            for res in bandit_results:
                test_id = res.get("test_id", "")
                line_no = res.get("line_number", 1)
                issue_text = res.get("issue_text", "")
                cat, sev, title, why_risky, fix = map_bandit_rule(test_id, issue_text)

                findings.append(
                    Finding(
                        file=filename,
                        line_start=line_no,
                        line_end=line_no,
                        category=cat,
                        severity=sev,
                        title=title,
                        why_risky=why_risky,
                        fix=fix,
                        suggested_code=res.get("code", "").strip() or None,
                        confidence=0.9,
                        source="static",
                    )
                )

            # 2. Run Pylint
            pylint_results = run_pylint(temp_dir, rel_name)
            for res in pylint_results:
                symbol = res.get("symbol", "")
                msg_id = res.get("message-id", "")
                lookup_key = symbol if symbol in PYLINT_RULE_MAP else msg_id
                line_no = res.get("line", 1)
                msg = res.get("message", "")
                cat, sev, title, why_risky, fix = map_pylint_rule(lookup_key, msg)

                findings.append(
                    Finding(
                        file=filename,
                        line_start=line_no,
                        line_end=line_no,
                        category=cat,
                        severity=sev,
                        title=title,
                        why_risky=why_risky,
                        fix=fix,
                        confidence=0.85,
                        source="static",
                    )
                )

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return findings
