from typing import Dict, Tuple
from app.agents.schemas import MistakeCategory

BANDIT_RULE_MAP: Dict[str, Tuple[MistakeCategory, str, str, str, str]] = {
    # rule_id -> (category, severity, title, why_risky, fix)
    "B608": (
        MistakeCategory.SECURITY_SQL_INJECTION,
        "critical",
        "Hardcoded SQL string formatting detected",
        "Constructing SQL statements via string formatting or interpolation opens the application to SQL injection attacks, allowing attackers to access, alter, or delete database records.",
        "Use parameterized queries or ORM query abstractions with bind parameters.",
    ),
    "B105": (
        MistakeCategory.SECURITY_HARDCODED_SECRET,
        "critical",
        "Possible hardcoded password string",
        "Committing credentials directly into source code risks leaking production keys to unauthorized team members or third parties via version control.",
        "Store secrets in environment variables or a secret vault (e.g. AWS Secrets Manager, Doppler) and load them at runtime.",
    ),
    "B106": (
        MistakeCategory.SECURITY_HARDCODED_SECRET,
        "critical",
        "Hardcoded secret token detected",
        "Hardcoded secrets can be easily extracted from code repositories and decompiled binaries.",
        "Extract secret credentials into environment variables or secure keyrings.",
    ),
    "B307": (
        MistakeCategory.SECURITY_UNSAFE_EVAL,
        "critical",
        "Use of unsafe eval function",
        "eval() executes arbitrary strings as Python expressions. If user-controlled input reaches eval, it can lead to full remote code execution.",
        "Use ast.literal_eval for parsing primitive data types or serialize via json.",
    ),
    "B110": (
        MistakeCategory.PYTHON_BARE_EXCEPT,
        "warning",
        "Empty or bare except clause",
        "Catching broad exceptions without logging or re-raising swallows unexpected errors and system signals like KeyboardInterrupt, making debugging difficult.",
        "Catch specific exception types (e.g. ValueError, KeyError) and log error details.",
    ),
}

PYLINT_RULE_MAP: Dict[str, Tuple[MistakeCategory, str, str, str, str]] = {
    "W0102": (
        MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG,
        "warning",
        "Dangerous default value used as argument",
        "In Python, default arguments are evaluated once at function definition time. Using mutable defaults (such as list, dict, or set) causes state to be shared across all invocations.",
        "Use None as default value and initialize the mutable object inside the function body.",
    ),
    "dangerous-default-value": (
        MistakeCategory.PYTHON_MUTABLE_DEFAULT_ARG,
        "warning",
        "Dangerous default value used as argument",
        "In Python, default arguments are evaluated once at function definition time. Using mutable defaults (such as list, dict, or set) causes state to be shared across all invocations.",
        "Use None as default value and initialize the mutable object inside the function body.",
    ),
    "W0702": (
        MistakeCategory.PYTHON_BARE_EXCEPT,
        "warning",
        "Bare exception handler",
        "A bare 'except:' clause catches SystemExit and KeyboardInterrupt, preventing normal program termination.",
        "Specify the exact exception class you intend to handle (e.g. 'except Exception:' or 'except IOError:').",
    ),
    "bare-except": (
        MistakeCategory.PYTHON_BARE_EXCEPT,
        "warning",
        "Bare exception handler",
        "A bare 'except:' clause catches SystemExit and KeyboardInterrupt, preventing normal program termination.",
        "Specify the exact exception class you intend to handle (e.g. 'except Exception:' or 'except IOError:').",
    ),
    "E0001": (
        MistakeCategory.CODE_QUALITY_SYNTAX_ERROR,
        "critical",
        "Syntax error in Python source",
        "The code cannot be parsed by the Python interpreter and will crash immediately upon import.",
        "Correct the syntax error according to Python grammar rules.",
    ),
    "syntax-error": (
        MistakeCategory.CODE_QUALITY_SYNTAX_ERROR,
        "critical",
        "Syntax error in Python source",
        "The code cannot be parsed by the Python interpreter and will crash immediately upon import.",
        "Correct the syntax error according to Python grammar rules.",
    ),
}


def map_bandit_rule(test_id: str, issue_text: str) -> Tuple[MistakeCategory, str, str, str, str]:
    if test_id in BANDIT_RULE_MAP:
        return BANDIT_RULE_MAP[test_id]
    return (
        MistakeCategory.GENERAL_GUIDANCE,
        "warning",
        f"Security finding: {test_id}",
        issue_text,
        "Review and address the security finding.",
    )


def map_pylint_rule(symbol_or_id: str, message: str) -> Tuple[MistakeCategory, str, str, str, str]:
    if symbol_or_id in PYLINT_RULE_MAP:
        return PYLINT_RULE_MAP[symbol_or_id]
    return (
        MistakeCategory.GENERAL_GUIDANCE,
        "suggestion",
        f"Linter note: {symbol_or_id}",
        message,
        "Refactor according to code standards.",
    )
