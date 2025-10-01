const tokenColors = [
  {
    scope: [
      'comment',
      'comment.block.documentation',
      'punctuation.definition.comment',
    ],
    settings: {
      foreground: 'var(--code-comment)',
      fontStyle: 'italic',
    },
  },
  {
    scope: [
      'keyword',
      'keyword.operator.new',
      'keyword.operator.expression',
      'keyword.control',
      'storage',
      'storage.type',
      'storage.modifier',
      'entity.name.tag',
      'support.type',
      'support.class',
      'support.constant.dom',
    ],
    settings: {
      foreground: 'var(--code-keyword)',
    },
  },
  {
    scope: [
      'string',
      'string.regexp',
      'string.template',
      'string.other',
      'constant.character.escape',
      'constant.other.symbol',
      'entity.other.attribute-name',
      'punctuation.definition.string',
    ],
    settings: {
      foreground: 'var(--code-string)',
    },
  },
  {
    scope: [
      'constant.numeric',
      'constant.language',
      'constant.other',
      'variable.other.constant',
      'support.constant.math',
      'keyword.operator',
    ],
    settings: {
      foreground: 'var(--code-number)',
    },
  },
  {
    scope: [
      'entity.name.function',
      'meta.function-call',
      'meta.function',
      'support.function',
      'support.variable',
      'variable.function',
      'meta.function-call entity.name.function',
      'entity.name.method',
    ],
    settings: {
      foreground: 'var(--code-function)',
    },
  },
  {
    scope: [
      'meta',
      'meta.preprocessor',
      'meta.tag',
      'meta.attribute',
      'meta.selector',
      'source meta.brace',
      'punctuation.definition.tag',
      'punctuation.separator.namespace',
    ],
    settings: {
      foreground: 'var(--code-meta)',
    },
  },
  {
    scope: [
      'markup.inserted',
      'markup.inserted.git_gutter',
    ],
    settings: {
      foreground: 'var(--code-insert)',
    },
  },
  {
    scope: [
      'markup.deleted',
      'markup.deleted.git_gutter',
      'punctuation.definition.deleted',
    ],
    settings: {
      foreground: 'var(--code-delete)',
    },
  },
  {
    scope: [
      'markup.bold',
      'markup.bold.markdown',
      'markup.bold punctuation.definition.bold',
    ],
    settings: {
      fontStyle: 'bold',
    },
  },
  {
    scope: [
      'markup.italic',
      'markup.italic.markdown',
      'markup.italic punctuation.definition.italic',
    ],
    settings: {
      fontStyle: 'italic',
    },
  },
]

function createTheme({ name, type }) {
  return {
    name,
    type,
    colors: {
      'editor.background': 'transparent',
      'editor.foreground': 'var(--text)',
      'editorLineNumber.foreground': 'var(--code-comment)',
      'editor.selectionBackground': 'color-mix(in oklab, var(--accent) 20%, transparent)',
    },
    tokenColors,
  }
}

export const amiDarkTheme = createTheme({ name: 'ami-dark', type: 'dark' })
export const amiLightTheme = createTheme({ name: 'ami-light', type: 'light' })

export const THEME_DEFINITIONS = {
  'ami-dark': amiDarkTheme,
  'ami-light': amiLightTheme,
}

export const DEFAULT_THEME = 'ami-dark'
