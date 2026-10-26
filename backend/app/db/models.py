import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    github_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    login: Mapped[str] = mapped_column(String(100), index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="developer")  # developer | lead | admin
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)


class Installation(Base):
    __tablename__ = "installations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    github_installation_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    account_login: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | suspended | revoked
    permissions_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    repositories: Mapped[List["Repository"]] = relationship("Repository", back_populates="installation", cascade="all, delete-orphan")


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    installation_id: Mapped[str] = mapped_column(String(36), ForeignKey("installations.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)  # org/repo
    default_branch: Mapped[str] = mapped_column(String(100), default="main")
    language_set: Mapped[List[str]] = mapped_column(JSON, default=list)  # ["python", "javascript", "typescript"]
    index_status: Mapped[str] = mapped_column(String(30), default="not_indexed")  # not_indexed | queued | indexing | ready | failed
    indexed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    settings_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    installation: Mapped["Installation"] = relationship("Installation", back_populates="repositories")
    pull_requests: Mapped[List["PullRequest"]] = relationship("PullRequest", back_populates="repository", cascade="all, delete-orphan")
    commits: Mapped[List["CommitIndex"]] = relationship("CommitIndex", back_populates="repository", cascade="all, delete-orphan")


class CommitIndex(Base):
    __tablename__ = "commits_index"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    sha: Mapped[str] = mapped_column(String(40), index=True)
    message: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(100))
    committed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    category: Mapped[str] = mapped_column(String(100))  # mistake taxonomy category e.g. security.sql_injection
    is_bugfix: Mapped[bool] = mapped_column(Boolean, default=True)
    stale: Mapped[bool] = mapped_column(Boolean, default=False)

    repository: Mapped["Repository"] = relationship("Repository", back_populates="commits")

    __table_args__ = (
        Index("idx_repo_sha", "repo_id", "sha"),
    )


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(255))
    author_id: Mapped[str] = mapped_column(String(100), index=True)
    head_sha: Mapped[str] = mapped_column(String(40))
    base_branch: Mapped[str] = mapped_column(String(100), default="main")
    state: Mapped[str] = mapped_column(String(20), default="open")  # open | closed | merged
    is_draft: Mapped[bool] = mapped_column(Boolean, default=False)
    is_fork: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    repository: Mapped["Repository"] = relationship("Repository", back_populates="pull_requests")
    runs: Mapped[List["ReviewRun"]] = relationship("ReviewRun", back_populates="pull_request", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_repo_number", "repo_id", "number"),
    )


class ReviewRun(Base):
    __tablename__ = "review_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pr_id: Mapped[str] = mapped_column(String(36), ForeignKey("pull_requests.id", ondelete="CASCADE"), index=True)
    head_sha: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | succeeded | partial | failed | skipped | cancelled
    stage: Mapped[str] = mapped_column(String(50), default="intake")
    error_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    delivery_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    trace_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    pull_request: Mapped["PullRequest"] = relationship("PullRequest", back_populates="runs")
    findings: Mapped[List["FindingModel"]] = relationship("FindingModel", back_populates="run", cascade="all, delete-orphan")


class FindingModel(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("review_runs.id", ondelete="CASCADE"), index=True)
    file: Mapped[str] = mapped_column(String(500))
    line_start: Mapped[int] = mapped_column(Integer)
    line_end: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(20))  # critical | warning | suggestion | info
    title: Mapped[str] = mapped_column(String(255))
    why_risky: Mapped[str] = mapped_column(Text)
    fix: Mapped[str] = mapped_column(Text)
    suggested_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(20))  # static | llm
    github_comment_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | fixed | dismissed | outdated
    dismiss_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    run: Mapped["ReviewRun"] = relationship("ReviewRun", back_populates="findings")
    citations: Mapped[List["CitationModel"]] = relationship("CitationModel", back_populates="finding", cascade="all, delete-orphan")
    feedback: Mapped[List["FeedbackModel"]] = relationship("FeedbackModel", back_populates="finding", cascade="all, delete-orphan")


class CitationModel(Base):
    __tablename__ = "citations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    finding_id: Mapped[str] = mapped_column(String(36), ForeignKey("findings.id", ondelete="CASCADE"), index=True)
    commit_sha: Mapped[str] = mapped_column(String(40), index=True)
    verdict: Mapped[str] = mapped_column(String(30))  # approved | rejected | citation_stripped
    reason: Mapped[str] = mapped_column(Text)
    similarity: Mapped[float] = mapped_column(Float, default=0.0)

    finding: Mapped["FindingModel"] = relationship("FindingModel", back_populates="citations")


class FeedbackModel(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    finding_id: Mapped[str] = mapped_column(String(36), ForeignKey("findings.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    value: Mapped[str] = mapped_column(String(20))  # helpful | not_helpful
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)

    finding: Mapped["FindingModel"] = relationship("FindingModel", back_populates="feedback")


class MistakeEvent(Base):
    __tablename__ = "mistake_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    developer_id: Mapped[str] = mapped_column(String(100), index=True)
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    finding_id: Mapped[str] = mapped_column(String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, index=True)

    __table_args__ = (
        Index("idx_dev_occurred", "developer_id", "occurred_at"),
    )


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    delivery_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    event: Mapped[str] = mapped_column(String(50))
    status_code: Mapped[int] = mapped_column(Integer)
    signature_valid: Mapped[bool] = mapped_column(Boolean)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)
    payload_hash: Mapped[str] = mapped_column(String(64))


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(100))
    target: Mapped[str] = mapped_column(String(255))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)
