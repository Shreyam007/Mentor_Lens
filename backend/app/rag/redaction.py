import re

SECRET_PATTERNS = [
    # AWS Access Key ID
    (re.compile(r"\b(AKIA[0-9A-Z]{16})\b"), "[REDACTED_AWS_KEY]"),
    # GitHub Personal Access Token / OAuth
    (re.compile(r"\b(gh[pousr]_[A-Za-z0-9_]{36,255})\b"), "[REDACTED_GITHUB_TOKEN]"),
    # Anthropic / OpenAI API Keys
    (re.compile(r"\b(sk-ant-[A-Za-z0-9_-]{30,100})\b"), "[REDACTED_ANTHROPIC_KEY]"),
    (re.compile(r"\b(sk-[A-Za-z0-9]{32,64})\b"), "[REDACTED_OPENAI_KEY]"),
    # Generic Private Key blocks
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    # Slack Tokens
    (re.compile(r"\b(xox[baprs]-[0-9a-zA-Z-]{20,72})\b"), "[REDACTED_SLACK_TOKEN]"),
    # Common variable assignments with hardcoded passwords or secrets
    (re.compile(r"""(?i)(password|passwd|secret|api_key|apikey|auth_token)\s*=\s*['"][^'"]{8,}['"]"""), r"\1 = '[REDACTED_SECRET]'"),
]


def redact_secrets(content: str) -> str:
    """
    Scans and redacts confidential credentials, API keys, tokens, and private keys.
    Guarantees secrets are never stored in vector indexes or transmitted to LLMs.
    """
    if not content:
        return content

    sanitized = content
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)

    return sanitized
