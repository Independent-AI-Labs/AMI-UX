const originalFetch = window.fetch.bind(window)

function toHeaders(initHeaders) {
  if (!initHeaders) return undefined
  if (initHeaders instanceof Headers) return initHeaders
  return { ...initHeaders }
}

window.fetch = async function authFetch(input, init = {}) {
  const headers = toHeaders(init.headers)
  const finalInit = {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  }

  const response = await originalFetch(input, finalInit)
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('ami:unauthorized', { detail: { url: typeof input === 'string' ? input : input.toString() } }))
  }
  return response
}

window.addEventListener('ami:navigate-signin', () => {
  const target = new URL('/auth/signin', window.location.origin)
  target.searchParams.set('callbackUrl', window.location.pathname + window.location.search)
  window.location.href = target.toString()
})
