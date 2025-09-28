const DEFAULT_WORKER_PATH = '/vendor/texlive/pdftex-worker.js'
const DEFAULT_TOTAL_MEMORY = 192 * 1024 * 1024

function toUint8Array(binaryString) {
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i) & 0xff
  return bytes
}

function sanitizeTocText(raw) {
  if (!raw) return ''
  return raw
    .replace(/\\protect/g, '')
    .replace(/\\numberline\s*\{[^}]*\}/g, '')
    .replace(/\\IeC\s*\{[^}]*\}/g, '')
    .replace(/\\([^\s{}]+)(\s|$)/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTocEntries(tocRaw) {
  if (!tocRaw) return []
  const headings = []
  const pattern = /\\contentsline\s*\{([^}]+)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g
  let match
  while ((match = pattern.exec(tocRaw))) {
    const kind = match[1] || ''
    const body = match[2] || ''
    const page = match[3] || ''
    const numMatch = body.match(/\\numberline\s*\{([^}]*)\}/)
    const number = numMatch ? (numMatch[1] || '').trim() : ''
    const text = sanitizeTocText(body)
    if (!text) continue
    let level = 1
    if (kind.includes('subsubsection')) level = 3
    else if (kind.includes('subsection')) level = 2
    else if (kind.includes('paragraph')) level = 4
    headings.push({
      kind,
      level,
      number,
      text,
      page: Number.parseInt(page, 10) || null,
    })
  }
  return headings
}

function buildLatexErrorMessage(stderrLines, logRaw) {
  const parts = []
  if (Array.isArray(stderrLines) && stderrLines.length) {
    parts.push(stderrLines.join('\n'))
  }
  if (typeof logRaw === 'string' && logRaw.trim()) {
    const snippet = logRaw
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-20)
      .join('\n')
      .trim()
    if (snippet) parts.push(snippet)
  }
  const message = parts.join('\n\n').trim()
  return message || 'LaTeX compilation failed: PDF output was not produced.'
}

export class TexLiveCompiler {
  constructor(options = {}) {
    const { workerPath = DEFAULT_WORKER_PATH, totalMemory = DEFAULT_TOTAL_MEMORY } = options
    this.workerPath = workerPath
    this.totalMemory = totalMemory
    this.worker = new Worker(this.workerPath)
    this.pending = new Map()
    this.messageSeq = 1
    this.readyPromise = new Promise((resolve, reject) => {
      this._resolveReady = resolve
      this._rejectReady = reject
    })
    this.worker.addEventListener('message', (event) => this.handleMessage(event))
    this.worker.addEventListener('error', (error) => this.handleError(error))
    this.worker.addEventListener('messageerror', (error) => this.handleError(error))
    this.stdoutHandler = null
    this.stderrHandler = null
    this.lazyFsLoaded = false
    this.initialised = false
    this.closed = false
  }

  handleMessage(event) {
    if (this.closed) return
    let payload = null
    try {
      payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch (err) {
      if (this._rejectReady) this._rejectReady(err)
      return
    }
    if (!payload || typeof payload.command !== 'string') return
    const { command } = payload
    switch (command) {
      case 'ready':
        if (this._resolveReady) {
          this._resolveReady(true)
          this._resolveReady = null
          this._rejectReady = null
        }
        break
      case 'stdout':
        if (this.stdoutHandler && payload.contents != null) this.stdoutHandler(String(payload.contents))
        break
      case 'stderr':
        if (this.stderrHandler && payload.contents != null) this.stderrHandler(String(payload.contents))
        break
      case 'result':
      case 'success':
      case 'error': {
        const msgId = payload.msg_id
        if (!msgId) return
        const tracker = this.pending.get(msgId)
        if (!tracker) return
        this.pending.delete(msgId)
        if (command === 'error') tracker.reject(new Error(payload.message || 'texlive error'))
        else tracker.resolve(payload.result)
        break
      }
      default:
        break
    }
  }

  handleError(error) {
    if (this.closed) return
    if (this._rejectReady) {
      this._rejectReady(error)
      this._rejectReady = null
      this._resolveReady = null
    }
    const trackers = Array.from(this.pending.values())
    this.pending.clear()
    trackers.forEach((tracker) => {
      try {
        tracker.reject(error)
      } catch {}
    })
  }

  async ready() {
    return this.readyPromise
  }

  async call(command, ...args) {
    await this.ready()
    if (this.closed) throw new Error('texlive worker terminated')
    return new Promise((resolve, reject) => {
      const msgId = this.messageSeq++
      this.pending.set(msgId, { resolve, reject })
      const payload = { command, arguments: args, msg_id: msgId }
      try {
        this.worker.postMessage(JSON.stringify(payload))
      } catch (err) {
        this.pending.delete(msgId)
        reject(err)
      }
    })
  }

  async ensureReadyFs() {
    if (!this.lazyFsLoaded) {
      await this.call('set_TOTAL_MEMORY', this.totalMemory)
      await this.call('FS_createLazyFilesFromList', '/', 'texlive.lst', './texlive', true, true)
      this.lazyFsLoaded = true
    }
  }

  async compile(source, options = {}) {
    const texSource = typeof source === 'string' ? source : String(source || '')
    await this.ensureReadyFs()
    if (this.initialised) {
      try {
        await this.call('FS_unlink', '/input.tex')
      } catch {}
      try {
        await this.call('FS_unlink', '/input.pdf')
      } catch {}
      try {
        await this.call('FS_unlink', '/input.log')
      } catch {}
      try {
        await this.call('FS_unlink', '/input.toc')
      } catch {}
    }
    await this.call('FS_createDataFile', '/', 'input.tex', texSource, true, true)
    this.initialised = true

    const out = []
    const err = []
    const prevStdout = this.stdoutHandler
    const prevStderr = this.stderrHandler
    this.stdoutHandler = (line) => {
      out.push(String(line || ''))
      if (prevStdout) prevStdout(line)
    }
    this.stderrHandler = (line) => {
      err.push(String(line || ''))
      if (prevStderr) prevStderr(line)
    }

    const args = Array.isArray(options.args) && options.args.length
      ? options.args
      : ['-interaction=nonstopmode', '-halt-on-error', '-output-format', 'pdf', 'input.tex']

    try {
      await this.call('run', ...args)
      const firstLog = await this.safeRead('/input.log')
      const needsRerun = /Rerun to get cross-references right\./i.test(firstLog) ||
        /undefined references/i.test(firstLog) ||
        /Label\(s\) may have changed/i.test(firstLog)
      if (needsRerun) await this.call('run', ...args)
    } finally {
      this.stdoutHandler = prevStdout
      this.stderrHandler = prevStderr
    }

    const logRaw = await this.safeRead('/input.log')
    const tocRaw = await this.safeRead('/input.toc')
    const auxRaw = await this.safeRead('/input.aux')
    const pdfBinaryRaw = await this.safeRead('/input.pdf')

    if (!pdfBinaryRaw) {
      const errMessage = buildLatexErrorMessage(err, logRaw)
      const compileError = new Error(errMessage)
      compileError.name = 'TexLiveCompileError'
      compileError.log = logRaw
      compileError.stderr = err
      compileError.stdout = out
      throw compileError
    }

    return {
      pdfBytes: toUint8Array(pdfBinaryRaw || ''),
      toc: parseTocEntries(tocRaw || ''),
      log: logRaw || '',
      aux: auxRaw || '',
      stdout: out,
      stderr: err,
    }
  }

  async safeRead(path) {
    try {
      return await this.call('FS_readFile', path)
    } catch {
      return ''
    }
  }

  dispose() {
    if (this.closed) return
    this.closed = true
    try {
      this.worker.terminate()
    } catch {}
    this.pending.clear()
  }
}

let sharedCompilerPromise = null

export function ensureTexLiveCompiler(options = {}) {
  if (!sharedCompilerPromise) {
    const compiler = new TexLiveCompiler(options)
    sharedCompilerPromise = compiler.ready().then(() => compiler)
  }
  return sharedCompilerPromise
}
