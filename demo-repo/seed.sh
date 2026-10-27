#!/usr/bin/env bash
# ==============================================================================
# MentorLens Demo Repository Seeder
# Initializes 'mentorlens-demo' with 10 historical bug-fix commits
# and creates a target PR branch with a deliberate mistake for live demonstration.
# ==============================================================================

set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mentorlens-demo"

echo "==> Initializing MentorLens Demo Repository at: ${DEMO_DIR}"
rm -rf "${DEMO_DIR}"
mkdir -p "${DEMO_DIR}"
cd "${DEMO_DIR}"

git init
git config user.name "MentorLens Demo Author"
git config user.email "demo@mentorlens.dev"

echo "# MentorLens Demo Project" > README.md
git add README.md
git commit -m "chore: initial repository scaffold"

# 1. SQL Injection bugfix
cat << 'EOF' > auth.py
def get_user_by_id(db, user_id):
    query = "SELECT * FROM users WHERE id = :user_id"
    return db.execute(query, {"user_id": user_id}).fetchone()
EOF
git add auth.py
git commit -m "fix(auth): sanitize SQL queries with parameterized bindings"

# 2. Unclosed file / resource leak bugfix
cat << 'EOF' > reports.py
def export_report_to_csv(filepath, rows):
    with open(filepath, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(f"{r}\n")
EOF
git add reports.py
git commit -m "fix(reports): wrap report file handle in context manager to prevent descriptor leak"

# 3. Hardcoded secret bugfix
cat << 'EOF' > config.py
import os

PAYMENT_API_KEY = os.getenv("PAYMENT_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
EOF
git add config.py
git commit -m "fix(config): load third-party API key from environment variables"

# 4. Mutable default argument bugfix
cat << 'EOF' > cart.py
def add_item_to_cart(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
EOF
git add cart.py
git commit -m "fix(cart): use None default for mutable cart list parameter"

# 5. Bare except bugfix
cat << 'EOF' > worker.py
import logging

logger = logging.getLogger(__name__)

def process_batch(items):
    try:
        return [int(x) for x in items]
    except (ValueError, TypeError) as e:
        logger.warning(f"Failed to parse batch items: {e}")
        return []
EOF
git add worker.py
git commit -m "fix(worker): catch specific ValueError/TypeError instead of bare except"

# 6. Missing input validation bugfix
cat << 'EOF' > validator.py
def parse_int_safe(val, default=0):
    if not isinstance(val, (int, str)):
        return default
    try:
        return int(str(val).strip())
    except ValueError:
        return default
EOF
git add validator.py
git commit -m "fix(validator): validate and sanitize numerical input safely"

# 7. Path traversal bugfix
cat << 'EOF' > storage.py
import os

SAFE_UPLOAD_DIR = "/var/app/uploads"

def get_safe_filepath(filename):
    clean_name = os.path.basename(filename)
    full_path = os.path.abspath(os.path.join(SAFE_UPLOAD_DIR, clean_name))
    if not full_path.startswith(SAFE_UPLOAD_DIR):
        raise PermissionError("Path traversal attempt detected")
    return full_path
EOF
git add storage.py
git commit -m "fix(storage): sanitize filename against directory traversal"

# 8. Unsafe eval bugfix
cat << 'EOF' > formula.py
import ast

def evaluate_simple_math(expr):
    node = ast.parse(expr, mode='eval')
    return eval(compile(node, '<string>', 'eval'), {"__builtins__": {}}, {})
EOF
git add formula.py
git commit -m "fix(formula): replace unsafe eval with sandboxed ast evaluation"

# 9. Concurrency race condition bugfix
cat << 'EOF' > counter.py
import threading

_lock = threading.Lock()
_global_hits = 0

def increment_hits():
    global _global_hits
    with _lock:
        _global_hits += 1
        return _global_hits
EOF
git add counter.py
git commit -m "fix(counter): guard shared visit counter with threading lock"

# 10. Off-by-one bugfix
cat << 'EOF' > batch.py
def chunk_items(items, chunk_size):
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]
EOF
git add batch.py
git commit -m "fix(batch): correct off-by-one boundary index in chunk slicing"

# Create demo PR branch with a mistake
git checkout -b pr/feat-user-search
cat << 'EOF' >> auth.py

def search_users_by_email(db, email):
    # Potential SQL injection introduced in PR
    query = f"SELECT * FROM users WHERE email = '{email}'"
    return db.execute(query).fetchall()
EOF
git add auth.py
git commit -m "feat(auth): add search users by email"

echo "==> Successfully created demo repo with 10 bug-fix commits and 'pr/feat-user-search' branch!"
EOF
