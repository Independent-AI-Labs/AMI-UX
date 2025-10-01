# Meta Asset Relocation

- `.meta` directories must live outside the main repo so they can be injected or swapped without polluting the canonical tree.
- Keep per-app automation or asset payloads in dedicated artifact stores (e.g., `ux-meta` repo, S3 bucket) and mount them at runtime.
- Update onboarding docs to point to the external location and scripts that retrieve the metadata bundles.
