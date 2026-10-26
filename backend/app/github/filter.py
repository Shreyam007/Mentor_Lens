import fnmatch
import os
from typing import Any, Dict, List, Optional, Tuple

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".svg",
    ".pdf", ".zip", ".tar", ".gz", ".7z", ".exe", ".dll", ".so", ".dylib",
    ".pyc", ".pyo", ".class", ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".mov", ".avi", ".sqlite", ".db",
}

LOCK_FILENAMES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "pipfile.lock",
    "cargo.lock",
    "composer.lock",
    "gemfile.lock",
}

VENDORED_OR_GENERATED_PATTERNS = [
    "dist/**",
    "build/**",
    "out/**",
    "vendor/**",
    "node_modules/**",
    ".venv/**",
    "venv/**",
    "env/**",
    "*.min.js",
    "*.min.css",
    "*.bundle.js",
    "*.map",
    "*.generated.*",
]

SUPPORTED_LANGUAGES = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
}

SECURITY_SENSITIVE_KEYWORDS = [
    "auth", "login", "signup", "password", "token", "secret", "session",
    "jwt", "crypto", "security", "api", "database", "query", "sql", "exec", "eval"
]


def detect_language(filename: str) -> Optional[str]:
    """Detects primary language from file extension. Returns None if unsupported."""
    _, ext = os.path.splitext(filename.lower())
    return SUPPORTED_LANGUAGES.get(ext)


def is_binary_file(filename: str, patch: Optional[str] = None) -> bool:
    """Checks if a file is binary either by extension or git patch indicator."""
    _, ext = os.path.splitext(filename.lower())
    if ext in BINARY_EXTENSIONS:
        return True
    if patch and ("Binary files " in patch or "GIT binary patch" in patch):
        return True
    return False


def is_lock_file(filename: str) -> bool:
    """Checks if file is a package manager lockfile."""
    basename = os.path.basename(filename.lower())
    return basename in LOCK_FILENAMES


def is_vendored_or_generated(filename: str) -> bool:
    """Checks if path matches standard vendored/generated directories or minified patterns."""
    normalized_path = filename.replace("\\", "/").lower()
    parts = set(normalized_path.split("/"))
    ignored_dirs = {"dist", "build", "out", "vendor", "node_modules", ".venv", "venv", "env"}
    if parts.intersection(ignored_dirs):
        return True

    basename = os.path.basename(normalized_path)
    for pattern in ["*.min.js", "*.min.css", "*.bundle.js", "*.map", "*.generated.*"]:
        if fnmatch.fnmatch(basename, pattern):
            return True
    return False


def matches_user_ignore(filename: str, ignore_patterns: List[str]) -> bool:
    """Checks user-defined glob ignore patterns."""
    normalized_path = filename.replace("\\", "/")
    basename = os.path.basename(normalized_path)
    for pattern in ignore_patterns:
        if fnmatch.fnmatch(normalized_path, pattern) or fnmatch.fnmatch(basename, pattern):
            return True
    return False


def should_skip_file(
    filename: str,
    status: str = "modified",
    patch: Optional[str] = None,
    size_bytes: int = 0,
    user_ignore_patterns: Optional[List[str]] = None,
    max_file_size_bytes: int = 500 * 1024,  # 500 KB
) -> Tuple[bool, str]:
    """
    Evaluates whether a file should be skipped from AI review.
    Returns (should_skip, reason).
    """
    if status == "removed":
        return True, "deleted_file"

    if is_binary_file(filename, patch):
        return True, "binary_file"

    if is_lock_file(filename):
        return True, "lock_file"

    if is_vendored_or_generated(filename):
        return True, "vendored_or_generated"

    if user_ignore_patterns and matches_user_ignore(filename, user_ignore_patterns):
        return True, "user_ignore_pattern"

    if size_bytes > max_file_size_bytes:
        return True, "file_exceeds_size_limit"

    if not patch or not patch.strip():
        return True, "no_diff_patch"

    # Language check
    lang = detect_language(filename)
    if not lang:
        return True, "unsupported_language"

    return False, ""


def should_skip_pr(
    pr_data: Dict[str, Any],
    repo_settings: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, str]:
    """
    Evaluates PR skip rules:
    - Draft PRs (if review_drafts is False)
    - Bot authors (if skip_bots is True)
    - Empty PR / no reviewable changes
    - Closed PR
    """
    settings = repo_settings or {}
    review_drafts = settings.get("review_drafts", False)
    skip_bots = settings.get("skip_bots", True)

    if pr_data.get("state") == "closed":
        return True, "PR is closed"

    if pr_data.get("is_draft") and not review_drafts:
        return True, "Draft PR — skipped per configuration"

    if pr_data.get("is_bot") and skip_bots:
        return True, "Skipped: bot author"

    return False, ""


def prioritize_files_by_risk(files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sorts files so security-sensitive and newly added files are reviewed first.
    """
    def risk_score(item: Dict[str, Any]) -> int:
        score = 0
        fn = item.get("filename", "").lower()
        # Security paths
        if any(keyword in fn for keyword in SECURITY_SENSITIVE_KEYWORDS):
            score += 10
        # New files
        if item.get("status") == "added":
            score += 5
        # Line change size
        score += min(item.get("changes", 0), 20)
        return score

    return sorted(files, key=risk_score, reverse=True)


def apply_size_budget(
    files: List[Dict[str, Any]],
    max_files: int = 40,
    max_lines: int = 1500,
) -> Tuple[List[Dict[str, Any]], bool, str]:
    """
    Applies size budget: caps files and changed lines per review run.
    Returns (accepted_files, is_partial, summary_message).
    """
    total_files = len(files)
    if total_files <= max_files:
        # Check line count
        total_lines = sum(f.get("changes", 0) for f in files)
        if total_lines <= max_lines:
            return files, False, f"Reviewed all {total_files} files"

    # Prioritize by risk
    sorted_files = prioritize_files_by_risk(files)

    accepted: List[Dict[str, Any]] = []
    lines_accumulated = 0

    for f in sorted_files:
        f_lines = f.get("changes", 0)
        if len(accepted) >= max_files or (lines_accumulated + f_lines > max_lines and len(accepted) > 0):
            break
        accepted.append(f)
        lines_accumulated += f_lines

    is_partial = len(accepted) < total_files
    msg = f"Reviewed {len(accepted)} of {total_files} files (capped by size budget)" if is_partial else f"Reviewed all {total_files} files"
    return accepted, is_partial, msg
