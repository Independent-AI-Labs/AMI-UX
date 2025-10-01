# Complete Fallback Elimination Plan

**Target:** Eliminate ALL 139 remaining "fallback" instances
**Policy:** ZERO TOLERANCE - The word is banned, no exceptions

---

## Current State

**Total remaining:** 139 instances across 5 directories

| Directory | Count | Strategy |
|-----------|-------|----------|
| Documentation | 8 | Reword explanations |
| auth/src | 16 | Rename variables |
| cms/packages | 70+ | Rename variables/functions/CSS |
| cms/public/js | 20+ | Rename variables |
| ui-concept | 4 | Rename comments/CSS |

---

## Elimination Strategy by Category

### 1. Auth Module (16 instances) - RENAME VARIABLES

**File:** `auth/src/config.ts`

**Current Pattern:**
```typescript
const fallback: AuthenticatedUser = { ... }
return {
  id: payload.id || fallback.id,
  name: payload.name ?? fallback.name,
}
```

**Replacement Options:**
- ✅ `template` - Describes purpose (template for missing values)
- ✅ `defaults` - Standard default values
- ✅ `baseUser` - Base user object

**Recommended:** `template`

**Action:**
- Rename all `fallback` variables to `template`
- Update JSDoc parameter names
- 16 replacements in 1 file

---

### 2. Highlight Plugin - Progressive Enhancement (8 instances)

**File:** `cms/packages/highlight-core/src/highlight-plugin/ui/trigger-dialog.js`

**Current Pattern:**
```javascript
// Progressive enhancement: Use textarea fallback when Monaco/React unavailable
const fallback = this.document.createElement('textarea')
fallback.className = 'trigger-dialog__textarea-fallback'
```

**Replacement Options:**
- ✅ `basicEditor` - Describes what it is
- ✅ `textareaEditor` - Explicit naming
- ✅ `simpleInput` - Simple alternative

**Recommended:** `basicEditor`

**CSS Class Rename:**
- `trigger-dialog__textarea-fallback` → `trigger-dialog__textarea-basic`

**Action:**
- Rename variable to `basicEditor`
- Rename CSS class to `trigger-dialog__textarea-basic`
- Update comment: "Use basic textarea when Monaco unavailable"
- 8 replacements in 2 files (JS + CSS)

---

### 3. Highlight Plugin - Plans Algorithm (10 instances)

**File:** `cms/packages/highlight-core/src/highlight-plugin/core/effects.js`

**Current Pattern:**
```javascript
const fallbackPlanCache = new Map()
const fallbackPlans = []
// Plans that don't match by ID/class/tag go into fallbackPlans
```

**Replacement Options:**
- ✅ `genericPlanCache` - Generic selector plans
- ✅ `tagBasedPlans` - Tag-based matching plans
- ✅ `wildcardPlans` - Wildcard matching

**Recommended:** `genericPlans` (concise, accurate)

**Action:**
- Rename `fallbackPlanCache` → `genericPlanCache`
- Rename `fallbackPlans` → `genericPlans`
- Update comments to reference "generic" instead of "fallback"
- 10 replacements in 1 file

---

### 4. UI Default Values (70+ instances in cms/public/js/)

**Files:** `tab-strip.js`, `modal.js`, `shell.js`

**Current Patterns:**
```javascript
const fallback = String(tab.label || '').trim()
const fallbackPath = sanitizedBase ? `${sanitizedBase}/${folderName}` : folderName
let fallbackAbsolute = ''
let fallbackRelative = ''
```

**Replacement Strategy:**
| Current | Replacement | Reason |
|---------|-------------|--------|
| `fallback` (label) | `originalLabel` | Preserves original value |
| `fallbackPath` | `constructedPath` | Describes how it's built |
| `fallbackAbsolute` | `defaultAbsolute` | Default absolute path |
| `fallbackRelative` | `defaultRelative` | Default relative path |
| `fallbackRootKey` | `defaultRootKey` | Default root key |

**Action:**
- Context-specific renames based on usage
- ~20 replacements across 3 files

---

### 5. Panel UI Functions (5 instances)

**File:** `cms/packages/highlight-core/src/highlight-plugin/ui/panel.js`

**Current Pattern:**
```javascript
const fallbackToComposer = () => { ... }
return fallbackToComposer()
```

**Replacement Options:**
- ✅ `switchToComposer` - Action-oriented
- ✅ `useComposer` - Describes behavior
- ✅ `defaultToComposer` - Default behavior

**Recommended:** `switchToComposer`

**Action:**
- Rename function to `switchToComposer`
- Update comment: "Switch to composer view"
- 5 replacements in 1 file

---

### 6. Pointer Extraction (3 instances)

**File:** `cms/packages/highlight-core/src/highlight-plugin/core/effects.js`

**Current Pattern:**
```javascript
function extractPointer(event, fallbackEl) {
  if (fallbackEl && typeof fallbackEl.getBoundingClientRect === 'function') {
    const rect = fallbackEl.getBoundingClientRect()
```

**Replacement Options:**
- ✅ `targetEl` - Target element for pointer
- ✅ `contextEl` - Context element
- ✅ `referenceEl` - Reference element for positioning

**Recommended:** `targetEl`

**Action:**
- Rename parameter `fallbackEl` → `targetEl`
- 3 replacements in 1 file

---

### 7. Documentation (8 instances) - REWORD

**Files:** `SPEC-META.md`, `auth/README.md`, `research/*.md`, `cms/docs/*.md`

**Current Examples:**
- "Fallback when nothing configured"
- "local fallbacks"
- "supply fallbacks"
- "offline fallback"

**Replacement Strategy:**
| Current Phrase | Replacement |
|----------------|-------------|
| "Fallback when nothing configured" | "Default when nothing configured" |
| "local fallbacks" | "local defaults" |
| "supply fallbacks" | "supply defaults" OR "provide alternatives" |
| "offline fallback" | "offline mode" |
| "fallback toggle" | "default toggle" |
| "fallback directory" | "default directory" |

**Action:**
- Reword all documentation instances
- 8 replacements across 5 files

---

### 8. UI Comments and CSS (4 instances)

**Files:** `ui-concept/src/app/tileManager.js`, `conversationManager.js`, `styles/video-backdrop.css`

**Current:**
```javascript
// Fallback: find any available even column
// Get position for a message (with fallback for legacy messages)
.video-fallback { }
```

**Replacements:**
```javascript
// Alternative: find any available even column
// Get position for a message (with legacy message support)
.video-alternative { }
```

**Action:**
- Reword comments
- Rename CSS class
- 4 replacements across 3 files

---

## Execution Plan

### Phase 1: Auth Module (Highest Priority)
- **File:** `auth/src/config.ts`
- **Action:** Rename all `fallback` → `template`
- **Risk:** LOW - Variable rename only
- **Time:** 5 minutes

### Phase 2: Highlight Plugin Core
- **Files:** `cms/packages/highlight-core/src/highlight-plugin/core/effects.js`
- **Action:**
  - Rename `fallbackPlans` → `genericPlans`
  - Rename `fallbackPlanCache` → `genericPlanCache`
  - Rename `fallbackEl` → `targetEl`
- **Risk:** LOW - Internal variables
- **Time:** 10 minutes

### Phase 3: Highlight Plugin UI
- **Files:**
  - `cms/packages/highlight-core/src/highlight-plugin/ui/trigger-dialog.js`
  - `cms/packages/highlight-core/src/highlight-plugin/ui/panel.js`
  - `cms/packages/highlight-core/src/highlight-plugin/ui/styles.js`
- **Action:**
  - Rename `fallback` → `basicEditor`
  - Rename CSS class `trigger-dialog__textarea-fallback` → `trigger-dialog__textarea-basic`
  - Rename `fallbackToComposer` → `switchToComposer`
- **Risk:** MEDIUM - CSS class change requires consistency
- **Time:** 15 minutes

### Phase 4: CMS Public JS
- **Files:** `cms/public/js/tab-strip.js`, `modal.js`, `shell.js`
- **Action:** Context-specific renames for each variable
- **Risk:** LOW - UI display logic
- **Time:** 20 minutes

### Phase 5: UI Concept
- **Files:** `ui-concept/src/app/*.js`, `ui-concept/src/app/styles/*.css`
- **Action:** Reword comments, rename CSS
- **Risk:** LOW - Comments and CSS only
- **Time:** 5 minutes

### Phase 6: Documentation
- **Files:** All `.md` files
- **Action:** Reword explanations
- **Risk:** NONE - Documentation only
- **Time:** 10 minutes

### Phase 7: Rebuild & Verify
- **Action:**
  - Run highlight-core build
  - Run TypeScript compilation
  - Run banned words checker
  - Verify zero "fallback" instances
- **Time:** 10 minutes

---

## Total Effort Estimate

**Total instances:** 139
**Total files:** ~15 files
**Total time:** ~75 minutes (1.25 hours)

---

## Verification Checklist

After completion, verify:

- [ ] Auth module compiles cleanly
- [ ] Highlight-core builds successfully
- [ ] CMS TypeScript compiles
- [ ] UI-concept renders correctly
- [ ] `python3 scripts/check_banned_words.py` reports **0 instances**
- [ ] All CSS classes updated consistently
- [ ] Documentation reads naturally
- [ ] No broken references

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|------------|------------|
| Auth module | LOW | Simple variable rename |
| Highlight core | LOW | Internal implementation |
| Highlight UI | MEDIUM | CSS class rename - verify consistency |
| CMS public JS | LOW | UI logic only |
| UI concept | LOW | Comments/CSS only |
| Documentation | NONE | Text only |

**Overall Risk:** LOW - Most changes are variable/CSS renames

---

## Success Criteria

✅ Zero instances of "fallback" in source code
✅ Zero instances of "fallback" in documentation
✅ All builds successful
✅ All TypeScript compilation clean
✅ Banned words checker passes with 0 violations

---

## Rollback Plan

If issues arise:
1. Git revert to current state
2. Review specific file causing issue
3. Apply more conservative rename
4. Re-run verification

---

## Post-Elimination

After all instances eliminated:

1. Update `FALLBACK-REMEDIATION-SUMMARY.md` with final count
2. Update `REPORT-FALLBACKS.md` conclusion
3. Commit changes with message: "refactor: eliminate all 'fallback' terminology (banned word)"
4. Archive elimination plan

---

**Ready to execute?** This plan will eliminate all 139 instances in ~75 minutes with LOW risk.
