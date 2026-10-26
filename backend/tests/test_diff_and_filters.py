import pytest
from app.github.diff import parse_unified_diff
from app.github.filter import (
    apply_size_budget,
    detect_language,
    is_binary_file,
    is_lock_file,
    is_vendored_or_generated,
    matches_user_ignore,
    prioritize_files_by_risk,
    should_skip_file,
    should_skip_pr,
)

SAMPLE_DIFF = """@@ -10,6 +10,8 @@ def authenticate(user, password):
     if not user:
         return False
-    query = f"SELECT * FROM users WHERE name = '{user}'"
+    query = "SELECT * FROM users WHERE name = :user"
+    params = {"user": user}
     cursor.execute(query)
     return True
"""

SAMPLE_MULTI_HUNK_DIFF = """@@ -1,4 +1,4 @@
-import os
+import os, sys
 import logging
 
 def calculate():
@@ -20,5 +20,6 @@ def run():
     print("start")
-    val = 1
+    val = 2
+    print(val)
"""


def test_line_map_and_position():
    """
    Verifies that file line numbers map accurately to GitHub's diff position.
    Line 10 (context): position 1
    Line 11 (context): position 2
    Line 12 (delete): position 3 (not mapped to new file line)
    Line 12 (add): position 4 -> mapped: line 12 -> position 4
    Line 13 (add): position 5 -> mapped: line 13 -> position 5
    Line 14 (context): position 6 -> mapped: line 14 -> position 6
    """
    parsed = parse_unified_diff(SAMPLE_DIFF, filename="auth.py")
    assert len(parsed.hunks) == 1
    hunk = parsed.hunks[0]
    assert hunk.old_start == 10
    assert hunk.new_start == 10

    # Test line map: @@ is pos 1, line 10 is pos 2, line 11 is pos 3, delete is pos 4, add line 12 is pos 5
    assert 12 in parsed.line_map
    assert parsed.line_map[12] == 5  # New line 12 is at diff position 5
    assert 13 in parsed.line_map
    assert parsed.line_map[13] == 6  # New line 13 is at diff position 6
    assert parsed.additions == 2
    assert parsed.deletions == 1


def test_crlf_normalization():
    crlf_diff = SAMPLE_DIFF.replace("\n", "\r\n")
    parsed = parse_unified_diff(crlf_diff, filename="auth.py")
    assert len(parsed.hunks) == 1
    assert parsed.line_map[12] == 5
    assert parsed.line_map[13] == 6


def test_multi_hunk_diff():
    parsed = parse_unified_diff(SAMPLE_MULTI_HUNK_DIFF, filename="calc.py")
    assert len(parsed.hunks) == 2
    # Hunk 1 has 1 add
    assert parsed.additions == 3  # 1 in hunk 1, 2 in hunk 2


def test_binary_file_detection():
    assert is_binary_file("logo.png") is True
    assert is_binary_file("archive.zip") is True
    assert is_binary_file("binary.so") is True
    assert is_binary_file("app.py", patch="Binary files a/app.py and b/app.py differ") is True
    assert is_binary_file("script.py", patch="+ print('hello')") is False


def test_lock_file_detection():
    assert is_lock_file("package-lock.json") is True
    assert is_lock_file("poetry.lock") is True
    assert is_lock_file("pnpm-lock.yaml") is True
    assert is_lock_file("package.json") is False


def test_vendored_or_generated_detection():
    assert is_vendored_or_generated("dist/bundle.js") is True
    assert is_vendored_or_generated("frontend/dist/index.html") is True
    assert is_vendored_or_generated("src/app.min.js") is True
    assert is_vendored_or_generated("vendor/autoload.php") is True
    assert is_vendored_or_generated("src/components/Button.tsx") is False


def test_user_ignore_patterns():
    user_ignores = ["*.lock", "generated/**", "docs/*.md"]
    assert matches_user_ignore("yarn.lock", user_ignores) is True
    assert matches_user_ignore("generated/types.ts", user_ignores) is True
    assert matches_user_ignore("docs/runbook.md", user_ignores) is True
    assert matches_user_ignore("src/main.py", user_ignores) is False


def test_language_detection():
    assert detect_language("backend/app/main.py") == "python"
    assert detect_language("frontend/src/App.tsx") == "typescript"
    assert detect_language("script.js") == "javascript"
    assert detect_language("styles.css") is None
    assert detect_language("README.md") is None


def test_should_skip_file():
    # Deleted file
    skip, reason = should_skip_file("old.py", status="removed")
    assert skip is True
    assert reason == "deleted_file"

    # Binary
    skip, reason = should_skip_file("photo.jpg", status="modified")
    assert skip is True
    assert reason == "binary_file"

    # Unsupported language
    skip, reason = should_skip_file("styles.css", status="modified", patch="+ body {}")
    assert skip is True
    assert reason == "unsupported_language"

    # Valid Python file
    skip, reason = should_skip_file("backend/app/main.py", status="modified", patch=SAMPLE_DIFF)
    assert skip is False
    assert reason == ""


def test_should_skip_pr():
    # Draft PR when review_drafts is False
    skip, reason = should_skip_pr({"is_draft": True, "state": "open"}, {"review_drafts": False})
    assert skip is True
    assert "Draft PR" in reason

    # Bot PR when skip_bots is True
    skip, reason = should_skip_pr({"is_bot": True, "state": "open"}, {"skip_bots": True})
    assert skip is True
    assert "bot author" in reason

    # Normal PR
    skip, reason = should_skip_pr({"is_draft": False, "is_bot": False, "state": "open"})
    assert skip is False


def test_size_budget_and_risk_prioritization():
    files = [
        {"filename": "docs/readme.py", "status": "modified", "changes": 50},
        {"filename": "app/auth/login.py", "status": "added", "changes": 40},
        {"filename": "app/utils.py", "status": "modified", "changes": 20},
    ]

    prioritized = prioritize_files_by_risk(files)
    # Security-sensitive added file 'app/auth/login.py' must be ranked first
    assert prioritized[0]["filename"] == "app/auth/login.py"

    # Apply size budget with max 2 files
    accepted, is_partial, msg = apply_size_budget(files, max_files=2, max_lines=100)
    assert len(accepted) == 2
    assert is_partial is True
    assert "Reviewed 2 of 3 files" in msg
    assert accepted[0]["filename"] == "app/auth/login.py"
