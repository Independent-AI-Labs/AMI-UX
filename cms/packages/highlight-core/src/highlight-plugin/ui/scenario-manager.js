import { ensureReact } from '../support/ensure-react.js'
import { createFileTreeToolkit } from '../../lib/file-tree.js'
import { dialogService } from '../../lib/dialog-service.js'
import { markPluginNode, withIgnoreProps } from '../core/dom-utils.js'
import { icon as iconMarkup } from '../../lib/icon-pack.js'
import { createTriggerComposerToolkit } from './trigger-composer.js'

const DIALOG_ID = 'highlightScenarioManager'
const ROOT_KEY = 'automation-scenarios'

function buildTreeFromScenarios(scenarios = []) {
  const children = scenarios.map((scenario) => {
    const slug = typeof scenario.slug === 'string' && scenario.slug.trim() ? scenario.slug.trim() : 'default'
    const triggers = Array.isArray(scenario.triggers) ? scenario.triggers : []
    const triggerNodes = triggers.map((trigger) => ({
      name: trigger.name || trigger.id,
      path: `${slug}/${trigger.id}`,
      type: 'file',
      trigger,
      scenarioSlug: slug,
    }))
    return {
      name: scenario.name || slug,
      path: slug,
      type: 'dir',
      scenarioSlug: slug,
      triggers: triggerNodes,
      children: triggerNodes,
    }
  })
  return [
    {
      key: ROOT_KEY,
      label: 'Automation Scenarios',
      node: {
        name: 'Scenarios',
        path: '',
        type: 'dir',
        children,
      },
    },
  ]
}

function cloneTriggerPayload(trigger) {
  if (!trigger || typeof trigger !== 'object') return null
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(trigger)
    } catch {}
  }
  try {
    return JSON.parse(JSON.stringify(trigger))
  } catch {}
  return { ...trigger }
}

function normalizeSlug(value, normalizePath) {
  const raw = typeof value === 'string' ? value : ''
  return normalizePath(raw) || raw
}

function findScenario(scenarios, slug, normalizePath) {
  if (!Array.isArray(scenarios)) return null
  const target = normalizeSlug(slug, normalizePath)
  return (
    scenarios.find((scenario) => normalizeSlug(scenario.slug, normalizePath) === target) || null
  )
}

function findTrigger(scenario, triggerId) {
  if (!scenario || !Array.isArray(scenario.triggers)) return null
  const id = typeof triggerId === 'string' ? triggerId : triggerId?.id
  return scenario.triggers.find((trigger) => trigger.id === id) || null
}

function reconcileExpansion(previous, scenarios, makeNodeKey, normalizePath) {
  const next = new Set(previous || [])
  const rootKey = makeNodeKey(ROOT_KEY, '')
  next.add(rootKey)

  const availableSlugs = new Set(
    Array.isArray(scenarios)
      ? scenarios.map((scenario) => normalizeSlug(scenario.slug, normalizePath)).filter(Boolean)
      : [],
  )

  if (availableSlugs.has('default')) {
    next.add(makeNodeKey(ROOT_KEY, 'default'))
  }

  const keysToRemove = []
  next.forEach((key) => {
    if (key === rootKey) return
    const [, path = ''] = key.split('::')
    if (!path) return
    const [scenarioPart] = path.split('/')
    if (!scenarioPart) return
    if (!availableSlugs.has(scenarioPart)) keysToRemove.push(key)
  })
  keysToRemove.forEach((key) => next.delete(key))
  return next
}

function reconcileSelection(previous, scenarios, requested, normalizePath) {
  const resolveScenario = (slug) => findScenario(scenarios, slug, normalizePath)

  const applyTarget = (target) => {
    if (!target) return null
    if (target.kind === 'trigger') {
      const scenario = resolveScenario(target.slug)
      if (scenario) {
        const trigger = findTrigger(scenario, target.trigger?.id || target.triggerId)
        if (trigger) {
          return { kind: 'trigger', slug: scenario.slug, trigger }
        }
        return { kind: 'scenario', slug: scenario.slug }
      }
      return null
    }
    if (target.kind === 'scenario') {
      const scenario = resolveScenario(target.slug)
      if (scenario) return { kind: 'scenario', slug: scenario.slug }
      return null
    }
    return null
  }

  const desired = applyTarget(requested)
  if (desired) return desired
  return applyTarget(previous)
}

function buildScenarioSignature(scenarios, normalizePath) {
  if (!Array.isArray(scenarios) || !scenarios.length) return ''
  const parts = []
  scenarios.forEach((scenario) => {
    if (!scenario) return
    const slug = normalizeSlug(scenario.slug, normalizePath)
    const triggers = Array.isArray(scenario.triggers) ? scenario.triggers : []
    const triggerParts = triggers.map((trigger) => {
      const id = typeof trigger?.id === 'string' ? trigger.id : ''
      const version = trigger?.updatedAt || trigger?.version || trigger?.name || ''
      return `${id}::${version}`
    })
    parts.push(
      [slug, scenario.name || '', triggers.length, triggerParts.join(',')]
        .map((value) => (value == null ? '' : String(value)))
        .join('|'),
    )
  })
  return parts.join('||')
}

function setsEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

function selectionsEqual(a, b) {
  if (a === b) return true
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  const slugA = typeof a.slug === 'string' ? a.slug : ''
  const slugB = typeof b.slug === 'string' ? b.slug : ''
  if (slugA !== slugB) return false
  if (a.kind === 'trigger') {
    const idA = a.trigger && typeof a.trigger.id === 'string' ? a.trigger.id : ''
    const idB = b.trigger && typeof b.trigger.id === 'string' ? b.trigger.id : ''
    return idA === idB
  }
  return true
}

export function createScenarioManager(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null)
  const manager = options.manager
  if (!doc) throw new Error('Scenario manager requires a document')
  if (!manager) throw new Error('Scenario manager requires a HighlightManager instance')

  let overlay = null
  let surface = null
  let handle = null
  let root = null
  let componentApi = null
  const apiWaiters = []

  const notifyComponentApi = (api) => {
    componentApi = api || null
    if (api) {
      while (apiWaiters.length) {
        const resolve = apiWaiters.shift()
        try {
          resolve(api)
        } catch {}
      }
    }
  }

  const waitForComponentApi = () =>
    componentApi
      ? Promise.resolve(componentApi)
      : new Promise((resolve) => {
          apiWaiters.push(resolve)
        })

  const registerComponentApi = (api) => {
    notifyComponentApi(api)
  }

  const ensureDialog = async () => {
    if (overlay && handle && root) return
    const { React, ReactDOM } = await ensureReact()
    const fileTreeToolkit = createFileTreeToolkit(React)
    const composerToolkit = createTriggerComposerToolkit(React)

    overlay = doc.createElement('div')
    overlay.className = 'dialog-backdrop scenario-manager-backdrop'
    overlay.hidden = true
    overlay.dataset.state = 'closed'
    overlay.id = `${DIALOG_ID}Overlay`
    markPluginNode(overlay)

    surface = doc.createElement('div')
    surface.className = 'dialog-surface scenario-manager-dialog'
    markPluginNode(surface)
    overlay.appendChild(surface)
    doc.body.appendChild(overlay)

    const ScenarioManagerComponent = createScenarioManagerComponent(
      React,
      fileTreeToolkit,
      composerToolkit,
      manager,
    )

    root = ReactDOM.createRoot(surface)
    const closeHandle = () => handle?.close()
    root.render(
      React.createElement(ScenarioManagerComponent, {
        onClose: closeHandle,
        surfaceElement: surface,
        overlayElement: overlay,
        registerApi: registerComponentApi,
      }),
    )

    handle = dialogService.register(DIALOG_ID, {
      overlay,
      surface,
      allowBackdropClose: true,
      onClose: () => {
        try {
          overlay.dataset.state = 'closed'
        } catch {}
        try {
          overlay.removeAttribute('data-fullscreen')
        } catch {}
        try {
          surface.removeAttribute('data-fullscreen')
        } catch {}
      },
      onOpen: () => {
        try {
          overlay.dataset.state = 'open'
        } catch {}
        try {
          overlay.removeAttribute('data-fullscreen')
        } catch {}
        try {
          surface.removeAttribute('data-fullscreen')
        } catch {}
        if (surface && typeof surface.focus === 'function') {
          setTimeout(() => {
            try {
              surface.focus({ preventScroll: true })
            } catch {}
          }, 0)
        }
      },
    })
  }

  const resetFullscreenFlags = () => {
    try {
      overlay?.removeAttribute?.('data-fullscreen')
    } catch {}
    try {
      surface?.removeAttribute?.('data-fullscreen')
    } catch {}
  }

  return {
    open: async () => {
      await ensureDialog()
      resetFullscreenFlags()
      handle?.open()
    },
    openAddTrigger: async (config = {}) => {
      await ensureDialog()
      resetFullscreenFlags()
      handle?.open()
      const api = await waitForComponentApi()
      if (!api?.openAddTrigger) return null
      return api.openAddTrigger(config)
    },
    openAddTriggerForElement: async (config = {}) => {
      await ensureDialog()
      resetFullscreenFlags()
      handle?.open()
      const api = await waitForComponentApi()
      if (api?.openAddTriggerForElement) return api.openAddTriggerForElement(config)
      if (api?.openAddTrigger) return api.openAddTrigger(config)
      return null
    },
    close: () => handle?.close(),
    destroy: () => {
      try {
        handle?.destroy()
      } catch {}
      handle = null
      notifyComponentApi(null)
      while (apiWaiters.length) {
        const resolve = apiWaiters.shift()
        try {
          resolve(null)
        } catch {}
      }
      if (root) {
        try {
          root.unmount()
        } catch {}
      }
      root = null
      if (overlay?.parentElement) overlay.parentElement.removeChild(overlay)
      overlay = null
      surface = null
    },
  }
}

function createScenarioManagerComponent(React, fileTreeToolkit, composerToolkit, manager) {
  const { FileTree, makeNodeKey, normalizePath } = fileTreeToolkit
  const { TriggerComposer } = composerToolkit
  const { useState, useEffect, useMemo, useRef, useCallback } = React
  const h = React.createElement

  const rootNodeKey = makeNodeKey(ROOT_KEY, '')
  const defaultNodeKey = makeNodeKey(ROOT_KEY, 'default')

  return function ScenarioManager({ onClose, surfaceElement, overlayElement, registerApi }) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [scenarioState, setScenarioState] = useState({ signature: '', list: [] })
    const scenarios = scenarioState.list
    const [selected, setSelected] = useState(null)
    const updateSelection = useCallback((valueOrUpdater) => {
      setSelected((prev) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater
        return selectionsEqual(prev, nextValue) ? prev : nextValue
      })
    }, [])
    const [expandedKeys, setExpandedKeys] = useState(() => new Set([rootNodeKey, defaultNodeKey]))
    const [view, setView] = useState('tree')
    const [composerConfig, setComposerConfig] = useState(null)
    const [composerBusy, setComposerBusy] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)

    const treeRef = useRef(null)
    const scrollPosRef = useRef(0)
    const selectedRef = useRef(null)
    const pendingSelectionRef = useRef(null)
    const composerPromiseRef = useRef(null)
    const pendingComposerRequestRef = useRef(null)

    useEffect(() => {
      selectedRef.current = selected
    }, [selected])

    useEffect(() => {
      if (!surfaceElement) return
      if (isFullscreen) surfaceElement.setAttribute('data-fullscreen', 'true')
      else surfaceElement.removeAttribute('data-fullscreen')
    }, [surfaceElement, isFullscreen])

    useEffect(() => {
      if (!overlayElement) return
      if (isFullscreen) overlayElement.setAttribute('data-fullscreen', 'true')
      else overlayElement.removeAttribute('data-fullscreen')
    }, [overlayElement, isFullscreen])

    useEffect(() => {
      if (!surfaceElement || typeof MutationObserver === 'undefined') return undefined
      const observer = new MutationObserver(() => {
        const state = surfaceElement.getAttribute('data-state')
        if (state === 'closed') setIsFullscreen(false)
      })
      observer.observe(surfaceElement, { attributes: true, attributeFilter: ['data-state'] })
      return () => observer.disconnect()
    }, [surfaceElement])

    useEffect(() => {
      return () => {
        try {
          surfaceElement?.removeAttribute?.('data-fullscreen')
        } catch {}
        try {
          overlayElement?.removeAttribute?.('data-fullscreen')
        } catch {}
      }
    }, [surfaceElement, overlayElement])

    // manager reference is stable for the lifetime of the component
    const ensureAutomationContext = useCallback(async () => {
      if (!manager) return false
      try {
        const storeContext =
          typeof manager.automationStore?.getContext === 'function'
            ? manager.automationStore.getContext()
            : null
        if (storeContext?.path) return true
        if (manager.documentContext?.path) return true
        const docEl = (manager?.document || (typeof document !== 'undefined' ? document : null))?.documentElement || null
        const pathAttr = docEl?.getAttribute('data-ami-doc-path') || ''
        if (!pathAttr) return false
        const rootAttr = docEl?.getAttribute('data-ami-doc-root') || 'docRoot'
        if (typeof manager.setDocumentContext === 'function') {
          await manager.setDocumentContext({ path: pathAttr, root: rootAttr })
          return true
        }
        if (manager.automationStore && typeof manager.automationStore.setContext === 'function') {
          manager.automationStore.setContext({ path: pathAttr, root: rootAttr })
          return true
        }
      } catch (err) {
        console.warn('Failed to establish automation context', err)
      }
      return false
    }, [manager])

    const refresh = useCallback(
      async (force = false, options = {}) => {
        if (!manager?.automationStore) return
        pendingSelectionRef.current = options.selection || null
        if (treeRef.current) scrollPosRef.current = treeRef.current.scrollTop
        setLoading(true)
        setError('')
        try {
          const hasContext = await ensureAutomationContext()
          if (!hasContext) throw new Error('Automation context unavailable')
          await manager.reloadAutomation(force)
          const meta = manager.automationMeta || { scenarios: [] }
          const list = Array.isArray(meta.scenarios) ? meta.scenarios : []
          const signature = buildScenarioSignature(list, normalizePath)
          setScenarioState((prev) => (prev.signature === signature ? prev : { signature, list }))
          setExpandedKeys((prev) => {
            const next = reconcileExpansion(prev, list, makeNodeKey, normalizePath)
            return setsEqual(prev, next) ? prev : next
          })
          updateSelection((prev) =>
            reconcileSelection(prev, list, pendingSelectionRef.current, normalizePath),
          )
          setTimeout(() => {
            if (treeRef.current) treeRef.current.scrollTop = scrollPosRef.current
          }, 0)
        } catch (err) {
          setError(err?.message || 'Failed to load scenarios')
        } finally {
          setLoading(false)
          pendingSelectionRef.current = null
        }
      },
      [normalizePath, ensureAutomationContext],
    )

    useEffect(() => {
      refresh(true)
    }, [refresh])

    const treeRoots = useMemo(
      () => buildTreeFromScenarios(scenarios),
      [scenarioState.signature],
    )

    const selectionDescriptor = useMemo(() => {
      if (!selected) return null
      if (selected.kind === 'scenario') {
        return { rootKey: ROOT_KEY, path: normalizePath(selected.slug || '') }
      }
      if (selected.kind === 'trigger') {
        return {
          rootKey: ROOT_KEY,
          path: `${normalizePath(selected.slug || '')}/${selected.trigger?.id}`,
        }
      }
      return null
    }, [selected])

    const handleSelect = useCallback(
      (payload) => {
        if (!payload || !payload.node) {
          updateSelection(null)
          return
        }
        const node = payload.node
        if (node.type === 'dir' && node.path === '') {
          updateSelection(null)
          return
        }
        if (node.type === 'dir') {
          updateSelection({ kind: 'scenario', slug: node.path })
          return
        }
        if (node.type === 'file' && node.trigger) {
          updateSelection({ kind: 'trigger', slug: node.scenarioSlug, trigger: node.trigger })
        }
      },
      [updateSelection],
    )

    const handleExpandedChange = useCallback((next) => {
      setExpandedKeys((prev) => {
        const nextSet = next instanceof Set ? new Set(next) : new Set(next || [])
        return setsEqual(prev, nextSet) ? prev : nextSet
      })
    }, [])

    const requireScenarioSelection = useCallback(() => {
      if (selected?.kind === 'scenario') return selected.slug
      if (selected?.kind === 'trigger') return selected.slug
      const active = manager?.automation?.activeScenario
      if (active) return active
      if (scenarios.length) return scenarios[0].slug
      return null
    }, [selected, scenarios])

    const stageComposer = useCallback(
      (config = {}, promiseHandlers = null) => {
        const rawScenario =
          typeof config.scenarioSlug === 'string' && config.scenarioSlug.trim()
            ? config.scenarioSlug.trim()
            : requireScenarioSelection()

        if (!rawScenario) {
          if (promiseHandlers?.reject) {
            promiseHandlers.reject(new Error('Select a scenario first'))
          } else if (promiseHandlers?.resolve) {
            promiseHandlers.resolve(null)
          }
          composerPromiseRef.current = null
          setError('Select a scenario first')
          setView('tree')
          return false
        }

        const scenarioRecord = findScenario(scenarios, rawScenario, normalizePath)
        const scenarioSlug = scenarioRecord?.slug || rawScenario
        const normalizedSlug = normalizeSlug(scenarioSlug, normalizePath) || scenarioSlug

        if (promiseHandlers) composerPromiseRef.current = promiseHandlers
        else composerPromiseRef.current = null

        pendingSelectionRef.current = { kind: 'scenario', slug: normalizedSlug }
        setExpandedKeys((prev) => {
          const next = new Set(prev)
          const keyToAdd = makeNodeKey(ROOT_KEY, normalizedSlug)
          if (next.has(keyToAdd)) return prev
          next.add(keyToAdd)
          return next
        })
        updateSelection({ kind: 'scenario', slug: normalizedSlug })
        setError('')
        setComposerBusy(false)
        setComposerConfig({
          scenarioSlug,
          initialType: config.initialType || 'dom',
          mode: config.mode === 'edit' ? 'edit' : 'create',
          initialDraft: config.initialDraft || null,
          seed: config.seed || null,
          submitLabel: config.submitLabel,
          triggerId: config.triggerId,
          triggerName: config.triggerName,
        })
        setView('composer')
        pendingComposerRequestRef.current = null
        return true
      },
      [requireScenarioSelection, scenarios, normalizePath, setExpandedKeys, makeNodeKey],
    )

    const launchComposer = useCallback(
      (config = {}, promiseHandlers = null) => {
        const preparedConfig = { ...config }
        if (loading) {
          pendingComposerRequestRef.current = { config: preparedConfig, handlers: promiseHandlers }
          return
        }
        stageComposer(preparedConfig, promiseHandlers)
      },
      [loading, stageComposer],
    )

    useEffect(() => {
      if (!loading && pendingComposerRequestRef.current) {
        const { config, handlers } = pendingComposerRequestRef.current
        pendingComposerRequestRef.current = null
        stageComposer(config, handlers)
      }
    }, [loading, stageComposer])

    useEffect(() => {
      if (!loading && pendingComposerRequestRef.current) {
        const { config, handlers } = pendingComposerRequestRef.current
        pendingComposerRequestRef.current = null
        stageComposer(config, handlers)
      }
    }, [loading, stageComposer])

    const handleCreateScenario = useCallback(async () => {
      const name = prompt('Scenario name')
      if (!name || !name.trim()) return
      setLoading(true)
      setError('')
      try {
        const hasContext = await ensureAutomationContext()
        if (!hasContext) throw new Error('Automation context unavailable')
        await manager.automationStore.createScenario(name.trim())
        await refresh(true)
      } catch (err) {
        setError(err?.message || 'Failed to create scenario')
      } finally {
        setLoading(false)
      }
    }, [refresh, ensureAutomationContext])

    const handleDeleteSelection = useCallback(async () => {
      if (!selected) return
      if (selected.kind === 'scenario') {
        if (!confirm(`Delete scenario "${selected.slug}" and all triggers?`)) return
      } else if (selected.kind === 'trigger') {
        if (!confirm(`Delete trigger "${selected.trigger?.name || selected.trigger?.id}"?`)) return
      }
      setLoading(true)
      setError('')
      try {
        const hasContext = await ensureAutomationContext()
        if (!hasContext) throw new Error('Automation context unavailable')
        if (selected.kind === 'scenario') {
          await manager.automationStore.deleteScenario(selected.slug)
          await refresh(true, { selection: { kind: 'scenario', slug: 'default' } })
        } else if (selected.kind === 'trigger') {
          await manager.automationStore.deleteTrigger(selected.trigger.id, selected.slug)
          await refresh(true, { selection: { kind: 'scenario', slug: selected.slug } })
        }
      } catch (err) {
        setError(err?.message || 'Failed to delete selection')
      } finally {
        setLoading(false)
      }
    }, [refresh, selected, ensureAutomationContext])

    const openComposer = useCallback(() => {
      stageComposer({}, null)
    }, [stageComposer])

    const openComposerForTrigger = useCallback(
      (scenarioSlug, triggerId) => {
        if (!scenarioSlug || !triggerId) return
        const scenario = findScenario(scenarios, scenarioSlug, normalizePath)
        if (!scenario) return
        const trigger = findTrigger(scenario, triggerId)
        if (!trigger) return
        const draft = cloneTriggerPayload(trigger)
        if (!draft) return
        stageComposer(
          {
            scenarioSlug: scenario.slug || scenarioSlug,
            initialType: draft.type || 'dom',
            mode: 'edit',
            initialDraft: draft,
            triggerId,
            triggerName: draft.name || draft.id || 'Trigger',
          },
          null,
        )
      },
      [scenarios, normalizePath, stageComposer],
    )

    const handleComposerCancel = useCallback(() => {
      if (composerBusy) return
      const handlers = composerPromiseRef.current
      composerPromiseRef.current = null
      pendingComposerRequestRef.current = null
      setComposerConfig(null)
      setView('tree')
      if (handlers?.resolve) handlers.resolve(null)
    }, [composerBusy])

    const handleComposerSubmit = useCallback(
      async (draft) => {
        if (!composerConfig?.scenarioSlug) throw new Error('Scenario required')
        setComposerBusy(true)
        const handlers = composerPromiseRef.current
        try {
          const payload = {
            ...draft,
            scenario: composerConfig.scenarioSlug,
          }
          const hasContext = await ensureAutomationContext()
          if (!hasContext) throw new Error('Automation context unavailable')
          const saved = await manager.automationStore.saveTrigger(payload, composerConfig.scenarioSlug)
          const result = saved || payload
          await refresh(true, {
            selection: {
              kind: 'trigger',
              slug: composerConfig.scenarioSlug,
              triggerId: result.id || payload.id,
            },
          })
          setComposerConfig(null)
          setView('tree')
          if (handlers?.resolve) handlers.resolve(result)
          composerPromiseRef.current = null
          pendingComposerRequestRef.current = null
          return result
        } finally {
          setComposerBusy(false)
        }
      },
      [composerConfig, refresh, ensureAutomationContext],
    )

    const activeScenarioLabel = useMemo(() => {
      if (!composerConfig?.scenarioSlug) return ''
      const scenario = findScenario(scenarios, composerConfig.scenarioSlug, normalizePath)
      return scenario?.name || composerConfig.scenarioSlug
    }, [composerConfig, scenarios])

    const normalizedComposerSlug = composerConfig?.scenarioSlug
      ? normalizePath(composerConfig.scenarioSlug) || composerConfig.scenarioSlug
      : ''
    const composerScenarioName = activeScenarioLabel || normalizedComposerSlug || 'Scenario'
    const composerTriggerName = composerConfig?.triggerName || composerConfig?.initialDraft?.name
    const composerMode = composerConfig?.mode === 'edit' ? 'edit' : 'create'
    const composerTitle =
      composerMode === 'edit'
        ? `${composerScenarioName} -> Modify Trigger`
        : `${composerScenarioName} -> Add Trigger`
    const composerSubtitle =
      composerMode === 'edit'
        ? `Modify automation trigger${
            composerTriggerName ? ` "${composerTriggerName}"` : ''
          } in ${composerScenarioName}.`
        : `Create automation triggers for ${composerScenarioName}`
    const composerSubmitLabel =
      composerConfig?.submitLabel || (composerMode === 'edit' ? 'Save Trigger' : 'Create Trigger')

    const toggleFullscreen = useCallback(() => {
      setIsFullscreen((prev) => !prev)
    }, [])

    const handleClose = useCallback(() => {
      setIsFullscreen(false)
      if (typeof onClose === 'function') onClose()
    }, [onClose])

    const handleActivate = useCallback(
      (payload) => {
        if (!payload?.node) return
        if (payload.node.type !== 'file') return
        const slug = payload.node.scenarioSlug || payload.node.path?.split('/')?.[0] || ''
        const triggerId = payload.node.trigger?.id || payload.node.path?.split('/')?.pop()
        const normalisedSlug = normalizeSlug(slug, normalizePath)
        if (normalisedSlug && triggerId) openComposerForTrigger(normalisedSlug, triggerId)
      },
      [openComposerForTrigger, normalizePath],
    )

    const treePanel = h(
      'section',
      {
        className: 'scenario-manager__panel scenario-manager__panel--tree',
        'data-active': view === 'tree' ? 'true' : 'false',
        'aria-hidden': view === 'tree' ? 'false' : 'true',
      },
      h(
        'div',
        { className: 'scenario-manager__body' },
        loading
          ? h('div', { className: 'scenario-manager__loading' }, 'Loading…')
          : h(
              'div',
              { className: 'scenario-manager__tree' },
              h(FileTree, {
                roots: treeRoots,
                selectionMode: 'any',
                selected: selectionDescriptor,
                onSelect: handleSelect,
                onActivate: handleActivate,
                expandedKeys: Array.from(expandedKeys),
                onExpandedChange: handleExpandedChange,
                defaultExpandedKeys: [
                  { rootKey: ROOT_KEY, path: '' },
                  { rootKey: ROOT_KEY, path: 'default' },
                ],
                containerRef: treeRef,
                style: { flex: '1 1 auto', minHeight: 0, height: '100%', maxHeight: '100%' },
                emptyLabel: 'No scenarios yet. Create one to get started.',
              }),
            ),
      ),
      error ? h('div', { className: 'scenario-manager__error' }, error) : null,
      h(
        'div',
        { className: 'scenario-manager__footer' },
        h(
          'div',
          { className: 'scenario-manager__actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'btn',
              onClick: handleCreateScenario,
              disabled: loading,
            },
            'Add Scenario Dir',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'btn',
              onClick: openComposer,
              disabled: loading,
            },
            'Add Trigger',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn--danger',
              onClick: handleDeleteSelection,
              disabled: loading || !selected,
            },
            'Delete Selected',
          ),
        ),
      ),
    )

    const composerActive = view === 'composer'
    const composerPanel = composerConfig
      ? h(TriggerComposer, {
          mode: 'embedded',
          wrap: false,
          manager,
          ownerId: manager?.ownerId || '',
          scenarioSlug: composerConfig.scenarioSlug,
          initialType: composerConfig.initialType,
          initialDraft: composerConfig.initialDraft,
          seed: composerConfig.seed,
          onCancel: handleComposerCancel,
          onSubmit: handleComposerSubmit,
          submitLabel: composerSubmitLabel,
          busy: composerBusy,
        })
      : h(
          'section',
          { className: 'scenario-manager__placeholder' },
          'Select "Add Trigger" to create a scenario action.',
        )

    const renderFullscreenButton = () =>
      h(
        'button',
        withIgnoreProps({
          type: 'button',
          className:
            'icon-button scenario-manager__control-button scenario-manager__control-button--fullscreen',
          onClick: toggleFullscreen,
          'aria-label': isFullscreen ? 'Exit full-screen' : 'Enter full-screen',
          'aria-pressed': isFullscreen ? 'true' : 'false',
          dangerouslySetInnerHTML: {
            __html: iconMarkup(isFullscreen ? 'fullscreen-exit-line' : 'fullscreen-line', {
              size: 18,
            }),
          },
        }),
      )

    const renderCloseButton = () =>
      h(
        'button',
        withIgnoreProps({
          type: 'button',
          className: 'icon-button scenario-manager__control-button scenario-manager__control-button--close',
          onClick: handleClose,
          'aria-label': 'Close scenario manager',
          dangerouslySetInnerHTML: { __html: iconMarkup('close-line', { size: 18 }) },
        }),
      )

    const renderHeaderControls = () =>
      h(
        'div',
        withIgnoreProps({ className: 'scenario-manager__header-controls' }),
        renderFullscreenButton(),
        renderCloseButton(),
      )

    useEffect(() => {
      if (typeof registerApi !== 'function') return undefined
      const api = {
        openAddTrigger: (config = {}) =>
          new Promise((resolve, reject) => {
            launchComposer(config, { resolve, reject })
          }),
        openAddTriggerForElement: (config = {}) =>
          new Promise((resolve, reject) => {
            launchComposer(config, { resolve, reject })
          }),
        openComposerForTrigger: (slug, triggerId) => {
          openComposerForTrigger(slug, triggerId)
        },
        refresh: (force = false) => refresh(!!force),
      }
      registerApi(api)
      return () => registerApi(null)
    }, [registerApi, launchComposer, openComposerForTrigger, refresh])

    const headerNode =
      view === 'composer'
        ? h(
            'div',
            { className: 'dialog-header scenario-manager__composer-header' },
            h(
              'div',
              { className: 'scenario-manager__composer-heading' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'scenario-manager__back',
                  onClick: handleComposerCancel,
                  disabled: composerBusy,
                  'aria-label': 'Back to scenarios',
                },
                '<',
              ),
              h(
                'div',
                { className: 'dialog-header__titles' },
                h('h2', { className: 'dialog-title' }, composerTitle),
                h('p', { className: 'dialog-subtitle' }, composerSubtitle),
              ),
            ),
            renderHeaderControls(),
          )
        : h(
            'div',
            { className: 'dialog-header' },
            h(
              'div',
              { className: 'dialog-header__titles' },
              h('h2', { className: 'dialog-title' }, 'Manage Scenarios'),
              h(
                'p',
                { className: 'dialog-subtitle' },
                'Group automation triggers into reusable scenarios and workflows.',
              ),
            ),
            renderHeaderControls(),
          )

    return h(
      'div',
      { className: 'scenario-manager', 'data-fullscreen': isFullscreen ? 'true' : 'false' },
      headerNode,
      h(
        'div',
        { className: 'scenario-manager__content', 'data-view': view },
        treePanel,
        h(
          'div',
          {
            className: 'scenario-manager__panel scenario-manager__panel--composer',
            'data-active': composerActive ? 'true' : 'false',
            'aria-hidden': composerActive ? 'false' : 'true',
          },
          composerPanel,
        ),
      ),
    )
  }
}
