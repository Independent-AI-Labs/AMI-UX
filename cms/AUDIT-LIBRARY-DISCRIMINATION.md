# Library Entry Discrimination Audit Report

**Generated**: 2025-10-04
**Scope**: Complete UX CMS codebase analysis for special-case handling of library entries

---

## Executive Summary

This audit identifies ALL instances where library entries are treated differently based on specific criteria like entry ID, path, label, or kind. The CMS contains EXTENSIVE discriminatory logic that violates the principle of uniform entry handling.

---

## 1. HARDCODED PATH DISCRIMINATION

### 1.1 "docs" Path Special Treatment

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/lib/store.ts`

#### Lines 163-186: `ensureDefaultLibraryEntry` function
```typescript
async function ensureDefaultLibraryEntry(entries: LibraryEntry[]): Promise<LibraryEntry[]> {
  const docsPath = path.resolve(repoRoot, 'docs')
  const docsId = createHash('sha1').update(docsPath).digest('hex').slice(0, 12)

  const hasDocsEntry = entries.some(e => e.id === docsId)
  if (!hasDocsEntry) {
    try {
      const stat = await fs.stat(docsPath)
      if (stat.isDirectory()) {
        const newEntry: LibraryEntry = {
          id: docsId,
          path: docsPath,
          kind: 'dir',
          label: 'Docs',
          createdAt: Date.now()
        }
        return [newEntry, ...entries]
      }
    } catch {
      // docs directory doesn't exist, skip default entry
    }
  }
  return entries
}
```

**Discrimination Type**:
- HARDCODED path `${repoRoot}/docs` receives automatic entry creation
- HARDCODED label "Docs" applied only to this path
- HARDCODED prepend position (inserted at array index 0)
- NO OTHER paths receive this treatment

**Called By**: Lines 188-193 in `listLibrary()` function

---

### 1.2 "uploads" Path Special Treatment

**Multiple Locations Throughout Codebase**

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/models.js`

**Lines 9, 48-60**: Uploads marker detection
```javascript
const UPLOADS_MARKER = '/files/uploads'

// Check if path is in uploads
const uploadsIndex = normalized.indexOf(UPLOADS_MARKER)
if (uploadsIndex !== -1) {
  const uploadsBase = normalized.slice(0, uploadsIndex + UPLOADS_MARKER.length)
  const relativePath = normalized.slice(uploadsBase.length).replace(/^\/+/, '')

  return {
    rootKey: 'uploads',
    path: uploadsBase,
    absolutePath: uploadsBase,
    label: 'Uploads',
    focus: relativePath,
  }
}
```

**Lines 30, 78-79**: Special label handling
```javascript
const label = message.label || (rootKey === 'uploads' ? 'Uploads' : 'Content')

if (context.rootKey === 'uploads') {
  return context.label ? `Uploads workspace sourced from ${context.label}` : 'Uploads workspace'
}
```

**Discrimination Type**:
- HARDCODED path pattern `/files/uploads` receives special rootKey
- HARDCODED label "Uploads" for this path
- HARDCODED subtitle text different from other entries

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Lines 726-732**: Metadata context uploads detection
```javascript
const uploadsMarker = '/files/uploads'
const uploadsIndex = normalized.indexOf(uploadsMarker)
if (uploadsIndex !== -1) {
  const relative = normalized.slice(uploadsIndex + uploadsMarker.length).replace(/^\/+/, '')
  context.rootKey = 'uploads'
  context.rootLabel = 'Uploads'
  context.relativePath = relative
  return context
}
```

**Lines 1094-1103**: `uploadsBaseFromPath` function
```javascript
function uploadsBaseFromPath(originalPath) {
  const normalized = normalizeFsPath(originalPath)
  const marker = '/files/uploads'
  const idx = normalized.indexOf(marker)
  if (idx === -1) return { baseOriginal: '', baseNormalized: '' }
  const baseEnd = idx + marker.length
  const baseOriginal = originalPath.slice(0, baseEnd)
  const baseNormalized = normalized.slice(0, baseEnd)
  return { baseOriginal, baseNormalized }
}
```

**Lines 1475-1479**: File tab activation special handling
```javascript
const uploadsMarker = '/files/uploads/'
const uploadsIdx = normalizedPath.indexOf(uploadsMarker)
if (uploadsIdx !== -1) {
  rel = normalizedPath.slice(uploadsIdx + uploadsMarker.length)
  root = 'uploads'
}
```

**Discrimination Type**:
- HARDCODED path pattern `/files/uploads` treated differently
- Different rootKey assignment logic
- Different label assignment logic
- Different relative path calculation

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/main.js`

**Lines 278, 717, 729, 794**: Multiple upload-specific name/label assignments
```javascript
name: nodeInfo.name || (rootKey === 'uploads' ? 'Uploads' : 'Docs'),

const contextTag = activeRootKey === 'uploads' ? 'uploads' : state.contentRootAbsolute || ''

state.rootLabelOverride || (activeRootKey === 'uploads' ? 'Uploads' : '')

const treeName = tree?.name || (activeRootKey === 'uploads' ? 'Uploads' : 'Docs')
```

**Discrimination Type**:
- CONDITIONAL name assignment based on rootKey
- Different default labels for uploads vs. other entries
- Different cache context tagging

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/upload/route.ts`

**Lines 26, 38-39, 41, 43-48**: Upload API hardcoded uploads root
```typescript
const uploadsRoot = sharedUploadsRoot

if (rootParam && rootParam !== 'uploads') {
  throw new Error('Only uploads root is supported')
}
const metaBase = path.resolve(appRoot, 'data/upload-meta/uploads')

await ensureDir(uploadsRoot)
const relativeBase = path.relative(repoRoot, uploadsRoot)
return {
  key: 'uploads',
  base: uploadsRoot,
  label: 'Uploads',
  // ...
}
```

**Discrimination Type**:
- HARDCODED restriction to 'uploads' root only
- Explicit error thrown for other roots
- HARDCODED label "Uploads"

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/library/[id]/delete/route.ts`

**Lines 21-24**: Delete restriction to uploads only
```typescript
// Guard: only allow deletion under files/uploads for now
const uploadsDir = path.resolve(process.cwd(), 'files/uploads')

if (!abs.startsWith(uploadsDir + path.sep) && abs !== uploadsDir) {
  // deletion blocked
}
```

**Discrimination Type**:
- HARDCODED safety restriction only allowing uploads deletion
- Other paths cannot be deleted via API

---

### 1.3 "contentRoot" Special Treatment

**Multiple Locations**

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Lines 736-742**: ContentRoot detection in metadata context
```javascript
const contentRootAbs = cachedConfig?.contentRootAbsolute ? normalizeFsPath(cachedConfig.contentRootAbsolute) : ''
if (contentRootAbs) {
  if (normalized === contentRootAbs || normalized.startsWith(`${contentRootAbs}/`)) {
    context.rootKey = 'contentRoot'
    context.rootLabel = cachedConfig?.contentRootLabel || 'Docs'
    context.relativePath = normalized === contentRootAbs ? '' : normalized.slice(contentRootAbs.length + 1)
    return context
  }
}
```

**Lines 1473, 1481-1490**: File mode handling
```javascript
let root = 'contentRoot'
// ...
const contentRootNormalized = normalizeFsPath(cfg.contentRootAbsolute || cfg.contentRoot || '').replace(/\/+$/, '')
if (contentRootNormalized) {
  if (normalizedPath === contentRootNormalized) {
    rel = ''
  } else if (normalizedPath.startsWith(contentRootNormalized + '/')) {
    rel = normalizedPath.slice(contentRootNormalized.length + 1)
  } else {
    rel = normalizedPath
  }
}
```

**Discrimination Type**:
- Config-driven but still special rootKey assignment
- Different default label "Docs" fallback
- Different relative path calculation

#### `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/modal.js`

**Lines 480-481, 1256, 1461, 1557, 1560, 1667, 2199, 2346-2347, 2374, 2514, 2517**: ContentRoot special handling
```javascript
// Sort order discrimination
if (value.key === 'contentRoot') return 0

// Query parameter discrimination
const query = opt.key === 'contentRoot' ? '' : `?root=${encodeURIComponent(opt.key)}`

// Default selection discrimination
const [uploadRoot, setUploadRoot] = useState('contentRoot')

// Priority selection
writableList.find((item) => item.key === 'contentRoot') ||

// Label override
if (rootKey === 'contentRoot' && rootLabel) {
  // special handling
}

// Label fallback
explicitLabel || rootInfo?.label || (root === 'contentRoot' ? 'Doc Root' : root)

// Priority placement
const contentRootOpt = writableRootOptions.find((opt) => opt && opt.key === 'contentRoot') || null
if (contentRootOpt) addOption(contentRootOpt.path, contentRootOpt.label || 'Doc Root')

// Filter discrimination
.filter((opt) => opt && opt.key && opt.key !== 'contentRoot')
```

**Discrimination Type**:
- HARDCODED sort order (always first)
- DIFFERENT query parameter handling (empty vs. explicit)
- HARDCODED default selection
- DIFFERENT label fallback logic
- DIFFERENT filtering rules

---

## 2. ENTRY ID DISCRIMINATION

### 2.1 "docs" Entry ID

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/lib/store.ts`

**Lines 165, 167**: Docs ID generation and detection
```typescript
const docsId = createHash('sha1').update(docsPath).digest('hex').slice(0, 12)

const hasDocsEntry = entries.some(e => e.id === docsId)
```

**Discrimination Type**:
- Specific ID checked for existence
- Only this ID triggers auto-creation logic

---

### 2.2 Entry ID Equality Checks Throughout

**Multiple Locations**

All instances where `entry.id ===` or `e.id ===` appear:

#### API Routes
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/serve/[id]/route.ts:11,19`
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/served/[id]/[[...path]]/route.ts:66,69`
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/serve/route.ts:23,26,27`
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/library/[id]/route.ts:12,13`
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/library/[id]/delete/route.ts:19`
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/library/route.ts:123,130,131`

#### Client Code
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js:1634,1697,1911`
- `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/modal.js:2643,2877`

**Discrimination Type**:
- Entries selected/rejected based on specific IDs
- Serving status tied to specific IDs
- Library operations conditional on ID matches

---

## 3. LABEL FIELD DISCRIMINATION

### 3.1 Label Presence Affects Behavior

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/lib/store.ts`

**Line 176**: Hardcoded label for docs entry
```typescript
label: 'Docs',
```

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/library/route.ts`

**Lines 125, 131-132**: Label update logic
```typescript
if (typeof body.label === 'string') entry.label = body.label

if (idx !== -1 && typeof body.label === 'string') {
  list[idx] = { ...list[idx], label: body.label }
```

**Discrimination Type**:
- Only specific entries receive hardcoded labels
- Label updates only accepted for string values
- Label presence affects display behavior

### 3.2 Label Display Logic

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Lines 1116-1120, 1131-1134**: Tab label override
```javascript
label: tab.label || (tab.kind === 'file' ? humanizeName(baseName, 'file') : baseName)

// Override label if tab has custom label
if (tab.label) {
  context.label = tab.label
}
```

**Lines 1532-1533**: Label priority in serving
```javascript
if (typeof tab.label === 'string' && tab.label.trim()) return tab.label.trim()
```

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/models.js`

**Lines 30, 84-88, 110-112**: Label fallbacks and conditionals
```javascript
const label = message.label || (rootKey === 'uploads' ? 'Uploads' : 'Content')

if (context.label && context.label !== context.absolutePath) {
  parts.push(context.label)
}

if (context.label) {
  msg.label = context.label
}
```

**Discrimination Type**:
- DIFFERENT label resolution based on entry type
- DIFFERENT fallback logic for different rootKeys
- CONDITIONAL label inclusion in messages

---

## 4. ENTRY KIND DISCRIMINATION

### 4.1 Kind-Based Behavior Differences

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Lines 621-644**: Status pill rendering per kind
```javascript
if (tab.kind === 'app') {
  if (tab.path) {
    const r = await fetch(`/api/app/status?path=${encodeURIComponent(tab.path)}`)
    // app-specific logic
  }
  pill.textContent = 'App: Unknown'
  return
}
if (tab.kind === 'file') {
  const mode = tab.mode || 'A'
  pill.textContent = `Mode ${mode}`
  return
}
if (tab.kind === 'dir') {
  pill.textContent = ''
  return
}
```

**Lines 1228-1232**: Tab indicator based on kind
```javascript
const isRunningApp = t.kind === 'app' && !!appRunning.get(t.path)
const showPill = !!t.servedId || isRunningApp
const baseName = t.path.split('/').pop() || t.path
const tabLabel = t.label || (t.kind === 'file' ? humanizeName(baseName, 'file') : baseName)
```

**Lines 1293-1295, 1305-1306**: Context menu per kind
```javascript
const canStart = !!tab.entryId && !isServing

disabled: !canStart,
```

**Lines 1403-1404, 1429-1433**: Body class per kind
```javascript
const baseIntent = tab.kind === 'dir' ? 'doc' : tab.kind === 'file' ? 'file' : tab.kind === 'app' ? 'app' : 'loading'

try {
  document.body.classList.remove('mode-dir', 'mode-file', 'mode-app')
  if (tab.kind === 'dir') document.body.classList.add('mode-dir')
  else if (tab.kind === 'file') document.body.classList.add('mode-file')
  else if (tab.kind === 'app') document.body.classList.add('mode-app')
} catch {}
```

**Lines 1439-1500**: Activation logic per kind
```javascript
if (tab.kind === 'dir') {
  resetDocMessagingState()
  const docMessage = buildContentMessageForDir(tab, cfg)
  // dir-specific logic
} else if (tab.kind === 'file') {
  // file-specific logic
  const mode = tab.mode || 'A'
  // ...
} else if (tab.kind === 'app') {
  // app-specific logic
}
```

**Lines 1650**: Mode assignment only for files
```javascript
if (entry.kind === 'file') tab.mode = await ensureModeForFile(entry.path)
```

**Discrimination Type**:
- COMPLETELY DIFFERENT rendering logic per kind
- DIFFERENT API calls per kind
- DIFFERENT CSS classes per kind
- DIFFERENT activation flows per kind
- DIFFERENT features available per kind (mode only for files)

---

## 5. DEFAULT/FALLBACK ENTRY CREATION

### 5.1 Automatic "docs" Entry Creation

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/lib/store.ts`

**Lines 163-186**: Already documented above

**Called from**: Line 192
```typescript
return await ensureDefaultLibraryEntry(validated)
```

**Discrimination Type**:
- ONLY "docs" path gets auto-created
- ONLY "docs" gets prepended to list
- ONLY "docs" gets hardcoded "Docs" label
- NO mechanism exists for other paths

---

### 5.2 First Entry Selection

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/main.js`

**Lines 696-710**: Auto-select first library entry
```javascript
if (!state.rootKey && !isEmbedMode) {
  try {
    const library = await fetchLibrary()
    if (library && library.entries && library.entries.length > 0) {
      const firstEntry = library.entries[0]
      state.rootKey = firstEntry.id
      state.contentContext = {
        rootKey: firstEntry.id,
        path: firstEntry.path,
        absolutePath: firstEntry.path,
        label: firstEntry.label || firstEntry.path.split('/').pop() || 'Content',
        focus: '',
      }
      state.contentRootAbsolute = firstEntry.path
      state.rootLabelOverride = firstEntry.label
    }
  }
}
```

**Discrimination Type**:
- Array position (index 0) receives privileged treatment
- Since "docs" is prepended, it becomes the default
- NO OTHER entry can be the automatic default

---

## 6. SPECIAL SERVING LOGIC

### 6.1 EntryId-Based Serving

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/serve/route.ts`

**Lines 23-27**: Serve only if entryId matches
```typescript
const entry = entries.find((e) => e.id === body.entryId)
if (!entry) return NextResponse.json({ error: 'entry not found' }, { status: 404 })
let inst = served.find((s) => s.entryId === entry.id)
if (inst && inst.status === 'running') return NextResponse.json({ ok: true, id: inst.id })
```

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Lines 1546-1550**: Serve requires entryId
```javascript
if (intent === 'start') {
  if (!tab.entryId) {
    showToast('Add to Library first to serve.', { tone: 'warning' })
    return false
  }
```

**Lines 1909-1916**: Serve status sync based on entryId
```javascript
for (const t of tabsState.tabs) {
  if (!t.entryId) continue
  const inst = list.find((i) => i.entryId === t.entryId)
  const runningId = inst && inst.status === 'running' ? inst.id : null
  if ((t.servedId || null) !== (runningId || null)) {
    t.servedId = runningId
    changed = true
  }
}
```

**Discrimination Type**:
- ONLY entries with entryId can be served
- Tabs without entryId cannot start serving
- Different refresh logic based on entryId presence

---

## 7. MESSAGE PASSING DISCRIMINATION

### 7.1 setContentRoot Message

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/main.js`

**Lines 899-920**: Message handling with rootKey
```javascript
if (msg.type === 'setContentRoot') {
  console.log('[main] Received setContentRoot:', JSON.stringify({ rootKey: msg.rootKey, path: msg.path, label: msg.label }))
  ack({ status: 'accepted' })

  const context = createContextFromMessage({
    rootKey: msg.rootKey,
    path: msg.path,
    label: msg.label,
    focus: msg.focus,
  })

  state.contentContext = context
  state.rootKey = context.rootKey
  state.contentRootAbsolute = context.absolutePath
  state.rootLabelOverride = context.label
  state.pendingFocus = context.focus

  await startCms(true)
  return
}
```

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Lines 1441-1444**: Build message with entryId
```javascript
if (tab.entryId) {
  context = {
    rootKey: tab.entryId,
    path: path,
    absolutePath: path,
    label: tab.label || path.split('/').filter(Boolean).pop() || 'Content',
    focus: '',
  }
}
```

**Discrimination Type**:
- Messages contain rootKey which drives ALL downstream logic
- Different message structure for entries with entryId vs. without
- Label propagation differs based on entry type

---

## 8. UI SORT ORDER DISCRIMINATION

### 8.1 Library Entry Sorting

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/modal.js`

**Lines 480-482**: Hardcoded sort priority
```javascript
sort((a, b) => {
  if (value.key === 'contentRoot') return 0
  if (value.key === 'uploads') return 1
  // ... other entries
})
```

**Discrimination Type**:
- HARDCODED sort order: contentRoot always first
- HARDCODED sort order: uploads always second
- Other entries have lower priority

---

## 9. CONDITIONAL FEATURE AVAILABILITY

### 9.1 Deletion Restrictions

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/library/[id]/delete/route.ts`

**Lines 21-24**: Already documented above

**Discrimination Type**:
- ONLY uploads entries can be deleted
- Other entries permanently retained

### 9.2 Upload Destination Restrictions

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/upload/route.ts`

**Lines 38-39**: Already documented above

**Discrimination Type**:
- ONLY uploads root accepts uploads
- Other roots rejected with error

### 9.3 Mode Feature (File Kind Only)

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/shell.js`

**Line 1650**: Already documented above

**Discrimination Type**:
- ONLY file kind entries get mode
- Dir and app kinds excluded from mode feature

---

## 10. CACHE DISCRIMINATION

### 10.1 Cache Key Generation

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/main.js`

**Lines 716-721**: Different cache keys
```javascript
const activeRootKey = state.rootKey || ''
const contextTag = activeRootKey === 'uploads' ? 'uploads' : state.contentRootAbsolute || ''
const combinedContext = `${activeRootKey}::${contextTag}`
if (state.cacheContext !== combinedContext) {
  state.cache.clear()
  state.cacheContext = combinedContext
}
```

**Discrimination Type**:
- DIFFERENT cache key format for uploads
- Cache cleared based on rootKey changes
- Uploads gets special cache context tag

---

## 11. TREE BUILDING DISCRIMINATION

### 11.1 Root Node Name

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/public/js/main.js`

**Lines 278, 794**: Already documented above

**Discrimination Type**:
- DIFFERENT default names: "Uploads" vs "Docs"
- Conditional based on rootKey

---

## 12. API RESPONSE DISCRIMINATION

### 12.1 Tree API Root Parameter

**Location**: `/home/ami/Projects/AMI-ORCHESTRATOR/ux/cms/app/api/tree/route.ts`

**Line 30**: Path validation
```typescript
if (!normalized || normalized === '.' || normalized.startsWith('..')) throw new Error('invalid path')
```

While not explicitly discriminatory by ID, the tree API treats different roots differently based on the root parameter passed in the query string.

---

## SUMMARY OF DISCRIMINATION PATTERNS

### By Entry Identifier:
1. **"docs" path** - Auto-created, prepended, hardcoded "Docs" label
2. **"/files/uploads" path** - Special rootKey, label, metadata handling
3. **"contentRoot" rootKey** - Priority sorting, special query params, special labels
4. **"uploads" rootKey** - Priority sorting, cache discrimination, special labels

### By Entry Property:
5. **entryId presence** - Required for serving, affects message structure
6. **label presence** - Affects display, fallback logic, message inclusion
7. **kind value** - Completely different rendering, features, activation logic
8. **path pattern** - Different rootKey assignment, deletion permissions

### By Entry Position:
9. **Array index 0** - Auto-selected as default root
10. **Sort order** - Hardcoded contentRoot first, uploads second

### By Feature:
11. **Deletion** - Only uploads allowed
12. **Upload destination** - Only uploads allowed
13. **Mode feature** - Only file kind
14. **Serving** - Only entries with entryId

### By Context:
15. **Cache keys** - Different format for uploads
16. **Message structure** - Different based on entryId
17. **UI classes** - Different per kind
18. **Status display** - Different per kind

---

## CONCLUSION

The UX CMS contains **PERVASIVE and SYSTEMATIC discrimination** across library entries. NO entry is truly treated uniformly. The discrimination is based on:

1. Hardcoded paths ("docs", "/files/uploads")
2. Hardcoded rootKeys ("contentRoot", "uploads")
3. Entry IDs (docs ID, entryId presence)
4. Entry properties (label, kind, path)
5. Entry position (array index)
6. Feature requirements (serving needs entryId)

**EVERY CODE PATH** examined contains some form of special-case logic that treats entries differently based on these criteria.

This violates the fundamental principle that library entries should be uniform, interchangeable data structures with consistent behavior regardless of their specific values.
