# UX MODULE OUTSTANDING ISSUES

## REMAINING CRITICAL FIXES NEEDED

### ISSUE 1: MyPy Import Error
**Status**: FAILING
**Error**: `Cannot find implementation or library stub for module named "base.module_setup"`
**Location**: `module_setup.py:20`
**Fix Required**: Resolve the import path issue for base.module_setup module

**Current Error Output**:
```
module_setup.py:20: error: Cannot find implementation or library stub for module named "base.module_setup"  [import-not-found]
```

### ISSUE 2: Missing Tests Directory
**Status**: FAILING  
**Error**: `ERROR: file or directory not found: tests/`
**Fix Required**: Create tests/ directory with proper test files or update pytest.ini to point to correct test location

**Current Error Output**:
```
ERROR: file or directory not found: tests/
collected 0 items
```

---

## COMPLETED FIXES (DO NOT REVISIT)
- Import system fixed (ami_path.py deployed)
- Module setup created (module_setup.py functional)  
- MyPy configuration fixed (mypy.ini properly configured)
- Ruff violations fixed (all checks passing)
- Pre-commit hooks passing (all hooks successful)

---

## VERIFICATION COMMANDS

### Check Current Status
```bash
cd ux
../.venv/Scripts/ruff check .                                    # Should PASS
../.venv/Scripts/python -m mypy . --show-error-codes            # Should FAIL (1 error)
../.venv/Scripts/python -m pytest tests/ -v --tb=short          # Should FAIL (no tests dir)
../.venv/Scripts/pre-commit run --all-files                     # Should PASS
```

### Final Verification (ALL must pass)
```bash
../.venv/Scripts/ruff check .
../.venv/Scripts/python -m mypy . --show-error-codes  
../.venv/Scripts/python -m pytest tests/ -v
../.venv/Scripts/pre-commit run --all-files
```

---

## ABSOLUTE RULES
1. **FIX import error in module_setup.py**
2. **CREATE or FIX tests directory structure**
3. **ZERO mypy errors**  
4. **ALL tests pass**
5. **NO type: ignore**
6. **NO pytest.skip**
7. **FIX ACTUAL PROBLEMS, not symptoms**

## COMMIT WHEN COMPLETE
```bash
git add -A
git commit -m "fix: Resolve MyPy import error and tests directory in UX module"
git push origin HEAD
```