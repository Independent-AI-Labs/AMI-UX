# Fallback Elimination - REVISED Analysis

**Policy:** The word "fallback" is BANNED. More critically, **FALLBACK MECHANISMS ARE CANCER**.

This analysis distinguishes between:
- ❌ **TRUE FALLBACKS** - Silent error recovery mechanisms that MUST BE REMOVED
- ⚠️ **VARIABLE NAMES** - Not mechanisms, just need renaming
- ℹ️ **DOCUMENTATION** - Just reword

---

## CRITICAL FINDINGS: TRUE FALLBACKS TO REMOVE

### 🔴 CRITICAL #1: Auth Guest User Fallback Logic

**Location:** `auth/src/config.ts:478-511`

**The Problem:**
```typescript
function normaliseGuestUser(payload: AuthenticatedUser | null): AuthenticatedUser {
  const fallback: AuthenticatedUser = { /* complete user object */ }

  if (!payload) return fallback  // ❌ FALLBACK MECHANISM

  return {
    id: payload.id && payload.id.trim() ? payload.id : fallback.id,     // ❌ FALLBACK
    name: payload.name ?? fallback.name,                                 // ❌ FALLBACK
    image: payload.image ?? fallback.image,                              // ❌ FALLBACK
    groups: Array.isArray(payload.groups) ? payload.groups : fallback.groups, // ❌ FALLBACK
  }
}
```

**Why This is Cancer:**
1. **Silent data loss** - Missing `payload.id`? Use fallback. Why is it missing? Unknown.
2. **Masks bugs** - If `payload.id` is empty string, silently use fallback.id
3. **No validation** - Never throws error for invalid data
4. **Audit trail corruption** - Cannot distinguish "user has no name" from "name was missing so we used fallback"

**What SHOULD Happen:**
- If `payload` is null → THROW ERROR (why are we normalizing null?)
- If `payload.id` is missing/empty → THROW ERROR (invalid user data)
- If `payload.name` is null → Fine, users can have null names
- If `payload.groups` is not an array → THROW ERROR (invalid data)

**Action Required:** ❌ **REMOVE FALLBACK LOGIC**
```typescript
function normaliseGuestUser(payload: AuthenticatedUser | null): AuthenticatedUser {
  if (!payload) {
    throw new ValidationError('Cannot normalize null user payload')
  }

  if (!payload.id || !payload.id.trim()) {
    throw new ValidationError('User payload missing required field: id')
  }

  if (!payload.email || !payload.email.trim()) {
    throw new ValidationError('User payload missing required field: email')
  }

  if (!Array.isArray(payload.groups)) {
    throw new ValidationError('User payload has invalid groups field (must be array)')
  }

  const email = payload.email.toLowerCase()
  const ensuredRoles = Array.from(new Set([...(payload.roles ?? []), 'guest']))
  const metadataBase = (payload.metadata && isRecord(payload.metadata) ? payload.metadata : {}) as Record<string, unknown>

  return {
    id: payload.id.trim(),
    email,
    name: payload.name ?? null,  // Null is valid for names
    image: payload.image ?? null, // Null is valid for images
    roles: ensuredRoles,
    groups: payload.groups,
    tenantId: payload.tenantId ?? null,
    metadata: {
      ...metadataBase,
      accountType: readMetadataString(metadataBase, 'accountType', 'guest'),
      managedBy: readMetadataString(metadataBase, 'managedBy', 'cms-login'),
    },
  }
}
```

**Impact:** 16 lines removed, replaced with explicit validation

---

### 🔴 CRITICAL #2: Modal Path Fallback Mechanism

**Location:** `cms/public/js/modal.js:1640-1695`

**The Problem:**
```javascript
let fallbackAbsolute = ''
let fallbackRelative = ''
let fallbackRootKey = typeof job?.root === 'string' ? job.root : ''

// Collect fallbacks from payloads
for (const item of payloads) {
  if (typeof data.rootAbsolute === 'string' && !fallbackAbsolute) {
    fallbackAbsolute = data.rootAbsolute  // ❌ FALLBACK MECHANISM
  }
  if (typeof data.rootRelative === 'string' && !fallbackRelative) {
    fallbackRelative = data.rootRelative  // ❌ FALLBACK MECHANISM
  }
}

// Later: Use fallbacks when computation fails
if (!rootAbsolute) rootAbsolute = toPosixPath(fallbackAbsolute)  // ❌ SILENT FAILURE
if (!rootRelative && fallbackRelative) {
  rootRelative = toPosixPath(fallbackRelative)  // ❌ SILENT FAILURE
}
const rootKey = rootKeys.size === 1 ? Array.from(rootKeys)[0] : fallbackRootKey || ''  // ❌ SILENT FAILURE
```

**Why This is Cancer:**
1. **Silent failure** - `commonDirectory()` fails? Use fallback. Why did it fail? Unknown.
2. **Inconsistent state** - Multiple payloads with different roots? Pick first one as "fallback"
3. **Masks bugs** - If path computation fails, we never know why
4. **No error to user** - UI shows wrong path silently

**What SHOULD Happen:**
- If `commonDirectory()` returns empty → THROW ERROR or show user a modal: "Cannot determine common directory - please select manually"
- If `rootKeys.size !== 1` → THROW ERROR "Ambiguous root keys - upload contains files from multiple roots"
- If no root found → Require user input, don't guess

**Action Required:** ❌ **REMOVE FALLBACK LOGIC**
```javascript
// Remove fallback variables entirely
const rootKeys = new Set()
let rootLabel = typeof job?.rootLabel === 'string' ? job.rootLabel : ''
let rootBaseAbsolute = ''
let rootBaseRelative = ''

for (const item of payloads) {
  // Just collect data, no fallback collection
  if (typeof data.rootKey === 'string') {
    rootKeys.add(data.rootKey)
  }
  // ... other collection
}

// Fail explicitly when computation fails
const rootAbsolute = commonDirectory(absolutePaths)
if (!rootAbsolute) {
  throw new Error('Cannot determine root directory from uploaded files - paths have no common ancestor')
}

const rootRelative = commonDirectory(repoPaths) || commonDirectory(relativeInputs)
if (!rootRelative) {
  throw new Error('Cannot determine relative root directory')
}

if (rootKeys.size !== 1) {
  throw new Error(`Upload contains files from multiple root keys: ${Array.from(rootKeys).join(', ')}`)
}
const rootKey = Array.from(rootKeys)[0]
```

**Impact:** Remove ~20 lines of fallback logic, replace with explicit validation

---

### 🟡 MEDIUM #3: Tab Label Fallback

**Location:** `cms/public/js/tab-strip.js:113-114`

**The Problem:**
```javascript
const fallback = String(tab.label || '').trim()
const finalLabel = cancelled ? fallback : trimmed || fallback || 'Untitled'
```

**Why This is Problematic:**
1. **Chained fallbacks** - `trimmed || fallback || 'Untitled'` - Three levels of fallback
2. **Silent empty string** - Empty input → Use old label (cancelled=false but trimmed='')
3. **"Untitled" as last resort** - Magic string fallback

**What SHOULD Happen:**
- If user enters empty string (not cancelled) → REJECT: "Label cannot be empty"
- If cancelled → Keep original label (this is fine)
- No "Untitled" fallback - require valid input

**Action Required:** ⚠️ **SIMPLIFY LOGIC**
```javascript
const originalLabel = String(tab.label || 'Untitled').trim()

if (cancelled) {
  // User cancelled - keep original
  return
}

const trimmed = String(nextValue ?? '').trim()
if (!trimmed) {
  showToast('Label cannot be empty', { tone: 'error' })
  return  // Don't change label
}

if (trimmed !== tab.label) {
  tab.label = trimmed
  if (typeof opts.onRename === 'function') {
    opts.onRename(tab.id, trimmed)
  }
}
```

**Impact:** Remove fallback chain, require valid input

---

### 🟡 MEDIUM #4: Folder Creation Path Fallback

**Location:** `cms/public/js/modal.js:452-455`

**The Problem:**
```javascript
const fallbackPath = sanitizedBase ? `${sanitizedBase}/${folderName}` : folderName
pendingSelectionRef.current = {
  rootKey: data.rootKey || selectedDetail.rootKey,
  path: data.path || fallbackPath,  // ❌ FALLBACK
}
```

**Why This is Problematic:**
1. **Silent path construction** - `data.path` missing? Construct one silently
2. **Inconsistent behavior** - Sometimes uses `data.path`, sometimes constructs
3. **No validation** - Is `fallbackPath` even valid?

**What SHOULD Happen:**
- API should ALWAYS return `data.path` for created folder
- If `data.path` is missing → THROW ERROR "API did not return path for created folder"
- Remove fallback construction

**Action Required:** ❌ **REMOVE FALLBACK**
```javascript
if (!data.path) {
  throw new Error('API failed to return path for created directory')
}

pendingSelectionRef.current = {
  rootKey: data.rootKey || selectedDetail.rootKey,
  path: data.path,
}
```

**Impact:** Remove path construction fallback, require API to return path

---

### 🟢 LOW #5: Panel "Fallback to Composer" Function

**Location:** `cms/packages/highlight-core/src/highlight-plugin/ui/panel.js:887-946`

**Analysis:**
```javascript
const fallbackToComposer = () => {
  if (this.triggerComposer && typeof this.triggerComposer.open === 'function') {
    return this.triggerComposer.open({ ... })
  }
  return Promise.resolve()
}

// Called when other operations fail
if (!canDoThing) {
  return fallbackToComposer()  // ⚠️ "Fallback" = Alternative action
}
```

**Is This Cancer?**
- ⚠️ **Borderline** - This is more "alternative action" than "silent failure"
- The function DOES something (opens composer), not hiding an error
- BUT the name "fallback" suggests this is second-choice/error recovery

**Action Required:** ⚠️ **RENAME + RETHINK**
```javascript
// Option 1: Rename to show intent
const openComposerAsAlternative = () => { ... }

// Option 2: Be explicit about the condition
if (!canCreateInline) {
  console.warn('[panel] Cannot create inline trigger, opening full composer instead')
  return openComposer()
}

// Option 3: Ask user
if (!canCreateInline) {
  const choice = await showDialog('Cannot create inline trigger. Open full composer?')
  if (choice === 'yes') return openComposer()
  return null
}
```

**Impact:** Rename function OR add explicit user notification

---

### 🟢 LOW #6: Highlight Plans "Fallback Plans"

**Location:** `cms/packages/highlight-core/src/highlight-plugin/core/effects.js:982-1245`

**Analysis:**
```javascript
const fallbackPlans = []  // Plans that match using generic selectors

// Add plans that don't have specific ID/class selectors
if (!plan.id && !plan.classes.length) {
  fallbackPlans.push(planRef)  // ⚠️ "Fallback" = Generic/wildcard plans
}

// Later: Check fallback plans if nothing else matched
if (fallbackPlans.length) collectPlans(fallbackPlans, seenPlans, candidates)
```

**Is This Cancer?**
- ✅ **NO** - This is algorithm terminology, not error recovery
- Plans are categorized: specific (by ID/class) vs generic (by tag/*)
- "Fallback" just means "less specific selector"
- No silent failure - all plans are intentionally checked

**Action Required:** ✅ **RENAME ONLY**
```javascript
const genericPlans = []  // Plans that use generic selectors (tag, *)
```

**Impact:** Simple rename, no logic change

---

### 🟢 LOW #7: Progressive Enhancement Textarea

**Location:** `cms/packages/highlight-core/src/highlight-plugin/ui/trigger-dialog.js:171-180`

**Analysis:**
```javascript
if (!ready || !this.SyntaxEditor || !this.ReactDOM) {
  // Progressive enhancement: Use textarea fallback when Monaco/React unavailable
  const fallback = this.document.createElement('textarea')
  // ⚠️ "Fallback" = Graceful degradation
}
```

**Is This Cancer?**
- ✅ **NO** - This is textbook progressive enhancement
- Monaco editor fails → Textarea still works
- User can still complete their task
- This is a FEATURE, not a bug masker

**Action Required:** ✅ **RENAME ONLY**
```javascript
// Progressive enhancement: Use basic textarea when Monaco unavailable
const basicEditor = this.document.createElement('textarea')
basicEditor.className = 'trigger-dialog__textarea-basic'
```

**Impact:** Simple rename, preserve functionality

---

## Summary: REMOVE vs RENAME

### ❌ MUST REMOVE (True Fallback Mechanisms)

| Location | Lines | Mechanism | Action |
|----------|-------|-----------|--------|
| `auth/src/config.ts` | 480-510 | Silent field fallbacks | Replace with validation |
| `cms/public/js/modal.js` | 1640-1695 | Path fallback collection | Remove, require valid paths |
| `cms/public/js/modal.js` | 452-455 | Folder path construction | Remove, require API path |
| `cms/public/js/tab-strip.js` | 113-114 | Chained label fallbacks | Require valid input |

**Total to remove:** ~60 lines of fallback logic

---

### ⚠️ SHOULD RETHINK (Borderline Cases)

| Location | Mechanism | Action |
|----------|-----------|--------|
| `cms/packages/highlight-core/src/highlight-plugin/ui/panel.js` | "fallbackToComposer" | Rename + add user notification |

---

### ✅ RENAME ONLY (Not Real Fallbacks)

| Location | What it is | New Name |
|----------|------------|----------|
| `cms/packages/highlight-core/src/highlight-plugin/core/effects.js` | Generic selector plans | `genericPlans` |
| `cms/packages/highlight-core/src/highlight-plugin/ui/trigger-dialog.js` | Basic textarea editor | `basicEditor` |
| `cms/packages/highlight-core/src/highlight-plugin/core/effects.js` | Target element param | `targetEl` |
| Documentation | Explanatory text | "default", "alternative" |

---

## Revised Elimination Plan

### Phase 1: REMOVE True Fallbacks (HIGH PRIORITY)

1. ✅ **Auth validation** - Remove guest user field fallbacks
2. ✅ **Modal path logic** - Remove path fallback collection
3. ✅ **Tab labels** - Remove fallback chains
4. ✅ **Folder creation** - Remove path construction

**Estimated time:** 2 hours
**Risk:** MEDIUM - Changes logic, requires testing

---

### Phase 2: Rename Variables (LOW PRIORITY)

1. ✅ Rename `genericPlans`, `basicEditor`, `targetEl`
2. ✅ Reword documentation

**Estimated time:** 30 minutes
**Risk:** LOW - Simple renames

---

## Success Criteria

✅ Zero "fallback" instances in codebase
✅ Zero silent error recovery mechanisms
✅ All validation explicit with clear errors
✅ Users notified when operations fail
✅ All builds pass
✅ Integration tests pass

---

**Ready to execute REMOVAL phase?** This is more invasive than renaming - it changes behavior to fail explicitly instead of silently recovering.
