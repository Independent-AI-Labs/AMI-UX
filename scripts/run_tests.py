#!/usr/bin/env python
"""Test runner for UX module including CMS npm suite."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

MODULE_ROOT = Path(__file__).resolve().parent.parent
CMS_DIR = MODULE_ROOT / "cms"

# Ensure Python can import ux and base packages
sys.path.insert(0, str(MODULE_ROOT))
sys.path.insert(0, str(MODULE_ROOT.parent))

from base.scripts.run_tests import main as base_main  # noqa: E402


def _run_command(command: list[str], *, cwd: Path) -> int:
    """Run a subprocess command and return its exit code."""
    print(f"Running {' '.join(command)} in {cwd}")
    completed = subprocess.run(command, cwd=str(cwd), check=False)
    return int(completed.returncode)


def _run_cms_suite() -> int:
    """Execute npm lint and test commands for the CMS app."""
    if not (CMS_DIR / "package.json").exists():
        print("CMS package.json not found; skipping npm suite.")
        return 0

    commands: list[list[str]] = []
    if not (CMS_DIR / "node_modules").exists():
        commands.append(["npm", "ci", "--no-audit", "--no-fund"])
    else:
        print("node_modules present; skipping npm ci")

    commands.extend(
        [
            ["npm", "run", "lint"],
            ["npm", "run", "test"],
        ]
    )
    for command in commands:
        code = _run_command(command, cwd=CMS_DIR)
        if code != 0:
            return code
    return 0


def main() -> int:
    args = sys.argv[1:]
    skip_npm = False
    if "--skip-npm" in args:
        skip_npm = True
        args = [arg for arg in args if arg != "--skip-npm"]
        sys.argv = [sys.argv[0], *args]
    else:
        sys.argv = [sys.argv[0], *args]

    # Run Python test suite via base runner first
    python_exit = base_main(project_root=MODULE_ROOT, project_name="UX")
    if python_exit != 0:
        return python_exit

    if skip_npm:
        print("Skipping npm suite (flag set).")
        return 0

    # Ensure npm is available before attempting to run the CMS suite
    if not shutil.which("npm"):
        print("npm not available on PATH; skipping CMS npm suite.")
        return 0

    return _run_cms_suite()


if __name__ == "__main__":
    sys.exit(main())
