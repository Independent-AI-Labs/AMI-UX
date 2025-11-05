# UX Module - Setup Contract

Delegation
- Uses Base `AMIModuleSetup` for venv and dependencies.

Entrypoints
- Runner scripts under `ux/scripts/` are responsible for path setup. The module references `scripts/ami_path.py` today.

Known deviations (to correct)
- Path discovery relies on `scripts/ami_path.py`; standardize on Base `PathFinder` to avoid divergence and intermittent path resolution failures.

Policy references
- Orchestrator contract: `/docs/Setup-Contract.md`
- Base setup utilities: `base/backend/utils/{path_finder.py, environment_setup.py, path_utils.py}`
