import re
from typing import Optional, Tuple
from app.agents.schemas import MistakeCategory

BUG_FIX_PATTERNS = [
    (r"\b(cve-\d{4}-\d+|vulnerability|injection|xss|sqli|rce|traversal|sql)\b", MistakeCategory.SECURITY_SQL_INJECTION),
    (r"\b(secret|token|credential|api[_\s-]?key|password)\b", MistakeCategory.SECURITY_HARDCODED_SECRET),
    (r"\b(unclosed|file[_\s-]?handle|leak|resource[_\s-]?leak)\b", MistakeCategory.RESOURCE_UNCLOSED_FILE),
    (r"\b(mutable[_\s-]?default|default[_\s-]?arg)\b", MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG),
    (r"\b(bare[_\s-]?except|broad[_\s-]?except)\b", MistakeCategory.PYTHON_BARE_EXCEPT),
    (r"\b(race[_\s-]?condition|concurrency|deadlock|mutex|lock)\b", MistakeCategory.CONCURRENCY_RACE_CONDITION),
    (r"\b(off[_\s-]?by[_\s-]?one|boundary|index[_\s-]?error|overflow)\b", MistakeCategory.LOGIC_OFF_BY_ONE),
    (r"\b(fix|bug|patch|resolve|revert|closes?|fixed)\b", MistakeCategory.GENERAL_GUIDANCE),
]

ISSUE_REF_REGEX = re.compile(r"#\d+|\b(?:gh|issue)-\d+\b", re.IGNORECASE)


def is_bugfix_commit(message: str) -> Tuple[bool, MistakeCategory]:
    """
    Evaluates whether a commit is a bug-fix based on commit message heuristics.
    Returns (is_bugfix, category).
    """
    lower_msg = message.lower()

    # Check for issue reference e.g. "Closes #12"
    has_issue = bool(ISSUE_REF_REGEX.search(lower_msg))

    for pattern, category in BUG_FIX_PATTERNS:
        if re.search(pattern, lower_msg):
            return True, category

    if has_issue and ("fix" in lower_msg or "patch" in lower_msg or "bug" in lower_msg):
        return True, MistakeCategory.GENERAL_GUIDANCE

    return False, MistakeCategory.GENERAL_GUIDANCE
