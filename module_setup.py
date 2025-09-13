#!/usr/bin/env python
"""UX module setup - delegates to Base AMIModuleSetup via base/module_setup.py.

No ad-hoc sys.path manipulation; use the same delegation pattern as other modules.
"""

import logging
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

MODULE_ROOT = Path(__file__).resolve().parent


def main() -> int:
    base_setup = MODULE_ROOT.parent / "base" / "module_setup.py"
    if not base_setup.exists():
        logger.error("ERROR: Cannot find base/module_setup.py")
        return 1

    cmd = [sys.executable, str(base_setup), "--project-dir", str(MODULE_ROOT), "--project-name", "UX Module"]
    result = subprocess.run(cmd, check=False)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
