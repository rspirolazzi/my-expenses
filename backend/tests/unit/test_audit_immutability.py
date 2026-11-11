"""Principle IV: audit_logs can only be inserted, never updated or deleted, by application code."""

import ast
import inspect
import re
from pathlib import Path

from app.repositories import audit_logs

APP_DIR = Path(__file__).resolve().parents[2] / "app"
MUTATIONS = re.compile(r"\b(update_\w+|delete_\w+|replace_\w+|find_one_and_\w+|bulk_write|drop)\b")


def test_repository_exposes_only_insert_and_reads():
    functions = [
        name
        for name, obj in inspect.getmembers(audit_logs, inspect.isfunction)
        if obj.__module__ == audit_logs.__name__
    ]
    assert sorted(functions) == ["insert", "list_for_entity"]


def test_no_module_mutates_audit_logs():
    offenders = []
    for path in APP_DIR.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                target = ast.unparse(node.func.value)
                if "audit_logs" in target and MUTATIONS.search(node.func.attr):
                    offenders.append(f"{path.name}: {ast.unparse(node)}")
    assert offenders == []
