const LOOPBACK_HOSTS = new Set(['0.0.0.0', '::', '::0', '[::]', '[::0]'])

function firstHeaderValue(raw: string | null): string | null {
  if (!raw) return null
  const [first] = raw.split(',')
  const trimmed = first?.trim()
  return trimmed && trimmed.length ? trimmed : null
}

function parseHostHeader(raw: string): { hostname: string; port: string | null } {
  try {
    const url = new URL(`http://${raw}`)
    return { hostname: url.hostname, port: url.port || null }
  } catch {
    return { hostname: raw, port: null }
  }
}

function normaliseHostname(hostname: string): string {
  const lower = hostname.toLowerCase()
  if (LOOPBACK_HOSTS.has(lower)) {
    return '127.0.0.1'
  }
  return hostname
}

function stripPath(url: URL): URL {
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url
}

function ensureProtocol(value: string | null, fallback: string): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.endsWith(':') ? trimmed : `${trimmed}:`
}

export function resolveRequestOrigin(request: Request): URL {
  const fallback = new URL(request.url)
  const protoHeader = firstHeaderValue(request.headers.get('x-forwarded-proto'))
  const hostHeader = firstHeaderValue(request.headers.get('x-forwarded-host'))
    ?? firstHeaderValue(request.headers.get('host'))
  const portHeader = firstHeaderValue(request.headers.get('x-forwarded-port'))

  const base = stripPath(new URL(`${fallback.protocol}//${fallback.host}`))

  if (hostHeader) {
    const { hostname, port } = parseHostHeader(hostHeader)
    base.hostname = normaliseHostname(hostname)
    if (port) {
      base.port = port
    } else if (portHeader) {
      base.port = portHeader
    } else {
      base.port = fallback.port
    }
  } else {
    base.hostname = normaliseHostname(base.hostname)
    if (portHeader) {
      base.port = portHeader
    }
  }

  base.protocol = ensureProtocol(protoHeader, fallback.protocol)

  if (!base.port && fallback.port) {
    base.port = fallback.port
  }

  return base
}

export function buildAbsoluteUrl(base: URL, target: string | URL): URL {
  if (target instanceof URL) {
    if (target.origin === base.origin) return target
    if (target.host && target.host !== base.host) {
      return new URL(target.pathname + target.search + target.hash, base)
    }
    return new URL(target.toString(), base)
  }

  try {
    const candidate = new URL(target)
    if (candidate.origin === base.origin) return candidate
    return new URL(candidate.pathname + candidate.search + candidate.hash, base)
  } catch {
    // Ignore parse failures - treat as relative below
  }

  return new URL(target, base)
}
