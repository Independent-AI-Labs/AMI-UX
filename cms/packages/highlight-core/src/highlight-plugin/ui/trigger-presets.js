const DEFAULT_ACTION = 'console.log("Automation trigger fired", context);'

export const TRIGGER_TYPES = ['dom', 'network', 'plugin']

export const TRIGGER_TYPE_META = {
  dom: {
    name: 'DOM Trigger',
    description: 'Runs when matching DOM events fire on the selected elements.',
    eventHint: 'Use browser events like click, input, or custom DOM events.',
  },
  network: {
    name: 'Network Trigger',
    description: 'Listens to network activity and reacts to matching requests or responses.',
    eventHint: 'Return an object with matcher details (method, URL, headers) and optional streaming hooks.',
  },
  plugin: {
    name: 'Plugin Trigger',
    description: 'Forwards trigger context into registered automation plugins.',
    eventHint: 'Call into plugins defined by the host environment via context.manager.',
  },
}

function generateId(manager) {
  if (manager && typeof manager.generateTriggerId === 'function') {
    try {
      return manager.generateTriggerId()
    } catch {}
  }
  return `ami-trigger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function createTriggerTemplate(kind = 'dom', options = {}) {
  const manager = options.manager || null
  const baseId = typeof options.id === 'string' && options.id.trim() ? options.id.trim() : generateId(manager)
  const elementLabel = typeof options.elementLabel === 'string' ? options.elementLabel : ''
  const selector = typeof options.selector === 'string' ? options.selector : ''
  const eventType = typeof options.eventType === 'string' && options.eventType.trim() ? options.eventType.trim() : 'click'
  const scenario = typeof options.scenario === 'string' ? options.scenario : undefined
  const drafts = {
    id: baseId,
    name: options.name || (kind === 'network' ? 'Network Trigger' : kind === 'plugin' ? 'Plugin Trigger' : elementLabel || 'DOM Trigger'),
    notes: typeof options.notes === 'string' ? options.notes : '',
    enabled: options.enabled !== false,
    owner: typeof options.owner === 'string' ? options.owner : '',
    selector,
    elementLabel,
    scenario,
  }

  if (kind === 'network') {
    return {
      ...drafts,
      type: 'network',
      eventType: 'network',
      targetCode:
        options.targetCode ||
        `return {
  method: 'GET',
  url: /\\/api\\//,
  onMatch(request) {
    console.log('Network automation matched', request, context);
  },
};`,
      conditionCode:
        options.conditionCode ||
        `const { request } = context;
if (!request) return false;
return true;`,
      actionCode:
        options.actionCode ||
        `const { request, response } = context;
console.log('Network automation payload', { request, response });`,
    }
  }

  if (kind === 'plugin') {
    return {
      ...drafts,
      type: 'plugin',
      eventType: 'plugin',
      targetCode:
        options.targetCode ||
        `return {
  plugin: 'examplePlugin',
  payload: {
    triggerId: '${baseId}',
  },
};`,
      conditionCode:
        options.conditionCode ||
        `return typeof context.manager?.invokePlugin === 'function';`,
      actionCode:
        options.actionCode ||
        `if (context.manager?.invokePlugin) {
  return Promise.resolve(context.manager.invokePlugin('examplePlugin', context));
}
console.warn('No plugin bridge available for automation trigger.', context);
return null;`,
    }
  }

  return {
    ...drafts,
    type: 'dom',
    eventType,
    targetCode:
      options.targetCode ||
      (selector
        ? `return document.querySelector(${JSON.stringify(selector)});`
        : 'return context.event?.currentTarget || context.element || null;'),
    conditionCode: options.conditionCode || 'return true;',
    actionCode: options.actionCode || DEFAULT_ACTION,
  }
}
