#!/usr/bin/env python
"""Module setup for ux."""

import argparse
import logging
import sys
from pathlib import Path

# Add paths FIRST!
MODULE_ROOT = Path(__file__).parent
sys.path.insert(0, str(MODULE_ROOT))
sys.path.insert(0, str(MODULE_ROOT.parent))
sys.path.insert(0, str(MODULE_ROOT / "scripts"))

from scripts.ami_path import setup_ami_paths  # noqa: E402

ORCHESTRATOR_ROOT, MODULE_ROOT, MODULE_NAME = setup_ami_paths()

# NOW safe to import from base
from base.module_setup import AMIModuleSetup  # noqa: E402

# Set up logger
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Setup ux module")
    parser.add_argument("--no-venv", action="store_true", help="Skip venv creation")
    parser.add_argument("--no-deps", action="store_true", help="Skip dependency installation")
    parser.add_argument("--no-hooks", action="store_true", help="Skip pre-commit hooks")

    args = parser.parse_args()

    # Use the base module's setup class
    setup = AMIModuleSetup(MODULE_ROOT, MODULE_NAME)

    if not args.no_venv and (not setup.check_uv() or not setup.create_venv()):
        return 1

    if not args.no_deps:
        if not setup.install_requirements():
            return 1
        if not setup.install_test_requirements():
            return 1

    if not args.no_hooks and not setup.install_precommit_hooks():
        return 1

    logger.info(f"[OK] {MODULE_NAME} module setup complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
