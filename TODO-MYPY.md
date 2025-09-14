Mypy Status

- Status: PENDING — venv missing, mypy not executed.

Actions

- Create venv and install deps, then run: `.venv/bin/python -m mypy --config-file mypy.ini`.
- Ensure tests (if any) include return type annotations and typed fixtures.

Verification Rules (Do Not Skip)

- Do not exclude tests; keep strict defaults.

