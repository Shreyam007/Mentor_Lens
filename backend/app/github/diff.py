import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class DiffLine:
    type: str  # 'context' | 'add' | 'delete'
    content: str
    old_line_no: Optional[int]
    new_line_no: Optional[int]
    position: int  # 1-indexed line position in the diff hunk for GitHub review comments


@dataclass
class DiffHunk:
    header: str
    old_start: int
    old_length: int
    new_start: int
    new_length: int
    lines: List[DiffLine] = field(default_factory=list)


@dataclass
class ParsedFileDiff:
    filename: str
    hunks: List[DiffHunk] = field(default_factory=list)
    line_map: Dict[int, int] = field(default_factory=dict)  # new_file_line -> diff_position
    additions: int = 0
    deletions: int = 0
    is_binary: bool = False
    is_deleted: bool = False
    is_new: bool = False
    is_renamed: bool = False


HUNK_HEADER_REGEX = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)")


def parse_unified_diff(patch: str, filename: str = "") -> ParsedFileDiff:
    """
    Parses unified diff text into hunks and builds a line map.
    GitHub inline comments require `position`: 1-based index from the first @@ line.
    Line map maps `new_file_line` to `diff_position`.
    Handles CRLF, empty patches, and various diff formats.
    """
    parsed = ParsedFileDiff(filename=filename)
    if not patch:
        return parsed

    # Normalize CRLF to LF
    normalized = patch.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")

    current_hunk: Optional[DiffHunk] = None
    diff_position = 0  # Counter starts with the first hunk header line
    current_old_line = 0
    current_new_line = 0

    for line in lines:
        if not line and diff_position == 0:
            continue

        match = HUNK_HEADER_REGEX.match(line)
        if match:
            diff_position += 1
            old_start = int(match.group(1))
            old_length = int(match.group(2)) if match.group(2) else 1
            new_start = int(match.group(3))
            new_length = int(match.group(4)) if match.group(4) else 1

            current_old_line = old_start
            current_new_line = new_start

            current_hunk = DiffHunk(
                header=line,
                old_start=old_start,
                old_length=old_length,
                new_start=new_start,
                new_length=new_length,
            )
            parsed.hunks.append(current_hunk)
            continue

        if current_hunk is None:
            # Lines before first @@ (git header info e.g. index, ---, +++)
            continue

        diff_position += 1

        if line.startswith("+"):
            diff_line = DiffLine(
                type="add",
                content=line[1:],
                old_line_no=None,
                new_line_no=current_new_line,
                position=diff_position,
            )
            parsed.line_map[current_new_line] = diff_position
            current_hunk.lines.append(diff_line)
            current_new_line += 1
            parsed.additions += 1

        elif line.startswith("-"):
            diff_line = DiffLine(
                type="delete",
                content=line[1:],
                old_line_no=current_old_line,
                new_line_no=None,
                position=diff_position,
            )
            current_hunk.lines.append(diff_line)
            current_old_line += 1
            parsed.deletions += 1

        elif line.startswith(" ") or line == "":
            diff_line = DiffLine(
                type="context",
                content=line[1:] if line.startswith(" ") else "",
                old_line_no=current_old_line,
                new_line_no=current_new_line,
                position=diff_position,
            )
            parsed.line_map[current_new_line] = diff_position
            current_hunk.lines.append(diff_line)
            current_old_line += 1
            current_new_line += 1

        elif line.startswith(r"\ No newline at end of file"):
            # Ignore git's newline warning line
            continue

    return parsed


def extract_new_code_from_patch(patch: str) -> str:
    """
    Extracts the clean target file content (added + context lines) from a diff patch
    stripping git markers (+, -, @@) so static analysis tools can parse valid AST.
    """
    code_lines: List[str] = []
    for line in patch.replace("\r\n", "\n").split("\n"):
        if line.startswith("+"):
            code_lines.append(line[1:])
        elif line.startswith(" "):
            code_lines.append(line[1:])
        elif not line.startswith("-") and not line.startswith("@"):
            code_lines.append(line)
    return "\n".join(code_lines)
