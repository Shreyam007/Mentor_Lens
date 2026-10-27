#!/usr/bin/env python3
"""
MentorLens Demo Repository Seeder (Python Cross-Platform)
Initializes 'mentorlens-demo' with 10 historical bug-fix commits
and creates a target PR branch with a deliberate mistake for live demonstration.
"""
import os
import shutil
import subprocess
import sys

DEMO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mentorlens-demo")

def run(cmd, cwd=DEMO_DIR):
    subprocess.run(cmd, cwd=cwd, shell=True, check=True)

def write_file(filename, content):
    with open(os.path.join(DEMO_DIR, filename), "w", encoding="utf-8") as f:
        f.write(content)

def main():
    print(f"==> Initializing MentorLens Demo Repository at: {DEMO_DIR}")
    if os.path.exists(DEMO_DIR):
        shutil.rmtree(DEMO_DIR, ignore_errors=True)
    os.makedirs(DEMO_DIR, exist_ok=True)

    run("git init")
    run('git config user.name "MentorLens Demo Author"')
    run('git config user.email "demo@mentorlens.dev"')

    write_file("README.md", "# MentorLens Demo Project\n")
    run("git add README.md")
    run('git commit -m "chore: initial repository scaffold"')

    # 1. SQL Injection bugfix
    write_file("auth.py", 'def get_user_by_id(db, user_id):\n    query = "SELECT * FROM users WHERE id = :user_id"\n    return db.execute(query, {"user_id": user_id}).fetchone()\n')
    run("git add auth.py")
    run('git commit -m "fix(auth): sanitize SQL queries with parameterized bindings"')

    # 2. Unclosed file bugfix
    write_file("reports.py", 'def export_report_to_csv(filepath, rows):\n    with open(filepath, "w", encoding="utf-8") as f:\n        for r in rows:\n            f.write(f"{r}\\n")\n')
    run("git add reports.py")
    run('git commit -m "fix(reports): wrap report file handle in context manager to prevent descriptor leak"')

    # 3. Hardcoded secret bugfix
    write_file("config.py", 'import os\n\nPAYMENT_API_KEY = os.getenv("PAYMENT_API_KEY", "")\nDATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")\n')
    run("git add config.py")
    run('git commit -m "fix(config): load third-party API key from environment variables"')

    # 4. Mutable default argument bugfix
    write_file("cart.py", 'def add_item_to_cart(item, items=None):\n    if items is None:\n        items = []\n    items.append(item)\n    return items\n')
    run("git add cart.py")
    run('git commit -m "fix(cart): use None default for mutable cart list parameter"')

    # 5. Bare except bugfix
    write_file("worker.py", 'import logging\n\nlogger = logging.getLogger(__name__)\n\ndef process_batch(items):\n    try:\n        return [int(x) for x in items]\n    except (ValueError, TypeError) as e:\n        logger.warning(f"Failed to parse batch items: {e}")\n        return []\n')
    run("git add worker.py")
    run('git commit -m "fix(worker): catch specific ValueError/TypeError instead of bare except"')

    # 6. Missing input validation bugfix
    write_file("validator.py", 'def parse_int_safe(val, default=0):\n    if not isinstance(val, (int, str)):\n        return default\n    try:\n        return int(str(val).strip())\n    except ValueError:\n        return default\n')
    run("git add validator.py")
    run('git commit -m "fix(validator): validate and sanitize numerical input safely"')

    # 7. Path traversal bugfix
    write_file("storage.py", 'import os\n\nSAFE_UPLOAD_DIR = "/var/app/uploads"\n\ndef get_safe_filepath(filename):\n    clean_name = os.path.basename(filename)\n    full_path = os.path.abspath(os.path.join(SAFE_UPLOAD_DIR, clean_name))\n    if not full_path.startswith(SAFE_UPLOAD_DIR):\n        raise PermissionError("Path traversal attempt detected")\n    return full_path\n')
    run("git add storage.py")
    run('git commit -m "fix(storage): sanitize filename against directory traversal"')

    # 8. Unsafe eval bugfix
    write_file("formula.py", 'import ast\n\ndef evaluate_simple_math(expr):\n    node = ast.parse(expr, mode="eval")\n    return eval(compile(node, "<string>", "eval"), {"__builtins__": {}}, {})\n')
    run("git add formula.py")
    run('git commit -m "fix(formula): replace unsafe eval with sandboxed ast evaluation"')

    # 9. Concurrency race condition bugfix
    write_file("counter.py", 'import threading\n\n_lock = threading.Lock()\n_global_hits = 0\n\ndef increment_hits():\n    global _global_hits\n    with _lock:\n        _global_hits += 1\n        return _global_hits\n')
    run("git add counter.py")
    run('git commit -m "fix(counter): guard shared visit counter with threading lock"')

    # 10. Off-by-one bugfix
    write_file("batch.py", 'def chunk_items(items, chunk_size):\n    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]\n')
    run("git add batch.py")
    run('git commit -m "fix(batch): correct off-by-one boundary index in chunk slicing"')

    # Create demo PR branch with a mistake
    run("git checkout -b pr/feat-user-search")
    with open(os.path.join(DEMO_DIR, "auth.py"), "a", encoding="utf-8") as f:
        f.write('\ndef search_users_by_email(db, email):\n    # Potential SQL injection introduced in PR\n    query = f"SELECT * FROM users WHERE email = \'{email}\'"\n    return db.execute(query).fetchall()\n')
    run("git add auth.py")
    run('git commit -m "feat(auth): add search users by email"')

    print("==> Successfully created demo repo with 10 bug-fix commits and 'pr/feat-user-search' branch!")

if __name__ == "__main__":
    main()
