const TEXLIVE_DEPRECATION_MESSAGE =
  'In-browser TeX Live compilation is deprecated and no longer shipped with AMI UX.'

export class TexLiveDeprecatedError extends Error {
  constructor(message = TEXLIVE_DEPRECATION_MESSAGE) {
    super(message)
    this.name = 'TexLiveDeprecatedError'
  }
}

function createDeprecationError() {
  return new TexLiveDeprecatedError()
}

export class TexLiveCompiler {
  constructor() {
    throw createDeprecationError()
  }

  async ready() {
    throw createDeprecationError()
  }

  async call() {
    throw createDeprecationError()
  }

  async compile() {
    throw createDeprecationError()
  }

  async safeRead() {
    throw createDeprecationError()
  }

  dispose() {}
}

let sharedCompilerPromise = null

export function ensureTexLiveCompiler() {
  if (!sharedCompilerPromise) {
    sharedCompilerPromise = Promise.resolve().then(() => {
      throw createDeprecationError()
    })
  }
  return sharedCompilerPromise
}

export const texLiveDeprecationMessage = TEXLIVE_DEPRECATION_MESSAGE
