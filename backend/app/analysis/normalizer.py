from typing import Dict, List, Set, Tuple
from app.agents.schemas import Finding

SEVERITY_ORDER = {
    "critical": 4,
    "warning": 3,
    "suggestion": 2,
    "info": 1,
}


def filter_findings_to_changed_lines(
    findings: List[Finding],
    line_map: Dict[int, int],
) -> List[Finding]:
    """
    Retains only findings that fall on lines modified in the PR diff.
    line_map maps new_file_line -> diff_position.
    """
    filtered: List[Finding] = []
    for f in findings:
        # Check if line_start or line_end is within the changed line map
        if f.line_start in line_map or f.line_end in line_map:
            filtered.append(f)
    return filtered


def deduplicate_findings(findings: List[Finding]) -> List[Finding]:
    """
    De-duplicates overlapping findings across tools on the same file and lines.
    When overlapping findings occur, selects the higher severity.
    """
    # Group findings by (file, line_start)
    grouped: Dict[Tuple[str, int], Finding] = {}

    for f in findings:
        key = (f.file, f.line_start)
        if key not in grouped:
            grouped[key] = f
        else:
            existing = grouped[key]
            existing_sev = SEVERITY_ORDER.get(existing.severity, 0)
            current_sev = SEVERITY_ORDER.get(f.severity, 0)

            # Higher severity wins
            if current_sev > existing_sev:
                grouped[key] = f
            elif current_sev == existing_sev and f.confidence > existing.confidence:
                grouped[key] = f

    return list(grouped.values())


def normalize_static_findings(
    raw_findings: List[Finding],
    line_map: Dict[int, int],
) -> List[Finding]:
    """
    Complete normalization pipeline:
    1. Filter out findings on untouched lines.
    2. De-duplicate overlapping findings across analysis tools.
    """
    changed_line_findings = filter_findings_to_changed_lines(raw_findings, line_map)
    deduped = deduplicate_findings(changed_line_findings)
    return deduped
