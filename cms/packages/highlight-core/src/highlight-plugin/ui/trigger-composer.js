import { ensureReact } from '../support/ensure-react.js'
import { dialogService } from '../../lib/dialog-service.js'
import { markPluginNode, withExcludeProps } from '../core/dom-utils.js'
import { TRIGGER_TYPES, TRIGGER_TYPE_META, createTriggerTemplate } from './trigger-presets.js'
import { createSyntaxEditorToolkit } from './syntax-editor.js'

const TAB_TARGET = 'target'
const TAB_CONDITION = 'condition'
const TAB_ACTION = 'action'
const EDITOR_LINES = 12

function normaliseType(value) {
  if (TRIGGER_TYPES.includes(value)) return value
  return 'dom'
}

function serialiseSeed(seed) {
  try {
    return JSON.stringify(seed || null)
  } catch {
    return ''
  }
}

export function createTriggerComposerToolkit(React) {
  const { useState, useMemo, useEffect, useCallback, Fragment } = React
  const h = React.createElement
  const { SyntaxEditor } = createSyntaxEditorToolkit(React)

  function TriggerComposer(rawProps) {
    const {
      mode: rawMode = 'embedded',
      manager = null,
      ownerId: ownerIdProp = '',
      scenarioSlug: scenarioSlugProp = '',
      initialType: initialTypeProp = 'dom',
      submitLabel: submitLabelProp,
      cancelLabel: cancelLabelProp,
      showActions: showActionsProp = true,
      seed,
      initialDraft,
      busy: externalBusy = false,
      onCancel,
      onSubmit,
      wrap: wrapProp,
    } = rawProps

    const mode = rawMode === 'dialog' ? 'dialog' : 'embedded'
    const ownerId = typeof ownerIdProp === 'string' ? ownerIdProp : ''
    const scenarioSlug = typeof scenarioSlugProp === 'string' ? scenarioSlugProp : ''
    const initialType = normaliseType(initialTypeProp)
    const submitLabel = submitLabelProp || (mode === 'dialog' ? 'Create Trigger' : 'Save Trigger')
    const cancelLabel = cancelLabelProp || 'Cancel'
    const showActions = showActionsProp !== false
    const seedKey = serialiseSeed(seed)
    const initialDraftKey = serialiseSeed(initialDraft)
    const wrap = wrapProp !== false

    const [activeType, setActiveType] = useState(initialType)
    const [activeTab, setActiveTab] = useState(TAB_TARGET)
    const [drafts, setDrafts] = useState(() => {
      const base = {}
      TRIGGER_TYPES.forEach((type) => {
        base[type] = createTriggerTemplate(type, {
          manager,
          owner: ownerId,
          scenario: scenarioSlug,
        })
      })
      return base
    })
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
      const nextType = normaliseType(initialType)
      const base = {}
      TRIGGER_TYPES.forEach((type) => {
        base[type] = createTriggerTemplate(type, {
          manager,
          owner: ownerId,
          scenario: scenarioSlug,
        })
      })
      if (seed && base[nextType]) {
        base[nextType] = { ...base[nextType], ...seed }
      }
      if (initialDraft && base[nextType]) {
        base[nextType] = { ...base[nextType], ...initialDraft }
      }
      setDrafts(base)
      setActiveType(nextType)
      setActiveTab(TAB_TARGET)
      setError('')
      setSubmitting(false)
    }, [initialType, manager, ownerId, scenarioSlug, seed, initialDraft, seedKey, initialDraftKey])

    const currentDraft = useMemo(() => {
      return drafts[activeType] ||
        createTriggerTemplate(activeType, { manager, owner: ownerId, scenario: scenarioSlug })
    }, [drafts, activeType, manager, ownerId, scenarioSlug])

    const updateDraft = useCallback(
      (type, updates) => {
        setDrafts((prev) => {
          const next = { ...prev }
          const base = prev[type] ||
            createTriggerTemplate(type, { manager, owner: ownerId, scenario: scenarioSlug })
          next[type] = { ...base, ...updates }
          return next
        })
      },
      [manager, ownerId, scenarioSlug],
    )

    const handleFieldChange = useCallback(
      (field, value) => {
        updateDraft(activeType, { [field]: value })
      },
      [activeType, updateDraft],
    )

    const handleTypeSwitch = useCallback((nextType) => {
      const normalised = normaliseType(nextType)
      setActiveType(normalised)
      setActiveTab(TAB_TARGET)
    }, [])

    const handleTabSwitch = useCallback((tabName) => {
      if ([TAB_TARGET, TAB_CONDITION, TAB_ACTION].includes(tabName)) {
        setActiveTab(tabName)
      }
    }, [])

    const isBusy = submitting || externalBusy

    const handleCancel = useCallback(() => {
      if (isBusy) return
      if (typeof onCancel === 'function') onCancel()
    }, [isBusy, onCancel])

    const handleSubmit = useCallback(
      async (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault()
        if (isBusy) return
        if (!scenarioSlug) {
          setError('Select a scenario first')
          return
        }
        const draft = {
          ...currentDraft,
          type: activeType,
          scenario: scenarioSlug,
          owner: ownerId,
          name:
            typeof currentDraft.name === 'string' && currentDraft.name.trim()
              ? currentDraft.name.trim()
              : currentDraft.id,
        }
        setSubmitting(true)
        setError('')
        try {
          const result = await (typeof onSubmit === 'function' ? onSubmit(draft) : null)
          return result
        } catch (err) {
          setError(err?.message || 'Failed to save trigger')
          throw err
        } finally {
          setSubmitting(false)
        }
      },
      [isBusy, scenarioSlug, currentDraft, activeType, ownerId, onSubmit],
    )

    const typeMeta = TRIGGER_TYPE_META[activeType] || TRIGGER_TYPE_META.dom

    const typeTabs = TRIGGER_TYPES.map((type) =>
      h(
        'button',
        {
          key: type,
          type: 'button',
          className: type === activeType ? 'is-active' : '',
          onClick: () => handleTypeSwitch(type),
          disabled: isBusy,
        },
        TRIGGER_TYPE_META[type]?.name || type,
      ),
    )

    const header =
      mode === 'dialog'
        ? h(
            'header',
            { className: 'trigger-composer__header' },
            h(
              'div',
              null,
              h('h2', null, 'Automation Trigger'),
              h('p', null, 'Configure trigger targets and action handlers.'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'icon-button',
                onClick: handleCancel,
                'aria-label': 'Close',
              },
              '×',
            ),
          )
        : null

    const introNotice = !scenarioSlug
      ? h(
          'p',
          { className: 'trigger-composer__notice' },
          'Select a scenario to enable trigger creation.',
        )
      : null

    const eventField =
      activeType === 'dom'
        ? h(
            'label',
            null,
            h('span', null, 'Event type'),
            h('input', {
              type: 'text',
              value: currentDraft.eventType || 'click',
              onChange: (e) => handleFieldChange('eventType', e.target.value),
              disabled: isBusy,
              list: 'triggerComposerEvents',
            }),
            h(
              'datalist',
              { id: 'triggerComposerEvents' },
              h('option', { value: 'click' }),
              h('option', { value: 'input' }),
              h('option', { value: 'change' }),
              h('option', { value: 'submit' }),
              h('option', { value: 'mouseenter' }),
              h('option', { value: 'focus' }),
            ),
          )
        : null

    const tabButtons = [
      h(
        'button',
        {
          key: 'target',
          type: 'button',
          className: activeTab === TAB_TARGET ? 'is-active' : '',
          onClick: () => handleTabSwitch(TAB_TARGET),
        },
        'Target',
      ),
      h(
        'button',
        {
          key: 'condition',
          type: 'button',
          className: activeTab === TAB_CONDITION ? 'is-active' : '',
          onClick: () => handleTabSwitch(TAB_CONDITION),
        },
        'Condition',
      ),
      h(
        'button',
        {
          key: 'action',
          type: 'button',
          className: activeTab === TAB_ACTION ? 'is-active' : '',
          onClick: () => handleTabSwitch(TAB_ACTION),
        },
        'Action',
      ),
    ]

    const targetPanel =
      activeTab === TAB_TARGET
        ? h(
            'section',
            { className: 'trigger-composer__panel' },
            h(SyntaxEditor, {
              value: currentDraft.targetCode || '',
              onChange: (code) => handleFieldChange('targetCode', code),
              language: 'javascript',
              disabled: isBusy,
              hint: typeMeta?.eventHint || '',
              minLines: EDITOR_LINES,
            }),
          )
        : null

    const conditionPanel =
      activeTab === TAB_CONDITION
        ? h(
            'section',
            { className: 'trigger-composer__panel' },
            h(SyntaxEditor, {
              value: currentDraft.conditionCode || '',
              onChange: (code) => handleFieldChange('conditionCode', code),
              language: 'javascript',
              disabled: isBusy,
              minLines: EDITOR_LINES,
            }),
          )
        : null

    const actionPanel =
      activeTab === TAB_ACTION
        ? h(
            'section',
            { className: 'trigger-composer__panel' },
            h(SyntaxEditor, {
              value: currentDraft.actionCode || '',
              onChange: (code) => handleFieldChange('actionCode', code),
              language: 'javascript',
              disabled: isBusy,
              minLines: EDITOR_LINES,
            }),
          )
        : null

    const errorNode = error ? h('div', { className: 'trigger-composer__error' }, error) : null

    const footer =
      showActions
        ? h(
            'footer',
            { className: 'trigger-composer__footer' },
            h(
              'button',
              {
                type: 'button',
                onClick: handleCancel,
                disabled: isBusy,
              },
              cancelLabel,
            ),
            h('span', { className: 'trigger-composer__spacer' }),
            h(
              'button',
              {
                type: 'submit',
                disabled: isBusy || !scenarioSlug,
              },
              isBusy ? 'Saving…' : submitLabel,
            ),
          )
        : null

    const nameRowChildren = [
      h(
        'label',
        null,
        h('span', null, 'Name'),
        h('input', {
          type: 'text',
          value: currentDraft.name || '',
          onChange: (e) => handleFieldChange('name', e.target.value),
          disabled: isBusy,
        }),
      ),
    ]
    if (eventField) nameRowChildren.push(eventField)

    const formChildren = [
      h('div', { className: 'trigger-composer__type-tabs', role: 'tablist' }, ...typeTabs),
      h(
        'div',
        { className: 'trigger-composer__intro' },
        h('p', null, typeMeta?.description || ''),
        introNotice,
      ),
      h('div', { className: 'trigger-composer__name-row' }, ...nameRowChildren),
      h('div', { className: 'trigger-composer__tabs', role: 'tablist' }, ...tabButtons),
      targetPanel,
      conditionPanel,
      actionPanel,
      errorNode,
      footer,
    ].filter(Boolean)

    const contentNodes = [
      header,
      h('form', { className: 'trigger-composer__form', onSubmit: handleSubmit }, ...formChildren),
    ]

    if (mode === 'dialog' || wrap) {
      return h(
        'div',
        withExcludeProps({ className: `trigger-composer trigger-composer--${mode}` }),
        ...contentNodes,
      )
    }

    return h(Fragment, null, ...contentNodes)
  }

  return { TriggerComposer }
}

export function createTriggerComposer(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null)
  const manager = options.manager || null
  if (!doc) throw new Error('Trigger composer requires a document')

  let overlay = null
  let surface = null
  let handle = null
  let root = null
  let updateConfig = null
  let pendingResolve = null
  let queuedConfig = null

  const ensureDialog = async () => {
    if (overlay && handle && root) return
    const { React, ReactDOM } = await ensureReact()
    const { TriggerComposer } = createTriggerComposerToolkit(React)

    overlay = doc.createElement('div')
    overlay.className = 'dialog-backdrop trigger-composer-backdrop'
    overlay.hidden = true
    overlay.dataset.state = 'closed'
    markPluginNode(overlay)

    surface = doc.createElement('div')
    surface.className = 'dialog-surface trigger-composer-dialog'
    markPluginNode(surface)
    overlay.appendChild(surface)
    doc.body.appendChild(overlay)

    const ComposerHost = () => {
      const [config, setConfig] = React.useState(() => queuedConfig)

      React.useEffect(() => {
        updateConfig = (next) => {
          queuedConfig = null
          setConfig(next)
        }
        if (queuedConfig) {
          setConfig(queuedConfig)
          queuedConfig = null
        }
        return () => {
          updateConfig = null
        }
      }, [])

      if (!config) return null

      const handleCancel = () => {
        if (typeof config.onCancel === 'function') config.onCancel()
        if (pendingResolve) pendingResolve(null)
        pendingResolve = null
        handle?.close()
      }

      const handleSubmit = async (draft) => {
        try {
          const result = await (typeof config.onSubmit === 'function' ? config.onSubmit(draft) : draft)
          if (pendingResolve) pendingResolve(result)
          pendingResolve = null
          handle?.close()
          return result
        } catch (err) {
          throw err
        }
      }

      return React.createElement(TriggerComposer, {
        mode: 'dialog',
        manager,
        ownerId: options.ownerId || '',
        scenarioSlug: config.scenarioSlug,
        initialType: config.initialType,
        seed: config.seed,
        initialDraft: config.initialDraft,
        submitLabel: config.submitLabel,
        onCancel: handleCancel,
        onSubmit: handleSubmit,
      })
    }

    root = ReactDOM.createRoot(surface)
    root.render(React.createElement(ComposerHost))

    handle = dialogService.register('highlightTriggerComposer', {
      overlay,
      surface,
      allowBackdropClose: true,
      onClose: () => {
        try {
          overlay.dataset.state = 'closed'
        } catch {}
      },
      onOpen: () => {
        try {
          overlay.dataset.state = 'open'
        } catch {}
      },
    })
  }

  return {
    open: async (config = {}) => {
      await ensureDialog()
      return new Promise((resolve) => {
        pendingResolve = resolve
        queuedConfig = { ...config }
        if (updateConfig) {
          updateConfig(queuedConfig)
        }
        handle?.open()
      })
    },
    close: () => handle?.close(),
    destroy: () => {
      pendingResolve = null
      queuedConfig = null
      if (handle) {
        try {
          handle.destroy()
        } catch {}
      }
      handle = null
      if (root) {
        try {
          root.unmount()
        } catch {}
      }
      root = null
      if (overlay?.parentElement) overlay.parentElement.removeChild(overlay)
      overlay = null
      surface = null
      updateConfig = null
    },
  }
}
