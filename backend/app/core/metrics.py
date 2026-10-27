import time
from typing import Dict


class MetricsRegistry:
    """In-memory Prometheus-compatible metrics registry for MentorLens."""

    def __init__(self):
        self.runs_total: int = 0
        self.runs_success: int = 0
        self.runs_failed: int = 0
        self.run_duration_seconds_total: float = 0.0
        self.llm_tokens_total: int = 0
        self.verifier_approvals_total: int = 0
        self.verifier_rejections_total: int = 0
        self.verifier_citations_stripped_total: int = 0

    def record_run(self, duration: float, success: bool = True):
        self.runs_total += 1
        if success:
            self.runs_success += 1
        else:
            self.runs_failed += 1
        self.run_duration_seconds_total += duration

    def record_llm_tokens(self, tokens: int):
        self.llm_tokens_total += tokens

    def record_verifier_verdict(self, verdict: str):
        if verdict == "approved":
            self.verifier_approvals_total += 1
        elif verdict == "rejected":
            self.verifier_rejections_total += 1
        elif verdict == "citation_stripped":
            self.verifier_citations_stripped_total += 1

    def to_prometheus_format(self) -> str:
        avg_duration = (
            self.run_duration_seconds_total / self.runs_total
            if self.runs_total > 0
            else 0.0
        )
        lines = [
            "# HELP mentorlens_runs_total Total review runs processed",
            "# TYPE mentorlens_runs_total counter",
            f"mentorlens_runs_total {self.runs_total}",
            "# HELP mentorlens_runs_success Total successful review runs",
            "# TYPE mentorlens_runs_success counter",
            f"mentorlens_runs_success {self.runs_success}",
            "# HELP mentorlens_runs_failed Total failed review runs",
            "# TYPE mentorlens_runs_failed counter",
            f"mentorlens_runs_failed {self.runs_failed}",
            "# HELP mentorlens_run_duration_seconds_avg Average review run duration in seconds",
            "# TYPE mentorlens_run_duration_seconds_avg gauge",
            f"mentorlens_run_duration_seconds_avg {avg_duration:.2f}",
            "# HELP mentorlens_llm_tokens_total Total tokens used by Explainer agent",
            "# TYPE mentorlens_llm_tokens_total counter",
            f"mentorlens_llm_tokens_total {self.llm_tokens_total}",
            "# HELP mentorlens_verifier_rejections_total Total invalid citations or findings intercepted",
            "# TYPE mentorlens_verifier_rejections_total counter",
            f"mentorlens_verifier_rejections_total {self.verifier_rejections_total}",
            "# HELP mentorlens_verifier_citations_stripped_total Total hallucinated citations stripped by verifier",
            "# TYPE mentorlens_verifier_citations_stripped_total counter",
            f"mentorlens_verifier_citations_stripped_total {self.verifier_citations_stripped_total}",
        ]
        return "\n".join(lines) + "\n"


# Global metrics registry singleton
metrics = MetricsRegistry()
