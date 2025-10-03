import { debugLog } from './debug.js'

function buildQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.path) search.set('path', params.path)
  if (params.root && params.root !== 'contentRoot') search.set('root', params.root)
  return search.toString()
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data && typeof data.error === 'string') message = data.error
    } catch {}
    throw new Error(message)
  }
  return res.json()
}

export function createAutomationStore() {
  let context = null
  let lastPayload = null
  let inflight = null

  function setContext(next) {
    const nextContext = next && typeof next === 'object' ? { ...next } : null
    context = nextContext && nextContext.path ? nextContext : null
    if (!context) {
      lastPayload = null
      inflight = null
    }
  }

  function getContext() {
    return context
  }

  async function loadAutomation(force = false) {
    if (!context || !context.path) {
      lastPayload = null
      return null
    }
    if (!force && lastPayload) return lastPayload
    if (inflight) return inflight
    const query = buildQuery(context)
    const request = fetchJson(`/api/automation?${query}`)
      .then((payload) => {
        lastPayload = payload
        return payload
      })
      .finally(() => {
        inflight = null
      })
    inflight = request
    return request
  }

  async function postAutomation(action, body = {}) {
    if (!context || !context.path) throw new Error('Automation context unavailable')
    const payload = {
      action,
      path: context.path,
      root: context.root || 'contentRoot',
      ...body,
    }
    debugLog('automation:store:post', { action, path: context.path })
    const data = await fetchJson('/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    lastPayload = data
    return data
  }

  async function saveTrigger(trigger, scenario) {
    if (!trigger || typeof trigger !== 'object') throw new Error('Invalid trigger payload')
    const scenarioSlug = scenario || (trigger && trigger.scenario)
    if (!scenarioSlug) throw new Error('Scenario required')
    return postAutomation('save-trigger', { trigger, scenario: scenarioSlug })
  }

  async function deleteTrigger(triggerId, scenario) {
    if (!triggerId) throw new Error('Trigger id required')
    const scenarioSlug = scenario
    if (!scenarioSlug) throw new Error('Scenario required')
    return postAutomation('delete-trigger', { triggerId, scenario: scenarioSlug })
  }

  async function createScenario(name) {
    if (!name || typeof name !== 'string') throw new Error('Scenario name required')
    return postAutomation('create-scenario', { name })
  }

  async function deleteScenario(slug) {
    if (!slug) throw new Error('Scenario slug required')
    return postAutomation('delete-scenario', { scenario: slug })
  }

  async function setConfig(partial = {}) {
    return postAutomation('set-config', partial)
  }

  async function setActiveScenario(slug) {
    if (!slug) throw new Error('Scenario slug required')
    return postAutomation('set-active-scenario', { scenario: slug })
  }

  return {
    setContext,
    getContext,
    loadAutomation,
    saveTrigger,
    deleteTrigger,
    createScenario,
    deleteScenario,
    setConfig,
    setActiveScenario,
  }
}
