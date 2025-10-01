#!/usr/bin/env python3
"""Fail if banned words appear in the repository (excluding third-party dirs)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path.cwd()

# Directories that are treated as third-party or generated content.
IGNORED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".venv",
    "uv_cache",
    "cli-agents",  # explicitly excluded per user request
    ".next",  # Next.js build output
}

# Individual files that should not be scanned (e.g., this tool itself).
IGNORED_FILES = {
    Path("scripts/check_banned_words.py"),
    Path("scripts/count_fallback.py"),
    Path("REPORT-FALLBACKS.md"),  # Analysis report
    Path("FALLBACK-REMEDIATION-SUMMARY.md"),  # Execution summary
    Path("FALLBACK-ELIMINATION-PLAN.md"),  # Elimination plan
    Path("FALLBACK-ELIMINATION-REVISED.md"),  # Revised analysis
}

# File extensions to ignore
IGNORED_EXTENSIONS = {
    ".tsbuildinfo",  # TypeScript build cache (contains embedded node_modules paths)
}

# Directories to completely exclude
EXCLUDED_DIRS = {
    "cms/extension",  # Build output
    "cms/public/js/highlight-plugin",  # Build output
    "cms/public/js/lib",  # Build output
    "cms/public/vendor",  # Third-party vendor code
    "cms/packages/highlight-engine",  # Build output
}


DEFAULT_BANNED_WORDS = ("fallback",)


def should_skip(path: Path) -> bool:
    """Return True if the relative path is inside an ignored directory."""

    # Check exact directory matches
    path_str = str(path)
    for excluded in EXCLUDED_DIRS:
        if path_str.startswith(excluded):
            return True

    return any(part in IGNORED_DIRS for part in path.parts)


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None
    except OSError:
        return None


def scan_repo(banned_words: tuple[str, ...]) -> dict[str, list[tuple[Path, int, str]]]:
    results: dict[str, list[tuple[Path, int, str]]] = {word: [] for word in banned_words}

    for file_path in REPO_ROOT.rglob("*"):
        if not file_path.is_file():
            continue

        relative = file_path.relative_to(REPO_ROOT)
        if should_skip(relative) or relative in IGNORED_FILES or file_path.suffix in IGNORED_EXTENSIONS:
            continue

        content = read_text(file_path)
        if content is None:
            continue

        lines = content.splitlines()
        lower_lines = [line.lower() for line in lines]

        for index, lower_line in enumerate(lower_lines, start=1):
            for word in banned_words:
                if word in lower_line:
                    results[word].append((relative, index, lines[index - 1].strip()))

    return results


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--words",
        nargs="*",
        default=list(DEFAULT_BANNED_WORDS),
        help="List of banned words to search for.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    words = tuple(word.lower() for word in args.words)

    findings = scan_repo(words)
    violations = False

    for word, matches in findings.items():
        if not matches:
            continue
        violations = True
        print(f"BANNED WORD '{word}' FOUND {len(matches)} time(s):")
        for relative, line_number, line in matches:
            print(f"  {relative}:{line_number}: {line}")
        print()

        # Aggregate summary by top-level directory and doc/code classification
        summaries: dict[str, dict[str, int]] = {}
        doc_dirs = {"docs", "documentation"}
        doc_exts = {".md", ".mdx", ".rst", ".txt", ".adoc"}
        for relative, *_ in matches:
            top_level = relative.parts[0] if relative.parts else "(repository root)"

            ext = relative.suffix.lower()
            classification = "docs" if (ext in doc_exts or any(part in doc_dirs for part in relative.parts)) else "code"

            module_summary = summaries.setdefault(top_level, {"docs": 0, "code": 0})
            module_summary[classification] += 1

        print("Summary by top-level directory:")
        for module in sorted(summaries):
            counts = summaries[module]
            doc_count = counts["docs"]
            code_count = counts["code"]
            total = doc_count + code_count
            print(f"  {module:20} total={total:4d}  docs={doc_count:4d}  code={code_count:4d}")
        print()

    if violations:
        print("Banned words detected. Please remove or rename them before committing.")
        return 1

    print("No banned words detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
