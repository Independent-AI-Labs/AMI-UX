const DEFAULT_LANGUAGE = 'plaintext'
const viewRegistry = new WeakMap()
let copyHandlerBound = false
let highlighterPromise = null

const HLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0'
const HLJS_CORE_SRC = `${HLJS_BASE}/highlight.min.js`
const HLJS_LANGUAGE_SCRIPTS = [
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'dockerfile',
  'go',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'makefile',
  'markdown',
  'objectivec',
  'php',
  'plaintext',
  'powershell',
  'python',
  'ruby',
  'rust',
  'shell',
  'sql',
  'swift',
  'toml',
  'typescript',
  'yaml',
].map((lang) => `${HLJS_BASE}/languages/${lang}.min.js`)

const scriptPromises = new Map()

function ensureCopyHandler() {
  if (copyHandlerBound) return
  copyHandlerBound = true
  document.addEventListener('click', async (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const btn = target.closest('.code-view__copy')
    if (!btn) return
    const root = btn.closest('.code-view')
    if (!root) return
    event.preventDefault()
    event.stopPropagation()
    const instance = viewRegistry.get(root)
    if (instance) {
      instance.copy()
      return
    }
    const codeEl = root.querySelector('.code-view__pre code')
    const text = codeEl ? codeEl.textContent || '' : ''
    try {
      await navigator.clipboard.writeText(text)
      root.classList.add('code-view--copied')
      setTimeout(() => root.classList.remove('code-view--copied'), 1200)
    } catch (err) {
      console.warn('Failed to copy code', err)
    }
  })
}

function loadScriptOnce(src) {
  if (scriptPromises.has(src)) return scriptPromises.get(src)
  const promise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  }).catch((err) => {
    scriptPromises.delete(src)
    throw err
  })
  scriptPromises.set(src, promise)
  return promise
}

async function ensureHighlighter() {
  if (typeof window === 'undefined') return null
  if (window.hljs?.highlight) return window.hljs
  if (highlighterPromise) return highlighterPromise

  highlighterPromise = loadScriptOnce(HLJS_CORE_SRC)
    .then(async () => {
      const hljs = window.hljs || null
      if (!hljs) return null
      await Promise.all(HLJS_LANGUAGE_SCRIPTS.map((src) => loadScriptOnce(src).catch(() => null)))
      return window.hljs || hljs
    })
    .catch((err) => {
      console.warn('Failed to initialize syntax highlighter', err)
      return null
    })

  return highlighterPromise
}

const EXTENSION_LANGUAGE_MAP = {
  js: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  json5: 'json',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  php: 'php',
  cs: 'csharp',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  mm: 'objectivec',
  swift: 'swift',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  bat: 'dos',
  cmd: 'dos',
  ps1: 'powershell',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  sql: 'sql',
  proto: 'protobuf',
  diff: 'diff',
  patch: 'diff',
  log: 'plaintext',
  txt: 'plaintext',
}

const FILENAME_LANGUAGE_MAP = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  'makefile.am': 'makefile',
  'makefile.in': 'makefile',
  'cjs.config': 'javascript',
}

const LANGUAGE_ALIAS_MAP = {
  js: 'javascript',
  javascript: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json5: 'json',
  yml: 'yaml',
  shell: 'bash',
  sh: 'bash',
  bash: 'bash',
  shellsession: 'bash',
  console: 'bash',
  plaintext: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
  md: 'markdown',
  markdown: 'markdown',
  html: 'xml',
  xml: 'xml',
  svg: 'xml',
  csharp: 'csharp',
  'c#': 'csharp',
  golang: 'go',
  objc: 'objectivec',
  'objc++': 'objectivec',
  'objcxx': 'objectivec',
  docker: 'dockerfile',
  dockerfile: 'dockerfile',
  protobuf: 'protobuf',
  proto: 'protobuf',
  powershell: 'powershell',
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normaliseLanguage(lang) {
  if (!lang) return ''
  const key = String(lang).toLowerCase()
  return LANGUAGE_ALIAS_MAP[key] || key
}

export function normaliseLanguageHint(lang) {
  return normaliseLanguage(lang)
}

export function guessLanguageFromClassName(className = '') {
  if (!className) return ''
  const match = String(className).match(/language-([\w#+-]+)/i)
  if (match && match[1]) return normaliseLanguage(match[1])
  return ''
}

export function guessLanguageFromFilename(name = '') {
  if (!name) return ''
  const lowered = String(name).toLowerCase()
  if (FILENAME_LANGUAGE_MAP[lowered]) return FILENAME_LANGUAGE_MAP[lowered]
  if (lowered.endsWith('.d.ts') || lowered.endsWith('.d.tsx')) return 'typescript'
  const parts = lowered.split('.')
  if (parts.length > 1) {
    const ext = parts.pop() || ''
    if (EXTENSION_LANGUAGE_MAP[ext]) return EXTENSION_LANGUAGE_MAP[ext]
  }
  return ''
}

function buildLineNumbers(code) {
  const lines = String(code || '').split(/\r\n|\n|\r/)
  if (!lines.length) lines.push('')
  const frag = document.createDocumentFragment()
  for (let i = 0; i < lines.length; i++) {
    const li = document.createElement('li')
    li.textContent = String(i + 1)
    frag.appendChild(li)
  }
  return frag
}

function highlight(code, languageHint, hljs) {
  if (!hljs) {
    return { html: escapeHtml(code), language: languageHint || DEFAULT_LANGUAGE }
  }
  const resolved = normaliseLanguage(languageHint)
  try {
    if (resolved && resolved !== 'plaintext' && hljs.getLanguage(resolved)) {
      const res = hljs.highlight(code, { language: resolved, ignoreIllegals: true })
      return { html: res.value, language: res.language || resolved }
    }
    const res = hljs.highlightAuto(code)
    return {
      html: res.value,
      language: res.language || (resolved || DEFAULT_LANGUAGE),
    }
  } catch {
    return { html: escapeHtml(code), language: resolved || DEFAULT_LANGUAGE }
  }
}

function applyHighlight(instance, hljs, token) {
  if (!instance || instance.renderToken !== token) return
  const { html, language } = highlight(instance.code, instance.languageHint, hljs)
  instance.codeEl.innerHTML = html
  const normalised = normaliseLanguage(language) || DEFAULT_LANGUAGE
  instance.languageDetected = normalised
  instance.updateLanguageBadge(normalised)
  instance.element.dataset.language = normalised
  const displayText = instance.codeEl.textContent || instance.code
  instance.setGutterText(displayText)
}

export class CodeView {
  constructor(options = {}) {
    const {
      code = '',
      language = '',
      filename = '',
      wrap = false,
      showCopy = true,
      showLanguage = true,
      showHeader = Boolean(filename),
    } = options

    this.code = String(code || '')
    this.languageHint = normaliseLanguage(language)
    this.languageDetected = this.languageHint || DEFAULT_LANGUAGE
    this.filename = filename
    this.wrap = Boolean(wrap)
    this.showCopy = Boolean(showCopy)
    this.showLanguage = Boolean(showLanguage)
    this.showHeader = Boolean(showHeader || filename)

    this.element = document.createElement('figure')
    this.element.className = 'code-view'
    if (this.wrap) this.element.classList.add('code-view--wrap')

    this.element.dataset.language = this.languageDetected

    if (this.showHeader || this.showLanguage || this.showCopy) {
      this.headerEl = document.createElement('figcaption')
      this.headerEl.className = 'code-view__header'

      const left = document.createElement('div')
      left.className = 'code-view__header-left'
      this.headerEl.appendChild(left)

      if (this.filename) {
        this.titleEl = document.createElement('span')
        this.titleEl.className = 'code-view__title'
        this.titleEl.textContent = this.filename
        left.appendChild(this.titleEl)
      }

      if (this.showLanguage) {
        this.languageEl = document.createElement('span')
        this.languageEl.className = 'code-view__badge'
        this.languageEl.textContent = (this.languageDetected || DEFAULT_LANGUAGE).toUpperCase()
        left.appendChild(this.languageEl)
      }

      const right = document.createElement('div')
      right.className = 'code-view__header-right'
      this.headerEl.appendChild(right)

      if (this.showCopy) {
        this.copyBtn = document.createElement('button')
        this.copyBtn.type = 'button'
        this.copyBtn.className = 'code-view__copy'
        this.copyBtn.setAttribute('aria-label', 'Copy code to clipboard')
        this.copyBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
        right.appendChild(this.copyBtn)
      }

      this.element.appendChild(this.headerEl)
    }

    this.scroller = document.createElement('div')
    this.scroller.className = 'code-view__scroller'

    this.inner = document.createElement('div')
    this.inner.className = 'code-view__inner'

    this.gutter = document.createElement('ol')
    this.gutter.className = 'code-view__gutter'
    this.gutter.setAttribute('aria-hidden', 'true')

    this.pre = document.createElement('pre')
    this.pre.className = 'code-view__pre'
    this.codeEl = document.createElement('code')
    this.codeEl.className = 'hljs'
    this.pre.appendChild(this.codeEl)

    this.inner.appendChild(this.gutter)
    this.inner.appendChild(this.pre)
    this.scroller.appendChild(this.inner)
    this.element.appendChild(this.scroller)

    viewRegistry.set(this.element, this)
    ensureCopyHandler()
    this.render()
  }

  setCode(code, language) {
    this.code = String(code || '')
    if (language) this.languageHint = normaliseLanguage(language)
    this.languageDetected = this.languageHint || DEFAULT_LANGUAGE
    this.render()
  }

  setFilename(name) {
    this.filename = name || ''
    if (this.titleEl) {
      this.titleEl.textContent = this.filename
    } else if (this.filename && this.headerEl) {
      const left = this.headerEl.querySelector('.code-view__header-left')
      if (left) {
        this.titleEl = document.createElement('span')
        this.titleEl.className = 'code-view__title'
        this.titleEl.textContent = this.filename
        left.insertBefore(this.titleEl, left.firstChild)
      }
    }
  }

  setWrap(wrap) {
    this.wrap = Boolean(wrap)
    if (this.wrap) this.element.classList.add('code-view--wrap')
    else this.element.classList.remove('code-view--wrap')
  }

  updateLanguageBadge(lang) {
    const label = (lang || this.languageDetected || DEFAULT_LANGUAGE).toUpperCase()
    if (!this.languageEl) {
      if (this.showLanguage && this.headerEl) {
        this.languageEl = document.createElement('span')
        this.languageEl.className = 'code-view__badge'
        this.languageEl.textContent = label
        const left = this.headerEl.querySelector('.code-view__header-left')
        if (left) left.appendChild(this.languageEl)
      }
    } else {
      this.languageEl.textContent = label
    }
  }

  setGutterText(text) {
    const fragment = buildLineNumbers(text)
    this.gutter.innerHTML = ''
    this.gutter.appendChild(fragment)
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.code)
      this.element.classList.add('code-view--copied')
      setTimeout(() => this.element.classList.remove('code-view--copied'), 1200)
    } catch (err) {
      console.warn('Failed to copy code', err)
    }
  }

  render() {
    this.setGutterText(this.code)
    this.codeEl.textContent = this.code

    const initialLang = this.languageHint || DEFAULT_LANGUAGE
    this.languageDetected = initialLang
    this.updateLanguageBadge(initialLang)
    this.element.dataset.language = initialLang

    const token = Symbol('code-view-render')
    this.renderToken = token

    const immediate = typeof window !== 'undefined' ? window.hljs : null
    if (immediate?.highlight) applyHighlight(this, immediate, token)

    ensureHighlighter()
      .then((hljs) => {
        if (!hljs) return
        applyHighlight(this, hljs, token)
      })
      .catch((err) => {
        console.warn('Highlight initialization failed', err)
      })
  }
}
