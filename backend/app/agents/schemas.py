from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class MistakeCategory(str, Enum):
    # Security
    SECURITY_SQL_INJECTION = "security.sql_injection"
    SECURITY_HARDCODED_SECRET = "security.hardcoded_secret"
    SECURITY_PATH_TRAVERSAL = "security.path_traversal"
    SECURITY_UNSAFE_EVAL = "security.unsafe_eval"
    SECURITY_XSS = "security.xss"
    SECURITY_COMMAND_INJECTION = "security.command_injection"

    # Reliability & Resource Management
    RESOURCE_UNCLOSED_FILE = "resource.unclosed_file"
    RESOURCE_LEAK = "resource.leak"
    CONCURRENCY_RACE_CONDITION = "concurrency.race_condition"

    # Python Specific
    PYTHON_MUTABLE_DEFAULT_ARG = "python.mutable_default_arg"
    PYTHON_BARE_EXCEPT = "python.bare_except"

    # Code Quality & Logic
    ERROR_HANDLING_MISSING = "error_handling.missing_error_handling"
    LOGIC_OFF_BY_ONE = "logic.off_by_one"
    CODE_QUALITY_SYNTAX_ERROR = "code_quality.syntax_error"
    CODE_QUALITY_UNUSED_IMPORT = "code_quality.unused_import"
    GENERAL_GUIDANCE = "general.guidance"


class Finding(BaseModel):
    file: str
    line_start: int
    line_end: int
    category: MistakeCategory
    severity: Literal["critical", "warning", "suggestion", "info"]
    title: str
    why_risky: str
    fix: str
    suggested_code: Optional[str] = None
    cited_commits: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    source: Literal["static", "llm"] = "static"
    github_comment_id: Optional[str] = None


class VerifierResult(BaseModel):
    finding_id: str
    verdict: Literal["approved", "rejected", "citation_stripped"]
    checks: Dict[str, bool]  # sha_exists, touches_similar_code, claim_matches, line_in_diff
    reason: str


class RetrievedCommit(BaseModel):
    sha: str
    message: str
    author: str
    committed_at: str
    file: str
    diff_snippet: str
    similarity: float
    category: str


class PRFileContext(BaseModel):
    filename: str
    status: str
    patch: str
    line_map: Dict[int, int]  # new_file_line -> diff_position
    language: Optional[str] = None


class PRReviewState(BaseModel):
    pr_id: str
    run_id: str
    repo_name: str
    head_sha: str
    author: str
    files: List[PRFileContext]
    static_findings: List[Finding] = Field(default_factory=list)
    retrieved_history: Dict[str, List[RetrievedCommit]] = Field(default_factory=dict)
    draft_findings: List[Finding] = Field(default_factory=list)
    verified_findings: List[Finding] = Field(default_factory=list)
    trace: Dict[str, Any] = Field(default_factory=dict)
