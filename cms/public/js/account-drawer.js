import { dialogService } from './dialog-service.js?v=20250306'
import { ensureReact } from './modal.js?v=20250306'
import { createDrawerChrome } from './drawer-chrome.js?v=20250306'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'

const ACCOUNT_API_BASE = '/api/account-manager/accounts'
const MESSAGE_TIMEOUT = 4200

const PROVIDERS = [
  {
    id: 'credentials',
    label: 'AMI Credentials',
    description: 'Email & password stored in DataOps credentials store.',
    icon: iconMarkup('id-card-line'),
  },
  {
    id: 'google',
    label: 'Google Workspace',
    description: 'OAuth sign-in with Google identity.',
    icon: iconMarkup('google-fill'),
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'OAuth sign-in with GitHub accounts.',
    icon: iconMarkup('github-fill'),
  },
  {
    id: 'azure_ad',
    label: 'Azure AD',
    description: 'Entra ID / Azure Active Directory OAuth.',
    icon: iconMarkup('microsoft-fill'),
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'Machine identity managed by OpenAI.',
    icon: iconMarkup('robot-2-line'),
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Machine identity managed by Anthropic.',
    icon: iconMarkup('sparkling-line'),
  },
  {
    id: 'api_key',
    label: 'API Key',
    description: 'Static API key exchanges via VaultWarden.',
    icon: iconMarkup('key-2-line'),
  },
  {
    id: 'oauth2',
    label: 'Generic OAuth2',
    description: 'Bring-your-own OAuth2 provider.',
    icon: iconMarkup('git-branch-line'),
  },
]

const PROVIDER_MAP = new Map(PROVIDERS.map((p) => [p.id, p]))

function resolveProvider(id) {
  if (!id) return PROVIDER_MAP.get('credentials')
  return PROVIDER_MAP.get(id) || PROVIDER_MAP.get('credentials')
}

const ACTION_ICONS = {
  signIn: iconMarkup('login-circle-line'),
  signOut: iconMarkup('logout-circle-line'),
  default: iconMarkup('star-smile-line'),
  remove: iconMarkup('delete-bin-6-line'),
  refresh: iconMarkup('refresh-line'),
  add: iconMarkup('user-add-line'),
}

function createSlidingDrawerPortal(React) {
  const { useState, useEffect, useCallback, useRef } = React
  const e = React.createElement

  let openCounter = 0

  const addBodyState = () => {
    const body = document.body
    if (!body) return
    openCounter += 1
    body.classList.add('has-open-dialog')
    body.setAttribute('data-dialog-open', '1')
  }

  const removeBodyState = () => {
    const body = document.body
    if (!body) return
    openCounter = Math.max(0, openCounter - 1)
    if (openCounter === 0 && body.classList.contains('has-open-dialog')) {
      body.classList.remove('has-open-dialog')
      const stillOpen = document.querySelector(
        '.dialog-backdrop[data-state="open"], .dialog-backdrop[data-state="enter"][aria-hidden="false"]',
      )
      if (!stillOpen) body.removeAttribute('data-dialog-open')
    }
  }

  return function SlidingDrawerPortal({
    renderContent,
    onCloseComplete,
    registerClose,
    initialFocusSelector,
  }) {
    const [stage, setStage] = useState('closed')
    const closeTimerRef = useRef(null)
    const openFrameRef = useRef({ enter: null, open: null })
    const surfaceRef = useRef(null)

    const finishClose = useCallback(() => {
      setStage('closed')
      onCloseComplete?.()
    }, [onCloseComplete])

    const requestClose = useCallback(
      (immediate = false) => {
        if (immediate) {
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
          }
          finishClose()
          return
        }
        setStage((prev) => {
          if (prev === 'closing' || prev === 'closed') return prev
          if (prev === 'enter') {
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current)
              closeTimerRef.current = null
            }
            finishClose()
            return 'closed'
          }
          return 'closing'
        })
      },
      [finishClose],
    )

    useEffect(() => {
      if (typeof registerClose === 'function') registerClose(requestClose)
      return () => {
        if (typeof registerClose === 'function') registerClose(null)
      }
    }, [registerClose, requestClose])

    useEffect(() => {
      addBodyState()
      const frameIds = openFrameRef.current
      frameIds.enter = window.requestAnimationFrame(() => {
        setStage('enter')
        frameIds.open = window.requestAnimationFrame(() => {
          setStage('open')
        })
      })
      return () => {
        if (frameIds.enter != null) window.cancelAnimationFrame(frameIds.enter)
        if (frameIds.open != null) window.cancelAnimationFrame(frameIds.open)
        frameIds.enter = null
        frameIds.open = null
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current)
          closeTimerRef.current = null
        }
        removeBodyState()
      }
    }, [])

    useEffect(() => {
      if (stage !== 'closing') return undefined
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null
        finishClose()
      }, 260)
      return () => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current)
          closeTimerRef.current = null
        }
      }
    }, [stage, finishClose])

    useEffect(() => {
      const handler = (event) => {
        const key = event.key || event.code || ''
        if (key === 'Escape' || key === 'Esc') {
          event.preventDefault()
          requestClose()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [requestClose])

    useEffect(() => {
      if (stage !== 'open') return
      const surface = surfaceRef.current
      if (!surface) return
      const selector = typeof initialFocusSelector === 'string' ? initialFocusSelector : null
      const focusTarget =
        (selector && surface.querySelector(selector)) ||
        surface.querySelector('[data-drawer-autofocus]') ||
        surface
      try {
        focusTarget.focus({ preventScroll: true })
      } catch {
        try {
          focusTarget.focus()
        } catch {}
      }
    }, [stage, initialFocusSelector])

    const overlayProps = {
      className: 'dialog-backdrop dialog-backdrop--right account-drawer-backdrop',
      'data-state': stage,
      'aria-hidden': stage === 'closed' ? 'true' : 'false',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) requestClose()
      },
    }

    const surfaceProps = {
      className: 'drawer-surface content-drawer-surface account-drawer-surface',
      'data-state': stage,
      role: 'dialog',
      'aria-modal': 'true',
      ref: surfaceRef,
      tabIndex: -1,
      onMouseDown: (event) => event.stopPropagation(),
    }

    return e(
      'div',
      {
        className: 'drawer-portal-shell',
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 1600,
          pointerEvents: stage === 'closed' ? 'none' : 'auto',
        },
        'data-stage': stage,
      },
      e(
        'div',
        overlayProps,
        e(
          'div',
          surfaceProps,
          renderContent({ requestClose, stage }),
        ),
      ),
    )
  }
}

let ReactLib = null
let ReactDOMLib = null
let AccountDrawerComponent = null
let activeTrigger = null

let DrawerPortalComponent = null

let activeDrawerHandle = null

let DrawerHeaderComponent = null
let DrawerListItemComponent = null

let addDialogOverlay = null
let addDialogSurface = null
let addDialogRoot = null
let addDialogHandle = null

function encodeAccountPathSegment(segment) {
  return encodeURIComponent(segment)
}

async function accountApiRequest(path = '', init = {}) {
  const url = path ? `${ACCOUNT_API_BASE}${path}` : ACCOUNT_API_BASE
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' ? payload.error : null
    const message = detail || `Account API error (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

async function fetchAccountSnapshot() {
  return accountApiRequest('', { method: 'GET' })
}

async function createAccountRemote(payload) {
  return accountApiRequest('', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function deleteAccountRemote(accountId) {
  return accountApiRequest(`/${encodeAccountPathSegment(accountId)}`, {
    method: 'DELETE',
  })
}

async function setDefaultAccountRemote(accountId) {
  return accountApiRequest(`/${encodeAccountPathSegment(accountId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'set-default' }),
  })
}

async function touchAccountRemote(accountId) {
  return accountApiRequest(`/${encodeAccountPathSegment(accountId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'touch' }),
  })
}

function formatRelativeTime(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return 'just now'
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes === 1) return '1 minute ago'
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks === 1) return '1 week ago'
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  if (diffMonths < 12) return `${diffMonths} months ago`
  const diffYears = Math.floor(diffDays / 365)
  return diffYears <= 1 ? '1 year ago' : `${diffYears} years ago`
}

async function performSignOut(callbackUrl) {
  const csrfResponse = await fetch('/api/auth/csrf', {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!csrfResponse.ok) throw new Error('Unable to retrieve CSRF token for sign-out.')
  const csrfJson = await csrfResponse.json().catch(() => ({}))
  const csrfToken = csrfJson?.csrfToken
  if (!csrfToken) throw new Error('Auth CSRF token missing in response.')
  const params = new URLSearchParams()
  params.set('csrfToken', csrfToken)
  if (callbackUrl) params.set('callbackUrl', callbackUrl)
  const response = await fetch('/api/auth/signout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  if (!response.ok && response.status !== 302) {
    const text = await response.text().catch(() => '')
    const detail = text && text.length <= 160 ? text : ''
    throw new Error(detail || `Sign-out failed (${response.status}).`)
  }
}

async function beginSignInFlow(account) {
  const provider = resolveProvider(account.provider).id
  const callback = new URL(window.location.pathname + window.location.search, window.location.origin)
  callback.hash = ''
  if (provider === 'credentials') {
    try {
      await performSignOut(callback.toString())
    } catch (err) {
      console.warn('account-drawer: sign-out before credentials flow failed', err)
    }
    const target = new URL('/auth/signin', window.location.origin)
    target.searchParams.set('callbackUrl', callback.toString())
    if (account?.user?.email) target.searchParams.set('prefill', account.user.email)
    target.searchParams.set('source', 'account-manager')
    window.location.href = target.toString()
    return
  }
  try {
    await performSignOut(callback.toString())
  } catch (err) {
    console.warn('account-drawer: sign-out before provider flow failed', err)
  }
  const target = new URL(`/api/auth/signin/${provider}`, window.location.origin)
  target.searchParams.set('callbackUrl', callback.toString())
  target.searchParams.set('prompt', 'login')
  window.location.href = target.toString()
}

function createAccountDrawerComponent(React) {
  const { useState, useEffect, useMemo, useCallback, useRef } = React
  const e = React.createElement

  return function AccountDrawer({ onClose, autoGuest = false }) {
    const [accounts, setAccounts] = useState([])
    const [defaultAccountId, setDefaultAccountId] = useState(null)
    const [guestAccountId, setGuestAccountId] = useState(null)
    const [loadingAccounts, setLoadingAccounts] = useState(true)
    const [message, setMessage] = useState(null)
    const [messageKind, setMessageKind] = useState('info')
    const [messageToken, setMessageToken] = useState(0)
    const [filter, setFilter] = useState('')
    const [loadingSession, setLoadingSession] = useState(true)
    const [sessionError, setSessionError] = useState(null)
    const [sessionData, setSessionData] = useState(null)
    const [busyId, setBusyId] = useState(null)
    const [busyKind, setBusyKind] = useState(null)
    const [accountHints, setAccountHints] = useState({})
    const sessionRequestId = useRef(0)
    const autoGuestRef = useRef(false)

    useEffect(() => {
      let timeout = null
      if (message) {
        timeout = setTimeout(() => {
          setMessage(null)
          setMessageKind('info')
        }, MESSAGE_TIMEOUT)
      }
      return () => {
        if (timeout) clearTimeout(timeout)
      }
    }, [message, messageToken])

    function triggerMessage(text, kind = 'info') {
      if (!text) return
      setMessage(text)
      setMessageKind(kind)
      setMessageToken((prev) => prev + 1)
    }

    const setAccountHint = useCallback((accountId, hint) => {
      if (!accountId) return
      setAccountHints((prev) => {
        const normalize = (value) => {
          if (!value) return null
          if (typeof value === 'string') return { message: value, tone: 'danger', label: null }
          if (typeof value === 'object') {
            const message = value.message || value.text || value.content || null
            if (!message) return null
            return {
              message,
              tone: value.tone || 'danger',
              label: value.label || null,
            }
          }
          return null
        }
        const nextHint = normalize(hint)
        const existing = prev[accountId]
        if (!nextHint) {
          if (!existing) return prev
          const next = { ...prev }
          delete next[accountId]
          return next
        }
        if (
          existing &&
          existing.message === nextHint.message &&
          existing.tone === nextHint.tone &&
          existing.label === nextHint.label
        ) {
          return prev
        }
        return { ...prev, [accountId]: nextHint }
      })
    }, [])

    const clearAccountHint = useCallback(
      (accountId) => {
        if (!accountId) return
        setAccountHints((prev) => {
          if (!prev[accountId]) return prev
          const next = { ...prev }
          delete next[accountId]
          return next
        })
      },
      [],
    )

    const applySnapshot = useCallback((snapshot) => {
      if (!snapshot || typeof snapshot !== 'object') return
      setAccounts(Array.isArray(snapshot.accounts) ? snapshot.accounts : [])
      setDefaultAccountId(typeof snapshot.defaultAccountId === 'string' ? snapshot.defaultAccountId : null)
      setGuestAccountId(typeof snapshot.guestAccountId === 'string' ? snapshot.guestAccountId : null)
    }, [])

    const refreshAccounts = useCallback(async () => {
      setLoadingAccounts(true)
      try {
        const snapshot = await fetchAccountSnapshot()
        applySnapshot(snapshot)
      } catch (err) {
        console.error('account-drawer: failed to load account snapshot', err)
        const detail = err instanceof Error ? err.message : 'Failed to load accounts.'
        setAccounts([])
        setDefaultAccountId(null)
        setGuestAccountId(null)
        triggerMessage(detail, 'error')
      } finally {
        setLoadingAccounts(false)
      }
    }, [applySnapshot])

    useEffect(() => {
      void refreshAccounts()
    }, [refreshAccounts])

    useEffect(() => {
      setAccountHints((prev) => {
        const knownIds = new Set(accounts.map((acc) => acc.id))
        let mutated = false
        const next = {}
        Object.entries(prev).forEach(([id, hint]) => {
          if (!knownIds.has(id)) {
            mutated = true
            return
          }
          next[id] = hint
        })
        return mutated ? next : prev
      })
    }, [accounts])

    const refreshSession = useCallback(async () => {
      const requestId = (sessionRequestId.current += 1)
      setLoadingSession(true)
      setSessionError(null)
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Session request failed (${response.status})`)
        const json = await response.json().catch(() => null)
        if (sessionRequestId.current === requestId) {
          setSessionData(json && typeof json === 'object' && json.user ? json : null)
        }
      } catch (err) {
        if (sessionRequestId.current === requestId) {
          const detail = err instanceof Error ? err.message : 'Failed to load session info.'
          setSessionError(detail)
          setSessionData(null)
        }
      } finally {
        if (sessionRequestId.current === requestId) {
          setLoadingSession(false)
        }
      }
    }, [])

    useEffect(() => {
      void refreshSession()
    }, [refreshSession])

    useEffect(() => {
      if (!sessionError) {
        if (defaultAccountId) clearAccountHint(defaultAccountId)
        if (guestAccountId && guestAccountId !== defaultAccountId) clearAccountHint(guestAccountId)
        return
      }
      const targetId = defaultAccountId || guestAccountId || null
      if (targetId) {
        setAccountHint(targetId, {
          message: sessionError,
          tone: 'danger',
          label: 'Account session error',
        })
      }
    }, [sessionError, defaultAccountId, guestAccountId, clearAccountHint, setAccountHint])

    const currentUser = sessionData?.user || null
    const currentAccountEmail = currentUser?.email?.toLowerCase?.() || null

    const guestAccount = useMemo(() => {
      if (!guestAccountId) return null
      return accounts.find((entry) => entry?.id === guestAccountId) || null
    }, [accounts, guestAccountId])

    const sortedAccounts = useMemo(() => {
      return [...accounts].sort((a, b) => {
        if (a.id === defaultAccountId) return -1
        if (b.id === defaultAccountId) return 1
        if (a.lastUsed && b.lastUsed) return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        if (a.lastUsed) return -1
        if (b.lastUsed) return 1
        const aEmail = a?.user?.email || ''
        const bEmail = b?.user?.email || ''
        return aEmail.localeCompare(bEmail)
      })
    }, [accounts, defaultAccountId])

    const filteredAccounts = useMemo(() => {
      const term = filter.trim().toLowerCase()
      if (!term) return sortedAccounts
      return sortedAccounts.filter((account) => {
        const email = account?.user?.email?.toLowerCase?.() || ''
        if (email.includes(term)) return true
        const label = typeof account.label === 'string' ? account.label.toLowerCase() : ''
        if (label && label.includes(term)) return true
        const name = account?.user?.name ? account.user.name.toLowerCase() : ''
        if (name && name.includes(term)) return true
        const provider = resolveProvider(account.provider)
        if (provider.label.toLowerCase().includes(term)) return true
        return false
      })
    }, [sortedAccounts, filter])

    const totalAccounts = accounts.length

    const handleSetDefault = useCallback(async (accountId) => {
      setBusyId(accountId)
      setBusyKind('default')
      try {
        const snapshot = await setDefaultAccountRemote(accountId)
        applySnapshot(snapshot)
        triggerMessage('Default account updated.', 'ok')
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Failed to update default account.'
        triggerMessage(detail, 'error')
      } finally {
        setBusyId(null)
        setBusyKind(null)
      }
    }, [applySnapshot])

    const handleRemove = useCallback(async (accountId) => {
      if (guestAccountId && accountId === guestAccountId) {
        triggerMessage('Guest account cannot be removed.', 'error')
        return
      }
      setBusyId(accountId)
      setBusyKind('remove')
      try {
        const snapshot = await deleteAccountRemote(accountId)
        applySnapshot(snapshot)
        triggerMessage('Account removed.', 'info')
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Failed to remove account.'
        triggerMessage(detail, 'error')
      } finally {
        setBusyId(null)
        setBusyKind(null)
      }
    }, [applySnapshot, guestAccountId])

    const handleSignOut = useCallback(async () => {
      setBusyId('signout')
      setBusyKind('signout')
      try {
        await performSignOut(window.location.href)
        window.location.reload()
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Sign-out failed.'
        triggerMessage(detail, 'error')
      } finally {
        setBusyId(null)
        setBusyKind(null)
      }
    }, [])

    const handleSwitch = useCallback(
      async (account) => {
        if (!account?.user?.email) {
          triggerMessage('Account metadata incomplete.', 'error')
          return
        }
        clearAccountHint(account.id)
        setBusyId(account.id)
        setBusyKind('signin')
        try {
          if (currentUser) {
            const touchResult = await touchAccountRemote(account.id).catch((err) => {
              console.warn('account-drawer: touchAccountRemote failed', err)
              return null
            })
            if (touchResult && typeof touchResult === 'object') applySnapshot(touchResult)
          }
          await beginSignInFlow(account)
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'Account switch failed.'
          triggerMessage(detail, 'error')
          setAccountHint(account.id, { message: detail, tone: 'danger', label: 'Account switch failed' })
          setBusyId(null)
          setBusyKind(null)
        }
      },
      [applySnapshot, clearAccountHint, currentUser, setAccountHint],
    )

    useEffect(() => {
      if (!autoGuest) return
      if (autoGuestRef.current) return
      if (loadingAccounts || loadingSession) return
      if (currentUser) return
      if (!guestAccount) return
      autoGuestRef.current = true
      setTimeout(() => {
        void handleSwitch(guestAccount)
      }, 0)
    }, [autoGuest, currentUser, guestAccount, handleSwitch, loadingAccounts, loadingSession])

    const openAddDialog = useCallback(async () => {
      const defaultProviderForDialog = (() => {
        const defaultAccount = accounts.find((acc) => acc.id === defaultAccountId)
        if (defaultAccount) return defaultAccount.provider
        return accounts[0]?.provider || 'credentials'
      })()

      const result = await openAddAccountDialog({
        accounts,
        defaultProvider: resolveProvider(defaultProviderForDialog).id,
      })
      if (!result) return

      const email = result.email.trim().toLowerCase()
      const providerId = resolveProvider(result.provider).id

      const duplicate = accounts.some(
        (acc) => acc.provider === providerId && acc?.user?.email?.toLowerCase?.() === email,
      )
      if (duplicate) {
        triggerMessage('That account is already in your list.', 'error')
        return
      }

      setBusyId('add-account')
      setBusyKind('add')
      try {
        const snapshot = await createAccountRemote({
          email,
          provider: providerId,
          label: result.label ? result.label.trim() : null,
        })
        applySnapshot(snapshot)
        triggerMessage('Account added.', 'ok')

        if (result.mode === 'signin' && Array.isArray(snapshot.accounts)) {
          const nextAccount = snapshot.accounts.find(
            (acc) => acc.provider === providerId && acc?.user?.email?.toLowerCase?.() === email,
          )
          if (nextAccount) {
            setTimeout(() => {
              void handleSwitch(nextAccount)
            }, 0)
          }
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Failed to add account.'
        triggerMessage(detail, 'error')
      } finally {
        setBusyId(null)
        setBusyKind(null)
      }
    }, [accounts, applySnapshot, defaultAccountId, handleSwitch])

    function AccountRow({ account }) {
      if (!DrawerListItemComponent) return null
      const provider = resolveProvider(account.provider)
      const email = account?.user?.email || ''
      const name = account?.user?.name || account.label || email || provider.label
      const isDefault = account.id === defaultAccountId
      const isActive = currentAccountEmail && currentAccountEmail === email.toLowerCase()
      const isGuest = guestAccountId && account.id === guestAccountId
      const lastUsed = formatRelativeTime(account.lastUsed)
      const isAccountBusy = busyId === account.id
      const isSignoutBusy = busyKind === 'signout'
      const isSwitching = isAccountBusy && busyKind === 'signin'
      const isDefaulting = isAccountBusy && busyKind === 'default'
      const isRemoving = isAccountBusy && busyKind === 'remove'

      const detailParts = []
      if (provider?.label) detailParts.push(provider.label)
      if (lastUsed) detailParts.push(`Last used ${lastUsed}`)
      const detailLine = detailParts.length ? detailParts.join(' • ') : null
      const subtitles = []
      if (email) subtitles.push(email)
      if (subtitles.length < 2 && detailLine) subtitles.push(detailLine)
      if (subtitles.length < 2 && account.label && account.label !== name) subtitles.push(account.label)

      const badges = []
      if (isDefault) badges.push({ key: 'default', text: 'Default', tone: 'accent' })
      if (isGuest) badges.push({ key: 'guest', text: 'Guest', tone: 'neutral' })

      const actions = []

      if (isActive) {
        actions.push({
          key: 'signout',
          icon: ACTION_ICONS.signOut,
          label: `Sign out of ${name}`,
          onClick: () => handleSignOut(),
          disabled: isSignoutBusy || isAccountBusy,
          busy: isSignoutBusy,
          variant: 'accent',
        })
      } else {
        actions.push({
          key: 'signin',
          icon: ACTION_ICONS.signIn,
          label: `Sign in as ${name}`,
          onClick: () => handleSwitch(account),
          disabled: isAccountBusy,
          busy: isSwitching,
          variant: 'accent',
        })
      }

      if (!isDefault && !isGuest) {
        actions.push({
          key: 'default',
          icon: ACTION_ICONS.default,
          label: 'Set as default account',
          onClick: () => handleSetDefault(account.id),
          disabled: isAccountBusy,
          busy: isDefaulting,
        })
      }

      if (!isGuest && !isDefault) {
        actions.push({
          key: 'remove',
          icon: ACTION_ICONS.remove,
          label: 'Remove account',
          onClick: () => handleRemove(account.id),
          disabled: isAccountBusy,
          busy: isRemoving,
          variant: 'danger',
        })
      }

      const accountHint = accountHints[account.id]
      const status = accountHint
        ? {
            tone: accountHint.tone || 'danger',
            label: accountHint.label || 'Account issue',
            hint: {
              text: accountHint.message,
              tone: accountHint.tone || 'danger',
            },
          }
        : isActive
          ? { tone: 'positive', label: 'Active session' }
          : null

      return e(DrawerListItemComponent, {
        key: account.id,
        icon: provider.icon,
        title: name,
        active: isActive && !accountHint,
        status,
        badges,
        subtitles,
        actions,
        selected: isActive,
        onDoubleClick:
          !isActive && busyId !== account.id
            ? () => {
                void handleSwitch(account)
              }
            : undefined,
      })
    }

    const headerActions = useMemo(
      () => [
        {
          key: 'refresh-session',
          label: loadingSession ? 'Refreshing session…' : 'Reload session info',
          icon: ACTION_ICONS.refresh,
          onClick: () => {
            void refreshSession()
          },
          disabled: loadingSession,
          active: loadingSession,
        },
        {
          key: 'add-account',
          label: 'Add account',
          icon: ACTION_ICONS.add,
          onClick: openAddDialog,
        },
      ],
      [loadingSession, openAddDialog, refreshSession],
    )

    return e(
      'div',
      { className: 'drawer-shell account-drawer-shell' },
      DrawerHeaderComponent
        ? e(DrawerHeaderComponent, {
            title: 'Account Management',
            description: 'Switch between identities and sessions without leaving the shell.',
            onClose,
            closeLabel: 'Close account manager',
            filter: {
              placeholder: 'Filter accounts…',
              ariaLabel: 'Filter accounts',
              value: filter,
              onChange: (event) => setFilter(event.target.value),
            },
            actions: headerActions,
          })
        : null,
      message
        ? e('div', { className: `account-drawer__alert account-drawer__alert--${messageKind}` }, message)
        : null,
      e(
        'section',
        { className: 'account-drawer__section account-drawer__section--stretch' },
        e(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginBottom: 10,
              paddingRight: 32,
            },
          },
          e(
            'span',
            { className: 'muted', style: { fontSize: 12 } },
            loadingAccounts ? 'Loading…' : `${totalAccounts} configured`,
          ),
        ),
        e(
          'div',
          {
            className: 'drawer-list account-drawer__list-box',
          },
          loadingAccounts
            ? e(
                'div',
                {
                  className: 'loading-indicator loading-indicator--compact drawer-loading',
                  style: { justifyContent: 'center' },
                },
                e('span', { className: 'loading-indicator__spinner', 'aria-hidden': 'true' }),
                e('span', null, 'Loading accounts…'),
              )
            : filteredAccounts.length
              ? filteredAccounts.map((account) => e(AccountRow, { account, key: account.id }))
              : e(
                  'div',
                  {
                    className: 'muted',
                    style: {
                      textAlign: 'center',
                      padding: '40px 20px',
                    },
                  },
                  filter.trim()
                    ? `No accounts match "${filter.trim()}".`
                    : 'Add an account to get started. Credentials remain managed by NextAuth and VaultWarden.',
                ),
        ),
      ),
    )
  }
}

function createAddAccountDialog(React) {
  const { useState, useMemo } = React
  const e = React.createElement

  return function AddAccountDialog({ onSubmit, onCancel, defaultProviderId, existingEmails }) {
    const [providerId, setProviderId] = useState(defaultProviderId || 'credentials')
    const [email, setEmail] = useState('')
    const [label, setLabel] = useState('')
    const [error, setError] = useState(null)

    const provider = resolveProvider(providerId)
    const reservedKeys = useMemo(
      () => new Set((existingEmails || []).map((value) => String(value || '').toLowerCase())),
      [existingEmails],
    )

    const validate = () => {
      const trimmedEmail = email.trim().toLowerCase()
      if (!trimmedEmail) return 'Provide an email or identifier.'
      const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
      if (provider.id === 'credentials' && !emailLike) return 'Enter a valid email address.'
      const providerKey = `${provider.id}:${trimmedEmail}`
      const anyKey = `any:${trimmedEmail}`
      if (reservedKeys.has(providerKey) || reservedKeys.has(anyKey)) return 'Account already exists.'
      return null
    }

    const handleSubmit = (mode) => {
      const validation = validate()
      if (validation) {
        setError(validation)
        return
      }
      onSubmit({
        email: email.trim(),
        label,
        provider: provider.id,
        mode,
      })
    }

    return e(
      'div',
      { className: 'account-add-dialog' },
      e(
        'div',
        { className: 'account-add-dialog__title-row' },
        e('h2', { className: 'dialog-title' }, 'Add Account'),
        e(
          'button',
          {
            className: 'icon-button dialog-close',
            type: 'button',
            onClick: onCancel,
            'aria-label': 'Close add account dialog',
            title: 'Close add account dialog',
          },
          e('span', { 'aria-hidden': 'true', dangerouslySetInnerHTML: { __html: iconMarkup('close-line') } }),
        ),
      ),
      e(
        'div',
        { className: 'account-add-dialog__content' },
        e('div', { className: 'account-add-dialog__section' },
          e('h3', null, 'Provider'),
          e(
            'div',
            { className: 'account-add-dialog__providers' },
            ...PROVIDERS.map((item) =>
              e(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: `account-add-dialog__provider${item.id === provider.id ? ' is-active' : ''}`,
                  title: item.label,
                  'aria-pressed': item.id === provider.id,
                  onClick: () => {
                    setProviderId(item.id)
                    setError(null)
                  },
                },
                e('span', {
                  className: 'drawer-list-item__icon',
                  dangerouslySetInnerHTML: { __html: item.icon },
                  'aria-hidden': 'true',
                }),
                e('span', { className: 'account-add-dialog__provider-label' }, item.label),
              ),
            ),
          ),
        ),
        e('div', { className: 'account-add-dialog__section' },
          e('h3', null, provider.id === 'credentials' ? 'User Email' : 'Identifier'),
          e('input', {
            type: provider.id === 'credentials' ? 'email' : 'text',
            placeholder: provider.id === 'credentials' ? 'name@example.com' : 'client-id or subject',
            value: email,
            onChange: (event) => {
              setEmail(event.target.value)
              setError(null)
            },
            autoFocus: true,
          }),
        ),
        e('div', { className: 'account-add-dialog__section' },
          e('h3', null, 'Label (Optional)'),
          e('input', {
            type: 'text',
            placeholder: 'Finance tenant, staging, etc.',
            value: label,
            onChange: (event) => setLabel(event.target.value),
          }),
        ),
        error ? e('p', { className: 'account-add-dialog__error', role: 'alert' }, error) : null,
      ),
      e(
        'div',
        { className: 'account-add-dialog__footer' },
        e(
          'button',
          { className: 'dialog-button dialog-button--subtle', type: 'button', onClick: onCancel },
          'Cancel',
        ),
        e(
          'div',
          { className: 'dialog-actions' },
          e(
            'button',
            { className: 'dialog-button', type: 'button', onClick: () => handleSubmit('add') },
            'Add Account',
          ),
          e(
            'button',
            { className: 'dialog-button', type: 'button', onClick: () => handleSubmit('signin') },
            'Add & Sign In',
          ),
        ),
      ),
    )
  }
}

async function ensureReactLibs() {
  if (ReactLib && ReactDOMLib) return
  const libs = await ensureReact()
  ReactLib = libs.React
  ReactDOMLib = libs.ReactDOM
  if (ReactLib && (!DrawerHeaderComponent || !DrawerListItemComponent)) {
    const { DrawerHeader, DrawerListItem } = createDrawerChrome(ReactLib)
    if (!DrawerHeaderComponent) DrawerHeaderComponent = DrawerHeader
    if (!DrawerListItemComponent) DrawerListItemComponent = DrawerListItem
  }
}

async function ensureAddDialog() {
  await ensureReactLibs()
  if (!addDialogOverlay) {
    addDialogOverlay = document.createElement('div')
    addDialogOverlay.className = 'dialog-backdrop account-add-dialog__backdrop'
    addDialogOverlay.setAttribute('aria-hidden', 'true')
    addDialogSurface = document.createElement('div')
    addDialogSurface.className = 'dialog-surface account-add-dialog__surface'
    addDialogOverlay.appendChild(addDialogSurface)
    document.body.appendChild(addDialogOverlay)
  }
  if (!addDialogRoot) {
    const container = document.createElement('div')
    addDialogSurface.appendChild(container)
    addDialogRoot = ReactDOMLib.createRoot(container)
  }
  if (!addDialogHandle) {
    addDialogHandle = dialogService.register('account-add', {
      overlay: addDialogOverlay,
      surface: addDialogSurface,
      allowBackdropClose: true,
      closeOnEscape: true,
      onClose: () => {
        if (addDialogRoot) addDialogRoot.render(null)
      },
    })
  }
}

export async function openAccountDrawer(options = {}) {
  await ensureReactLibs()
  if (!ReactLib || !ReactDOMLib) throw new Error('Account drawer unavailable (React failed to load).')
  if (!DrawerPortalComponent) DrawerPortalComponent = createSlidingDrawerPortal(ReactLib)
  if (!AccountDrawerComponent) AccountDrawerComponent = createAccountDrawerComponent(ReactLib)

  const autoGuest = Boolean(options?.autoGuest)
  const trigger = options?.trigger
  if (trigger instanceof HTMLElement) {
    activeTrigger = trigger
    activeTrigger.setAttribute('aria-expanded', 'true')
  } else {
    activeTrigger = null
  }

  if (activeDrawerHandle && typeof activeDrawerHandle.close === 'function') {
    activeDrawerHandle.close(true)
  }

  const container = document.createElement('div')
  container.className = 'account-drawer-portal'
  document.body.appendChild(container)
  const root = ReactDOMLib.createRoot(container)

  let closeImpl = null

  const cleanup = () => {
    try {
      root.unmount()
    } catch {}
    try {
      container.remove()
    } catch {}
    if (activeTrigger && document.contains(activeTrigger)) {
      activeTrigger.setAttribute('aria-expanded', 'false')
      try {
        activeTrigger.focus({ preventScroll: true })
      } catch {
        try {
          activeTrigger.focus()
        } catch {}
      }
    } else if (activeTrigger) {
      activeTrigger.setAttribute('aria-expanded', 'false')
    }
    activeTrigger = null
    if (activeDrawerHandle === handle) {
      activeDrawerHandle = null
    }
    closeImpl = null
  }

  const registerClose = (fn) => {
    closeImpl = typeof fn === 'function' ? fn : null
  }

  const renderContent = ({ requestClose }) =>
    ReactLib.createElement(
      'div',
      { className: 'account-drawer__content' },
      ReactLib.createElement(AccountDrawerComponent, {
        onClose: () => requestClose(),
        autoGuest,
      }),
    )

  const handle = {
    close(immediate = false) {
      if (typeof closeImpl === 'function') {
        closeImpl(immediate)
      } else {
        cleanup()
      }
    },
  }

  activeDrawerHandle = handle

  root.render(
    ReactLib.createElement(DrawerPortalComponent, {
      renderContent,
      onCloseComplete: cleanup,
      registerClose,
      initialFocusSelector: null,
    }),
  )
}

export function closeAccountDrawer(immediate = false) {
  if (activeDrawerHandle && typeof activeDrawerHandle.close === 'function') {
    activeDrawerHandle.close(immediate)
  }
}

export async function openAddAccountDialog({ accounts = [], defaultProvider = 'credentials' } = {}) {
  await ensureAddDialog()
  if (!addDialogHandle || !addDialogRoot || !ReactLib) return null
  const existingEmails = accounts
    .flatMap((acc) => {
      if (!acc) return []
      const providerId = typeof acc.provider === 'string' ? acc.provider : acc.provider?.id
      const emailValue = typeof acc.email === 'string' ? acc.email : acc?.user?.email
      if (!providerId || !emailValue) return []
      const normalized = emailValue.toLowerCase()
      return [`any:${normalized}`, `${providerId}:${normalized}`]
    })
    .filter(Boolean)
  return new Promise((resolve) => {
    const handleClose = (payload) => {
      addDialogHandle.close()
      resolve(payload)
    }
    const AddDialog = createAddAccountDialog(ReactLib)
    addDialogRoot.render(
      ReactLib.createElement(AddDialog, {
        onSubmit: (data) => handleClose(data),
        onCancel: () => handleClose(null),
        defaultProviderId: resolveProvider(defaultProvider).id,
        existingEmails,
      }),
    )
    addDialogHandle.open()
  })
}
