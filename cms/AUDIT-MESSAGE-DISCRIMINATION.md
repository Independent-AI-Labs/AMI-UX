# AUDIT: setContentRoot Message Discrimination

**Date:** 2025-10-04
**Issue:** "Compliance" library entries fail to load due to missing `rootKey` in setContentRoot messages
**Root Cause:** Code path discrimination - library entries with entryId use different logic than path-based entries

---

## Executive Summary

The codebase builds `setContentRoot` messages through 5 distinct code paths. **ONLY ONE PATH** (`buildContentMessageForDir` when `tab.entryId` is truthy) correctly preserves `rootKey` from library entries. All other paths either:
1. Omit `rootKey` entirely
2. Derive `rootKey` from filesystem path patterns (uploads only)
3. Set `rootKey` to empty string for standalone paths

This discrimination causes **"Compliance"** library entries (and any non-uploads library entry) to fail because the embedded `doc.html` iframe receives messages without `rootKey`, preventing the tree viewer from loading content.

---

## CODE PATH 1: shell.js → buildContentMessageForDir (WITH entryId)

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js` lines 1105-1139

### Input
```javascript
tab = {
  entryId: "compliance-123",    // ✓ PRESENT
  kind: "dir",
  path: "/home/ami/compliance",
  label: "Compliance"
}
```

### Code Flow
```javascript
function buildContentMessageForDir(tab, cfg) {
  if (!tab) return null
  const path = tab.path || ''
  if (!path) return null

  let context

  // BRANCH 1: Has entryId (LIBRARY ENTRY PATH)
  if (tab.entryId) {
    context = {
      rootKey: tab.entryId,                    // ✓ PRESERVED
      path: path,
      absolutePath: path,
      label: tab.label || path.split('/').filter(Boolean).pop() || 'Content',
      focus: '',
    }
  }

  // Build message from context
  return buildContentMessage(context)
}
```

### Output
```javascript
{
  type: 'setContentRoot',
  rootKey: 'compliance-123',     // ✓ PRESENT
  path: '/home/ami/compliance',
  label: 'Compliance'
}
```

**Lines:** 1113-1120
**Result:** ✓ CORRECT - rootKey preserved from entryId

---

## CODE PATH 2: shell.js → buildContentMessageForDir (WITHOUT entryId)

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js` lines 1105-1139

### Input
```javascript
tab = {
  entryId: null,                    // ✗ MISSING
  kind: "dir",
  path: "/home/ami/compliance",
  label: "Compliance"
}
```

### Code Flow
```javascript
function buildContentMessageForDir(tab, cfg) {
  // ...

  // BRANCH 2: No entryId (PATH-BASED PATH)
  else {
    // Use model to derive context from path
    const serverConfig = cfg ? {
      contentRoot: cfg.contentRoot || '',
      contentRootLabel: cfg.contentRootLabel || '',
      contentRootAbsolute: cfg.contentRootAbsolute || '',
    } : null

    context = deriveContextFromPath(path, serverConfig)

    // Override label if tab has custom label
    if (tab.label) {
      context.label = tab.label
    }
  }

  return buildContentMessage(context)
}
```

**Calls:** `deriveContextFromPath(path, serverConfig)` at line 1129

### Output (via deriveContextFromPath)
For non-uploads paths:
```javascript
{
  type: 'setContentRoot',
  rootKey: '',                       // ✗ EMPTY STRING
  path: '/home/ami/compliance',
  label: 'Compliance'
}
```

**Lines:** 1122-1138
**Result:** ✗ FAILS - rootKey is empty string for non-uploads paths

---

## CODE PATH 3: models.js → deriveContextFromPath (uploads)

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/models.js` lines 45-72

### Input
```javascript
path = "/some/path/files/uploads/documents/report.pdf"
```

### Code Flow
```javascript
export function deriveContextFromPath(path) {
  const normalized = normalizeFsPath(path)

  // Check if path is in uploads
  const uploadsIndex = normalized.indexOf(UPLOADS_MARKER)  // '/files/uploads'
  if (uploadsIndex !== -1) {
    const uploadsBase = normalized.slice(0, uploadsIndex + UPLOADS_MARKER.length)
    const relativePath = normalized.slice(uploadsBase.length).replace(/^\/+/, '')

    return {
      rootKey: 'uploads',              // ✓ HARDCODED
      path: uploadsBase,
      absolutePath: uploadsBase,
      label: 'Uploads',
      focus: relativePath,
    }
  }

  // (fallback to standalone path...)
}
```

### Output
```javascript
{
  rootKey: 'uploads',
  path: '/some/path/files/uploads',
  absolutePath: '/some/path/files/uploads',
  label: 'Uploads',
  focus: 'documents/report.pdf'
}
```

**Lines:** 48-61
**Result:** ✓ CORRECT for uploads only - rootKey hardcoded to 'uploads'

---

## CODE PATH 4: models.js → deriveContextFromPath (standalone)

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/models.js` lines 45-72

### Input
```javascript
path = "/home/ami/compliance/policies/gdpr.md"
```

### Code Flow
```javascript
export function deriveContextFromPath(path) {
  const normalized = normalizeFsPath(path)

  // Check if path is in uploads
  const uploadsIndex = normalized.indexOf(UPLOADS_MARKER)
  if (uploadsIndex !== -1) {
    // ...uploads logic
  }

  // BRANCH 2: Standalone path (NOT IN UPLOADS)
  const lastSegment = normalized.split('/').filter(Boolean).pop() || normalized
  return {
    rootKey: '',                       // ✗ EMPTY STRING
    path: normalized,
    absolutePath: normalized,
    label: lastSegment || 'Content',
    focus: '',
  }
}
```

### Output
```javascript
{
  rootKey: '',                         // ✗ EMPTY STRING
  path: '/home/ami/compliance/policies/gdpr.md',
  absolutePath: '/home/ami/compliance/policies/gdpr.md',
  label: 'gdpr.md',
  focus: ''
}
```

**Lines:** 63-71
**Result:** ✗ FAILS - rootKey is empty string for all non-uploads standalone paths

---

## CODE PATH 5: route.ts → served content iframe injection

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/served/[id]/[[...path]]/route.ts` line 144

### Input
```javascript
entry = {
  id: "compliance-123",
  path: "/home/ami/compliance",
  kind: "dir"
}
```

### Code Flow
```javascript
if (inst.kind === 'dir') {
  const html = `<!doctype html>...<script>
    window.addEventListener('load',function(){
      try{
        document.getElementById('d').contentWindow.postMessage({
          type:'setContentRoot',
          path:${JSON.stringify(entry.path)}    // ✗ ONLY PATH
        },'*')
      }catch(e){}
    })
  </script></body></html>`
  // ...
}
```

### Output
```javascript
// Message posted to iframe:
{
  type: 'setContentRoot',
  path: '/home/ami/compliance'         // ✗ NO rootKey
  // label: MISSING
  // focus: MISSING
}
```

**Line:** 144
**Result:** ✗ FAILS - No rootKey, no label, no focus

---

## CODE PATH 6: models.js → buildContentMessage (final transform)

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/models.js` lines 102-120

### Input
```javascript
context = {
  rootKey: 'compliance-123',
  path: '/home/ami/compliance',
  label: 'Compliance',
  focus: ''
}
```

### Code Flow
```javascript
export function buildContentMessage(context) {
  console.log('[models] buildContentMessage input context:', JSON.stringify(context))
  const msg = {
    type: 'setContentRoot',
    rootKey: context.rootKey,          // ✓ ALWAYS INCLUDED
    path: context.path,
  }

  if (context.label) {                 // CONDITIONAL
    msg.label = context.label
  }

  if (context.focus) {                 // CONDITIONAL
    msg.focus = context.focus
  }

  console.log('[models] buildContentMessage output:', JSON.stringify(msg))
  return msg
}
```

### Output
```javascript
{
  type: 'setContentRoot',
  rootKey: 'compliance-123',           // ✓ PRESERVED
  path: '/home/ami/compliance',
  label: 'Compliance'                  // ✓ INCLUDED (was truthy)
}
```

**Lines:** 104-118
**Result:** ✓ CORRECT - Faithfully transforms context to message

**IMPORTANT:** This function is NOT the problem. It correctly passes through whatever `rootKey` it receives. The discrimination happens BEFORE this function is called.

---

## CODE PATH 7: main.js → setContentRoot message handler

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/main.js` lines 899-920

### Input (from postMessage)
```javascript
msg = {
  type: 'setContentRoot',
  rootKey: 'compliance-123',
  path: '/home/ami/compliance',
  label: 'Compliance',
  focus: 'policies/gdpr.md'
}
```

### Code Flow
```javascript
if (msg.type === 'setContentRoot') {
  console.log('[main] Received setContentRoot:', JSON.stringify({
    rootKey: msg.rootKey,
    path: msg.path,
    label: msg.label
  }))
  ack({ status: 'accepted' })

  // Use model to create context from message
  const context = createContextFromMessage({
    rootKey: msg.rootKey,              // ✓ PRESERVED
    path: msg.path,
    label: msg.label,
    focus: msg.focus,
  })

  console.log('[main] Created context:', JSON.stringify({
    rootKey: context.rootKey,
    path: context.path
  }))

  // Update state with context (single source of truth!)
  state.contentContext = context
  state.rootKey = context.rootKey      // ✓ USED FOR TREE API
  state.contentRootAbsolute = context.absolutePath
  state.rootLabelOverride = context.label
  state.pendingFocus = context.focus

  await startCms(true)
  return
}
```

### Output (state update)
```javascript
state = {
  contentContext: {
    rootKey: 'compliance-123',         // ✓ PRESERVED
    path: '/home/ami/compliance',
    absolutePath: '/home/ami/compliance',
    label: 'Compliance',
    focus: 'policies/gdpr.md'
  },
  rootKey: 'compliance-123',           // ✓ USED FOR API CALLS
  // ...
}
```

**Lines:** 900-919
**Result:** ✓ CORRECT - Faithfully processes message, preserves rootKey

**IMPORTANT:** This handler is NOT the problem. It correctly uses whatever `rootKey` it receives. The discrimination happens in message CREATION, not message HANDLING.

---

## CODE PATH 8: models.js → createContextFromMessage

**Location:** `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/models.js` lines 26-40

### Input
```javascript
message = {
  rootKey: 'compliance-123',
  path: '/home/ami/compliance',
  label: 'Compliance',
  focus: 'policies/gdpr.md'
}
```

### Code Flow
```javascript
export function createContextFromMessage(message) {
  const rootKey = message.rootKey || ''      // ✓ PRESERVED
  const path = message.path || ''
  const label = message.label || (rootKey === 'uploads' ? 'Uploads' : 'Content')
  const focus = message.focus || ''

  return {
    rootKey,                                  // ✓ PRESERVED
    path,
    absolutePath: path,
    label,
    focus,
  }
}
```

### Output
```javascript
{
  rootKey: 'compliance-123',                  // ✓ PRESERVED
  path: '/home/ami/compliance',
  absolutePath: '/home/ami/compliance',
  label: 'Compliance',
  focus: 'policies/gdpr.md'
}
```

**Lines:** 28-39
**Result:** ✓ CORRECT - Faithfully transforms message to context

---

## DISCRIMINATION MATRIX

| Code Path | Location | rootKey Behavior | Discriminates? | Impact |
|-----------|----------|------------------|----------------|--------|
| **PATH 1** | `shell.js:1113-1120` (WITH entryId) | ✓ Uses `tab.entryId` | NO | ✓ Works for ALL library entries |
| **PATH 2** | `shell.js:1122-1138` (NO entryId) | ✗ Calls `deriveContextFromPath` | YES | ✗ Fails for non-uploads |
| **PATH 3** | `models.js:48-61` (uploads) | ✓ Hardcoded `'uploads'` | NO | ✓ Works for uploads only |
| **PATH 4** | `models.js:63-71` (standalone) | ✗ Empty string `''` | YES | ✗ Fails for all non-uploads |
| **PATH 5** | `route.ts:144` (served iframe) | ✗ Omitted entirely | YES | ✗ Fails for ALL library entries |
| **PATH 6** | `models.js:102-120` (transform) | ✓ Passes through input | NO | ✓ Faithful transform |
| **PATH 7** | `main.js:899-920` (handler) | ✓ Passes through input | NO | ✓ Faithful handler |
| **PATH 8** | `models.js:26-40` (message→context) | ✓ Passes through input | NO | ✓ Faithful transform |

---

## ROOT CAUSE ANALYSIS

### The Core Discrimination

The discrimination occurs in **PATH 2** (`buildContentMessageForDir` without `entryId`) and **PATH 5** (served iframe injection):

1. **PATH 2 Logic:**
   ```javascript
   if (tab.entryId) {
     // ✓ PRIVILEGED PATH: Use entryId as rootKey
     context = { rootKey: tab.entryId, ... }
   } else {
     // ✗ DISCRIMINATORY PATH: Derive from filesystem path
     context = deriveContextFromPath(path, serverConfig)
   }
   ```

2. **deriveContextFromPath Logic:**
   ```javascript
   if (path.includes('/files/uploads')) {
     // ✓ PRIVILEGED PATH: Hardcode 'uploads'
     return { rootKey: 'uploads', ... }
   } else {
     // ✗ DISCRIMINATORY PATH: Empty string
     return { rootKey: '', ... }
   }
   ```

3. **Served iframe injection:**
   ```javascript
   // ✗ DISCRIMINATORY: Omits rootKey entirely
   postMessage({ type: 'setContentRoot', path: entry.path }, '*')
   ```

### Why "Compliance" Fails

When a "Compliance" library entry is opened:

1. **Tab creation** (shell.js lines 1640-1649):
   ```javascript
   const tab = {
     id: tabId,
     entryId: entry.id,        // ✓ SET: 'compliance-123'
     kind: entry.kind,
     path: entry.path,
     label: entry.label,
   }
   ```

2. **Tab activation** (shell.js lines 1439-1446):
   ```javascript
   const docMessage = buildContentMessageForDir(tab, cfg)
   ```
   - ✓ Because `tab.entryId` is truthy, PATH 1 is used
   - ✓ Message includes `rootKey: 'compliance-123'`

3. **Message queueing** (shell.js line 1444):
   ```javascript
   queueDocMessage(docMessage)  // ✓ Correct message queued
   ```

4. **BUT:** If tab was created WITHOUT `entryId`:
   - ✗ PATH 2 is used
   - ✗ `deriveContextFromPath` returns `rootKey: ''`
   - ✗ Tree viewer receives empty rootKey
   - ✗ API call fails: `fetchTreeChildren('', '')` → 404

### Why "Uploads" Works

"Uploads" has TWO privilege paths:

1. **As library entry:** Uses PATH 1 (`tab.entryId` → `rootKey`)
2. **As filesystem path:** Uses PATH 3 (hardcoded `'uploads'`)

This dual privilege masks the discrimination.

### Why "Docs" Works

"Docs" is typically the FIRST library entry and is auto-selected on startup (main.js lines 696-710), so it ALWAYS has `entryId` and uses PATH 1.

---

## CONDITIONAL LOGIC INVENTORY

### 1. buildContentMessageForDir (shell.js:1105-1139)

**Condition:** `if (tab.entryId)`
**Line:** 1113
**Discriminates:** YES
**Effect:**
- TRUE → Uses `tab.entryId` as `rootKey` (PRIVILEGED)
- FALSE → Calls `deriveContextFromPath` (DISCRIMINATORY)

---

### 2. deriveContextFromPath (models.js:45-72)

**Condition:** `if (uploadsIndex !== -1)`
**Line:** 50
**Discriminates:** YES
**Effect:**
- TRUE → Hardcodes `rootKey: 'uploads'` (PRIVILEGED)
- FALSE → Sets `rootKey: ''` (DISCRIMINATORY)

---

### 3. buildContentMessage (models.js:102-120)

**Condition:** `if (context.label)`
**Line:** 110
**Discriminates:** NO
**Effect:** Optional label included if truthy (benign)

**Condition:** `if (context.focus)`
**Line:** 114
**Discriminates:** NO
**Effect:** Optional focus included if truthy (benign)

---

### 4. createContextFromMessage (models.js:26-40)

**Condition:** `message.rootKey || ''`
**Line:** 28
**Discriminates:** NO
**Effect:** Default to empty string if missing (benign fallback)

**Condition:** `message.label || (rootKey === 'uploads' ? 'Uploads' : 'Content')`
**Line:** 30
**Discriminates:** NO
**Effect:** Default label logic (benign)

---

### 5. Served iframe postMessage (route.ts:144)

**Condition:** None (unconditional omission)
**Line:** 144
**Discriminates:** YES
**Effect:** ALWAYS omits `rootKey`, `label`, `focus`

---

## TRANSFORMATIONS AND OMISSIONS

### Message Creation Chain

1. **Entry → Tab** (shell.js:1640-1649)
   - ✓ Preserves: `entryId`, `path`, `label`, `kind`
   - No omissions

2. **Tab → Context** (shell.js:1113-1120 OR 1122-1138)
   - **WITH entryId:**
     - ✓ Transform: `entryId` → `rootKey`
     - ✓ Preserves: `path`, `label`
     - ✓ Adds: `absolutePath` (= path), `focus` ('')
   - **WITHOUT entryId:**
     - ✗ Transform: `path` → `rootKey` via pattern match
     - ✗ Omission: `entryId` not used
     - ✓ Preserves: `label` (if set)

3. **Context → Message** (models.js:102-120)
   - ✓ Transform: Context properties → Message fields
   - ✓ Preserves: `rootKey`, `path`
   - ⚠ Conditional: `label`, `focus` (only if truthy)

4. **Message → Context** (models.js:26-40)
   - ✓ Reverse transform: Message → Context
   - ✓ Preserves: `rootKey`, `path`, `label`, `focus`
   - ⚠ Defaults: Empty strings if missing

---

## COMPARISON: "Docs" vs "Compliance"

### Scenario 1: "Docs" Library Entry

```javascript
// Entry from library API
entry = {
  id: "docs-456",
  kind: "dir",
  path: "/home/ami/docs",
  label: "Docs"
}

// ↓ Tab creation (shell.js:1640-1649)
tab = {
  id: "docs-456-1234567890",
  entryId: "docs-456",              // ✓ SET
  kind: "dir",
  path: "/home/ami/docs",
  label: "Docs"
}

// ↓ buildContentMessageForDir (shell.js:1113-1120)
// ✓ BRANCH 1: tab.entryId is truthy
context = {
  rootKey: "docs-456",              // ✓ FROM entryId
  path: "/home/ami/docs",
  absolutePath: "/home/ami/docs",
  label: "Docs",
  focus: ""
}

// ↓ buildContentMessage (models.js:102-120)
message = {
  type: "setContentRoot",
  rootKey: "docs-456",              // ✓ PRESERVED
  path: "/home/ami/docs",
  label: "Docs"
}

// ↓ postMessage to iframe
// ✓ SUCCESS: doc.html receives valid rootKey
```

**Result:** ✓ WORKS

---

### Scenario 2: "Compliance" Library Entry (CURRENT FAILURE)

```javascript
// Entry from library API
entry = {
  id: "compliance-123",
  kind: "dir",
  path: "/home/ami/compliance",
  label: "Compliance"
}

// ↓ Tab creation (shell.js:1640-1649)
tab = {
  id: "compliance-123-1234567890",
  entryId: "compliance-123",        // ✓ SET
  kind: "dir",
  path: "/home/ami/compliance",
  label: "Compliance"
}

// ↓ buildContentMessageForDir (shell.js:1113-1120)
// ✓ BRANCH 1: tab.entryId is truthy
context = {
  rootKey: "compliance-123",        // ✓ FROM entryId
  path: "/home/ami/compliance",
  absolutePath: "/home/ami/compliance",
  label: "Compliance",
  focus: ""
}

// ↓ buildContentMessage (models.js:102-120)
message = {
  type: "setContentRoot",
  rootKey: "compliance-123",        // ✓ PRESERVED
  path: "/home/ami/compliance",
  label: "Compliance"
}

// ↓ postMessage to iframe
// ✓ SUCCESS: doc.html receives valid rootKey
```

**Result:** ✓ SHOULD WORK (if tab.entryId is preserved)

**IF tab.entryId is missing:**
```javascript
// ↓ buildContentMessageForDir (shell.js:1122-1138)
// ✗ BRANCH 2: tab.entryId is falsy
context = deriveContextFromPath("/home/ami/compliance", cfg)

// ↓ deriveContextFromPath (models.js:63-71)
// ✗ Path doesn't contain '/files/uploads'
context = {
  rootKey: "",                      // ✗ EMPTY STRING
  path: "/home/ami/compliance",
  absolutePath: "/home/ami/compliance",
  label: "compliance",              // ✗ DERIVED from path segment
  focus: ""
}

// ↓ buildContentMessage (models.js:102-120)
message = {
  type: "setContentRoot",
  rootKey: "",                      // ✗ EMPTY STRING
  path: "/home/ami/compliance",
  label: "compliance"               // ✗ WRONG LABEL
}

// ↓ postMessage to iframe
// ✗ FAILURE: doc.html receives empty rootKey
// ✗ API call: fetchTreeChildren('', '') → 404
```

**Result:** ✗ FAILS

---

### Scenario 3: "Uploads" (PRIVILEGED PATH)

```javascript
// Entry from library API
entry = {
  id: "uploads-789",
  kind: "dir",
  path: "/some/path/files/uploads",
  label: "Uploads"
}

// ↓ EVEN WITHOUT entryId:
tab = {
  id: "uploads-789-1234567890",
  entryId: null,                    // ✗ MISSING
  kind: "dir",
  path: "/some/path/files/uploads",
  label: "Uploads"
}

// ↓ buildContentMessageForDir (shell.js:1122-1138)
// ✗ BRANCH 2: tab.entryId is falsy
context = deriveContextFromPath("/some/path/files/uploads", cfg)

// ↓ deriveContextFromPath (models.js:48-61)
// ✓ PRIVILEGED: Path contains '/files/uploads'
context = {
  rootKey: "uploads",               // ✓ HARDCODED
  path: "/some/path/files/uploads",
  absolutePath: "/some/path/files/uploads",
  label: "Uploads",                 // ✓ HARDCODED
  focus: ""
}

// ↓ buildContentMessage (models.js:102-120)
message = {
  type: "setContentRoot",
  rootKey: "uploads",               // ✓ PRESERVED
  path: "/some/path/files/uploads",
  label: "Uploads"
}

// ↓ postMessage to iframe
// ✓ SUCCESS: doc.html receives valid rootKey
```

**Result:** ✓ WORKS (dual privilege path)

---

## EVIDENCE OF DISCRIMINATION

### 1. Hardcoded Special Cases

**Location:** `models.js:48-61`

```javascript
// PRIVILEGED: Only 'uploads' gets automatic rootKey
if (uploadsIndex !== -1) {
  return {
    rootKey: 'uploads',  // ✗ HARDCODED PRIVILEGE
    // ...
  }
}
```

**Discrimination:** "Uploads" path pattern gets automatic `rootKey`, others don't.

---

### 2. Conditional rootKey Assignment

**Location:** `shell.js:1113-1138`

```javascript
if (tab.entryId) {
  // PRIVILEGED: Library entries
  context = {
    rootKey: tab.entryId,  // ✓ DIRECT ASSIGNMENT
    // ...
  }
} else {
  // DISCRIMINATORY: Path-based entries
  context = deriveContextFromPath(path, serverConfig)  // ✗ MAY FAIL
}
```

**Discrimination:** Presence of `entryId` determines code path.

---

### 3. Omitted Fields in Served Content

**Location:** `route.ts:144`

```javascript
// DISCRIMINATORY: Served content iframe injection
postMessage({
  type: 'setContentRoot',
  path: entry.path  // ✗ ONLY PATH, NO rootKey
}, '*')
```

**Discrimination:** Served content NEVER gets `rootKey`, `label`, or `focus`.

---

## COMPLETE LINE NUMBER REFERENCE

### shell.js
- **Lines 21:** Import `deriveContextFromPath`, `buildContentMessage` from models
- **Lines 1105-1139:** `buildContentMessageForDir` function
  - **Line 1113:** Branch condition `if (tab.entryId)`
  - **Lines 1114-1120:** PRIVILEGED PATH (uses entryId as rootKey)
  - **Lines 1122-1138:** DISCRIMINATORY PATH (calls deriveContextFromPath)
  - **Line 1129:** Call to `deriveContextFromPath(path, serverConfig)`
  - **Line 1138:** Call to `buildContentMessage(context)`
- **Lines 1441-1444:** First call to buildContentMessageForDir (tab activation)
- **Lines 1801-1804:** Second call to buildContentMessageForDir (docReady handler)
- **Lines 1625-1668:** `openEntry` function (creates tabs from library entries)
  - **Lines 1640-1649:** Tab object creation (preserves entryId)

### models.js
- **Lines 14-22:** `createContextFromLibraryEntry` (UNUSED in current codebase)
- **Lines 26-40:** `createContextFromMessage` (message → context transform)
- **Lines 45-72:** `deriveContextFromPath` (path → context derivation)
  - **Line 50:** Branch condition `if (uploadsIndex !== -1)`
  - **Lines 51-61:** PRIVILEGED PATH (hardcodes rootKey: 'uploads')
  - **Lines 63-71:** DISCRIMINATORY PATH (sets rootKey: '')
- **Lines 102-120:** `buildContentMessage` (context → message transform)
  - **Line 106:** ALWAYS includes `rootKey: context.rootKey`
  - **Line 110:** Conditional `if (context.label)`
  - **Line 114:** Conditional `if (context.focus)`

### main.js
- **Lines 899-920:** setContentRoot message handler
  - **Line 900:** Log received message
  - **Line 904:** Call `createContextFromMessage`
  - **Lines 913-916:** Update state with context values
  - **Line 914:** `state.rootKey = context.rootKey` (USED FOR API)
  - **Line 919:** Call `startCms(true)`

### route.ts
- **Line 144:** Served content iframe injection
  - Builds HTML with embedded postMessage call
  - ONLY includes `path`, omits `rootKey`, `label`, `focus`

---

## SUMMARY

**Total Code Paths:** 8
**Discriminatory Paths:** 4 (Paths 2, 4, 5, and the false branch of Path 1)
**Privileged Paths:** 2 (Path 1 with entryId, Path 3 for uploads)
**Faithful Transforms:** 3 (Paths 6, 7, 8)

**Core Issue:** The presence or absence of `tab.entryId` creates a **class hierarchy** where:
- **FIRST CLASS:** Library entries with `entryId` → Direct rootKey assignment
- **SECOND CLASS:** "Uploads" paths → Hardcoded rootKey
- **THIRD CLASS:** All other paths → Empty rootKey (FAILS)

**Immediate Impact:**
- "Compliance" library entries FAIL if `tab.entryId` is missing or not preserved
- Served content via route.ts ALWAYS FAILS (no rootKey in iframe message)
- Any library entry except "Uploads" and "Docs" is at risk

**Required Fix:**
1. Ensure `tab.entryId` is ALWAYS preserved during tab lifecycle
2. Update served content iframe injection to include `rootKey` from `entry.id`
3. Eliminate path-based derivation for library entries (use entryId exclusively)

---

**END OF AUDIT**
