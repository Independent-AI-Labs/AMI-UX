#!/usr/bin/env python3
"""Count occurrences of 'fallback' (case-insensitive) in repository files."""

import os
from collections import defaultdict
from pathlib import Path


def count_fallback_in_file(file_path: Path) -> int:
    """Count occurrences of 'fallback' in a file (case-insensitive)."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        return content.lower().count("fallback")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0


def main() -> None:
    """Search repository for 'fallback' occurrences."""
    repo_root = Path(__file__).parent.parent
    file_counts = defaultdict(int)
    total_count = 0

    # Common directories to skip
    skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next", "coverage"}

    for root, dirs, files in os.walk(repo_root):
        # Filter out skip directories
        dirs[:] = [d for d in dirs if d not in skip_dirs]

        for file in files:
            file_path = Path(root) / file
            count = count_fallback_in_file(file_path)

            if count > 0:
                rel_path = file_path.relative_to(repo_root)
                file_counts[rel_path] = count
                total_count += count

    # Print results sorted by count (descending)
    print("File counts:")
    for file_path in sorted(file_counts.keys(), key=lambda x: file_counts[x], reverse=True):
        print(f"{file_path}: {file_counts[file_path]}")

    print(f"\nTotal occurrences: {total_count}")
    print(f"Files with matches: {len(file_counts)}")
    print("\nGrep reported: 174 occurrences in 36 files")
    print(f"Difference: {total_count - 174} occurrences")


if __name__ == "__main__":
    main()
