# Schema-Driven UI Concept

**STATUS: RESEARCH ONLY - NOT IMPLEMENTED**
This document describes a planned architecture for schema-driven UI generation. No implementation exists as of 2025-10-01.

## Overview
We want the CMS and future operator consoles to render account/connector management screens directly from the backend models. The backend (AMI Base) remains the source of truth for provider schemas and behavioural rules, while the frontend consumes portable descriptors to render forms, hints, validation, and dynamic workflows. This doc sketches the mechanism and the interfaces we need to standardise.

Goals:
- Zero duplicated provider metadata between Python (Pydantic) and Node/React.
- Dynamic form/layout generation with predictable styling and accessibility.
- Support for both static forms (simple CRUD) and interactive flows (multi-step, conditional, credential handoff).
- Extensible enough to cover new providers such as SMTP and HuggingFace without editing frontend code.

Non-goals:
- Replacing design system components. We compose schema-driven forms with our existing drawers/dialogs/buttons.
- Building a generic low-code tool. We optimise for our auth + connector use cases first.

## High-Level Architecture
1. **Model Authoring (Python / Pydantic)**
   - Provider definitions live in `base/backend` as Pydantic models/dataclasses with full validation and metadata (field types, enums, examples, help text, capability flags).
   - We annotate fields with extra metadata using `Field(json_schema_extra=...)` for UI hints (icon id, grouping, priority, default visibility).
2. **Schema Publication Layer**
   - Use Pydantic's JSON Schema generation to emit OpenAPI/JSON Schema documents.
   - Add a lightweight schema registry service (`/api/auth/providers/schema`) that returns the schema bundle plus UI extensions.
   - Version stamp every schema release so the frontend can cache and invalidate.
3. **Frontend Schema Runtime (Next.js / React)**
   - Introduce a schema-runtime module (`ux/cms/public/js/schema-ui/`) that:
     - Fetches schema bundles at runtime (or during SSG) and normalises into internal TS types.
     - Renders forms using a component mapper (React) that pairs JSON Schema field types to our design system controls (text input, select, secret, toggle, code editor, etc.).
     - Supports UI schema overrides (layout rows, conditional display, informative callouts).
   - Maintain a registry of interaction handlers (tests, discovery calls) keyed by schema `actionId` so forms can expose "Test connection" or "Authorize" buttons without hardcoding provider names.
4. **Data Submission + Feedback**
   - Form submissions post back to `cms/app/api/account-manager/...` which delegates to `base/backend` create/update endpoints.
   - Validation errors return structured responses (field path + error code/message). The schema-runtime maps these to inline errors and to the hint system for persistent issues.
5. **Interactive Experience Add-ons**
   - Optional stepper/flow definitions (e.g., OAuth dance vs. API key entry) described in schema as `flow` nodes. Each node defines UI fragments and event handlers (call backend to generate auth URL, poll status, etc.).
   - Provide default components for secrets capture (with reveal timers), environment binding, capability badges.

## Schema Format
We extend JSON Schema with an `x-ami` namespace for UI metadata. Example:

```json
{
  "title": "SMTP Provider",
  "type": "object",
  "required": ["host", "port", "username", "password"],
  "properties": {
    "host": {
      "type": "string",
      "format": "hostname",
      "title": "Host",
      "x-ami": {
        "icon": "ri-server-line",
        "group": "connection",
        "placeholder": "smtp.example.com"
      }
    },
    "port": { "type": "integer", "minimum": 1, "maximum": 65535, "title": "Port" },
    "use_tls": {
      "type": "boolean",
      "default": true,
      "title": "Use STARTTLS",
      "x-ami": { "control": "switch", "group": "security" }
    },
    "auth_mechanism": {
      "type": "string",
      "enum": ["LOGIN", "PLAIN", "XOAUTH2"],
      "title": "Authentication",
      "x-ami": { "control": "select" }
    }
  },
  "x-ami": {
    "version": "2024-09- auth-provider",
    "layout": [
      { "title": "Connection", "fields": ["host", "port", "use_tls"] },
      { "title": "Credentials", "fields": ["username", "password", "auth_mechanism"] }
    ],
    "actions": [
      { "id": "test-smtp", "label": "Test connection", "kind": "secondary" }
    ]
  }
}
```

The runtime only depends on `type`, `format`, `enum`, `default`, etc., plus our `x-ami` hints. Everything else is standard JSON Schema and can be reused for backend validation.

## Frontend Runtime Components
- **Schema Loader** – fetches schema bundle, caches by version, exposes hook `useProviderSchema(providerType)`.
- **Form Renderer** – maps JSON Schema types to components. Example mapping table:
  - `string` + `format=email` → `InputEmail` component.
  - `string` + `x-ami.control=secret` → `SecretInput` with reveal + copy guard.
  - `boolean` + `x-ami.control=switch` → `Toggle` component.
  - `array` of objects → `Repeater` component with add/remove controls.
- **Layout Engine** – reads `x-ami.layout` to group fields into sections/columns. Defaults to single column if unspecified.
- **Action Bar** – renders `x-ami.actions`. Each action maps to a handler registered by provider type or global id (e.g., `test-smtp` triggers API call to `POST /providers/{id}/test`).
- **Flow Engine (optional)** – interprets `x-ami.flow` definitions for multi-step sequences. Each step references a subset of schema fields and allowed transitions.

## Styling & Theming
- All generated controls wrap the shared drawer/dialog components to keep hover/active states consistent.
- Provide style tokens via CSS variables so schema-driven sections inherit our design language (icons from Remix Icon, button classes from `shared.css`).
- Support dark/light automatically by using existing theme variables.

## Interactive UI Considerations
- **Dynamic dependencies**: allow field descriptors to specify `x-ami.dependsOn`. Runtime listens to upstream field value changes and toggles visibility/validation accordingly (e.g., show `organization` only if `scoped_to_org=true`).
- **Live validation**: integrate with backend validation endpoints when necessary (e.g., uniqueness checks) via `x-ami.validators` array specifying `type: remote` and endpoint path.
- **Credential handoff**: for OAuth flows, schema provides `x-ami.flow` steps: `authorize`, `awaitCallback`, `complete`. Runtime opens new window, polls, then stores token summary.

## Data Contract
- Schema bundle delivered as JSON: `{ version, providers: { [providerType]: Schema }, flows: { ... } }`.
- UI runtime posts submissions as `{ providerType, payload, meta }` to Node API.
- Node API proxies to `base/backend` which accepts the trusted payload (already validated by Python model) and persists.
- Error responses conform to `{ errors: [{ field: "host", code: "invalid_host", message: "Host unreachable" }] }` so runtime can map to inline errors.

## Roadmap
1. **MVP (Static Forms)**
   - Publish schemas for existing providers (Google, GitHub, Azure AD, OpenAI, Anthropic, API Key, SMTP, HuggingFace).
   - Implement schema loader + form renderer in CMS; replace Add Account dialog with generated UI.
   - Map backend validation errors into UI hints.
2. **Phase 2 (Interactive / Flows)**
   - Extend schema format with `flow` definitions for OAuth + connection tests.
   - Add action handlers: `test-connection`, `begin-oauth`, `refresh-token`.
   - Implement secret reveal controls with audit logging.
3. **Phase 3 (Reusable Widgets / External Consumers)**
   - Package runtime as shared module for other UI apps (e.g., future admin consoles).
   - Provide CLI to preview schemas (for designers) and optionally generate static docs from schemas.
   - Evaluate live editing tooling (e.g., schema playground) for provider authors.

## Open Questions
- How do we migrate existing stored provider data to the new schema (migration tooling)?
- Do we want design-time linting to ensure all fields have icons/help text before shipping a provider?
- Should actions be declarative enough that we can localise button labels & accessibility text without updating schema definitions?
- How do we version schemas without breaking persisted provider instances (compatibility guarantees)?


## Meta-Platform Strategy
- **Layered Contracts**: Separate descriptors for domain validation, experience presentation, and behaviour flows so teams can compose or override each layer without diverging from the canonical model.
- **Composable Renderer Kernel**: Keep primitives declarative while allowing plug-in renderer packs and sandboxed behaviour adapters (DSL/WASM) to attach richer interactions when required.
- **Schema Composition & Federation**: Support stacking schemas (base workspace + tenant pack) and ingesting signed schemas from partner domains, preserving multi-tenant agility.
- **Governance & Tooling**: Enforce schema linting (permissions, accessibility, analytics tags), provide CLI tooling for diff/preview, and tie schema versions to Git history for audit trails.
- **AI-Assisted Authoring with Guardrails**: Allow tooling to draft schemas but require validators and human approval before publication.

## BPMN Alignment
- **Process Contracts**: BPMN user tasks emit payload schemas that map directly to UI forms; completing the form triggers task completion callbacks.
- **Action Mapping**: Schema `actions` reference BPMN task or signal identifiers, letting the frontend invoke ami-base orchestration endpoints without bespoke wiring.
- **Traceability**: At runtime, log schema version + BPMN process version per interaction so audits can reconstruct who saw what and when.
- **Dynamic Evolution**: When BPMN definitions change fields or flows, updated schemas flow through the registry and renderer automatically, keeping UI and process logic in sync.
- **Human-in-the-Loop Extensions**: BPMN handles SLAs, escalations, and approvals; schema-driven UI supplies the adaptive surfaces (drawers, dashboards) subscribing to BPMN task queues.

## Next Steps
- Finalise backend annotations on `AuthProvider`/related models, ensuring JSON Schema exports include all required metadata.
- Prototype schema endpoint returning SMTP + HuggingFace definitions to unblock UI.
- Implement frontend schema runtime skeleton (loader + basic form mapper) and wire to Add Account dialog.
- Define testing strategy: schema snapshot tests (Python) + UI screenshot/interaction tests (Playwright) to catch regressions.
