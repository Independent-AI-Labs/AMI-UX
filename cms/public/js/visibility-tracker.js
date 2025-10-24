const NOOP = () => {}

function createMinimalVisibilityTracker() {
  const listeners = new Set()
  return {
    setRoot: NOOP,
    setOptions: NOOP,
    observe: NOOP,
    unobserve: NOOP,
    refresh: NOOP,
    dispose: NOOP,
    getVisibleEntries() {
      return []
    },
    subscribe(listener) {
      if (typeof listener === 'function') listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function createVisibilityTracker(options = {}) {
  if (typeof window === 'undefined' || typeof IntersectionObserver !== 'function') {
    return createMinimalVisibilityTracker()
  }

  const listeners = new Set()
  const observed = new Map()
  const visibleElements = new Set()

  let root = options.root || null
  let rootMargin = typeof options.rootMargin === 'string' ? options.rootMargin : '96px 0px'
  let threshold = Array.isArray(options.threshold) ? options.threshold : [0, 0.25, 0.5, 0.75, 1]
  let observer = null

  const getVisibleEntries = () => {
    const snapshot = []
    visibleElements.forEach((element) => {
      const meta = observed.get(element)
      if (!meta || !meta.entry) return
      snapshot.push({ element, path: meta.path, entry: meta.entry })
    })
    return snapshot
  }

  const notify = () => {
    const snapshot = getVisibleEntries()
    listeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (error) {
        console.warn('Visibility tracker listener failed', error)
      }
    })
  }

  const handleEntries = (entries) => {
    let touched = false
    for (const entry of entries) {
      const meta = observed.get(entry.target)
      if (!meta) continue
      meta.entry = entry
      if (entry.isIntersecting && entry.intersectionRatio > 0) {
        if (!visibleElements.has(entry.target)) {
          visibleElements.add(entry.target)
          touched = true
        }
      } else if (visibleElements.delete(entry.target)) {
        touched = true
      }
    }
    if (touched) notify()
  }

  const rebuildObserver = () => {
    if (observer) observer.disconnect()
    observer = new IntersectionObserver(handleEntries, { root, rootMargin, threshold })
    observed.forEach((meta, element) => {
      observer.observe(element)
      if (meta.entry) {
        observer.unobserve(element)
        observer.observe(element)
      }
    })
  }

  rebuildObserver()

  return {
    setRoot(nextRoot) {
      const normalized = nextRoot || null
      if (normalized === root) return
      root = normalized
      rebuildObserver()
      notify()
    },
    setOptions(nextOptions = {}) {
      const nextMargin =
        typeof nextOptions.rootMargin === 'string' ? nextOptions.rootMargin : rootMargin
      const nextThreshold = Array.isArray(nextOptions.threshold)
        ? nextOptions.threshold
        : threshold
      const shouldRebuild = nextMargin !== rootMargin || nextThreshold !== threshold
      rootMargin = nextMargin
      threshold = nextThreshold
      if (shouldRebuild) rebuildObserver()
    },
    observe(element, path) {
      if (!element || typeof element !== 'object') return
      const normalizedPath = typeof path === 'string' ? path : ''
      const existing = observed.get(element)
      if (existing && existing.path === normalizedPath) {
        if (observer) observer.observe(element)
        return
      }
      if (existing) {
        visibleElements.delete(element)
      }
      observed.set(element, { path: normalizedPath, entry: existing?.entry || null })
      if (observer) observer.observe(element)
    },
    unobserve(element) {
      if (!element || !observed.has(element)) return
      observed.delete(element)
      visibleElements.delete(element)
      if (observer) observer.unobserve(element)
    },
    refresh() {
      if (!observer) return
      observed.forEach((meta, element) => {
        observer.unobserve(element)
        observer.observe(element)
      })
    },
    getVisibleEntries,
    subscribe(listener) {
      if (typeof listener === 'function') listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      listeners.clear()
      if (observer) observer.disconnect()
      observed.clear()
      visibleElements.clear()
    },
  }
}
