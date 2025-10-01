import { bundledLanguagesInfo } from 'shiki/dist/bundle-full.mjs'

export const DEFAULT_LANGUAGE = 'plaintext'

const LANGUAGE_ALIAS_MAP = (() => {
  const entries = new Map()
  for (const info of bundledLanguagesInfo) {
    if (!info?.id) continue
    const id = String(info.id).toLowerCase()
    entries.set(id, info.id)
    if (Array.isArray(info.aliases)) {
      for (const alias of info.aliases) {
        const key = String(alias).toLowerCase()
        if (!key) continue
        if (!entries.has(key)) entries.set(key, info.id)
      }
    }
  }
  // Manual aliases for common extensions not covered upstream
  entries.set('proto', entries.get('proto') ?? 'proto')
  entries.set('protobuf', entries.get('protobuf') ?? 'proto')
  entries.set('dockerfile', entries.get('dockerfile') ?? 'docker')
  entries.set('terraform', entries.get('terraform') ?? 'terraform')
  entries.set('tf', entries.get('tf') ?? 'terraform')
  entries.set('dotenv', entries.get('dotenv') ?? 'dotenv')
  entries.set('env', entries.get('env') ?? 'dotenv')
  entries.set('plaintext', DEFAULT_LANGUAGE)
  entries.set('plain', DEFAULT_LANGUAGE)
  entries.set('text', DEFAULT_LANGUAGE)
  entries.set('txt', DEFAULT_LANGUAGE)
  entries.set('shell', entries.get('shell') ?? 'shellscript')
  entries.set('bash', entries.get('bash') ?? 'shellscript')
  entries.set('sh', entries.get('sh') ?? 'shellscript')
  entries.set('zsh', entries.get('zsh') ?? 'shellscript')
  entries.set('shellscript', entries.get('shellscript') ?? 'shellscript')
  entries.set('console', entries.get('console') ?? 'shellsession')
  entries.set('powershell', entries.get('powershell') ?? 'powershell')
  entries.set('ps', entries.get('ps') ?? 'powershell')
  entries.set('ps1', entries.get('ps1') ?? 'powershell')
  return entries
})()

export function resolveLanguageId(input) {
  if (!input) return DEFAULT_LANGUAGE
  const key = String(input).trim().toLowerCase()
  if (!key) return DEFAULT_LANGUAGE
  if (LANGUAGE_ALIAS_MAP.has(key)) return LANGUAGE_ALIAS_MAP.get(key)
  // Attempt to strip common prefixes like "language-" from Prism-style class names
  if (key.startsWith('language-')) {
    const stripped = key.slice('language-'.length)
    if (LANGUAGE_ALIAS_MAP.has(stripped)) return LANGUAGE_ALIAS_MAP.get(stripped)
  }
  // Allow dotted extensions (".tsx")
  if (key.startsWith('.')) {
    const stripped = key.slice(1)
    if (LANGUAGE_ALIAS_MAP.has(stripped)) return LANGUAGE_ALIAS_MAP.get(stripped)
  }
  return DEFAULT_LANGUAGE
}

const PRIMARY_LANGUAGE_INPUTS = [
  'bash',
  'shell',
  'shellscript',
  'shellsession',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'markdown',
  'md',
  'html',
  'xml',
  'svg',
  'css',
  'scss',
  'less',
  'c',
  'cpp',
  'csharp',
  'cs',
  'java',
  'kotlin',
  'swift',
  'go',
  'rust',
  'python',
  'py',
  'ruby',
  'rb',
  'php',
  'sql',
  'postgresql',
  'psql',
  'powershell',
  'dockerfile',
  'makefile',
  'diff',
  'graphql',
  'proto',
  'protobuf',
  'plaintext',
  'text',
  'hcl',
  'terraform',
]

export const SHIKI_LANGUAGE_IDS = Array.from(
  new Set(PRIMARY_LANGUAGE_INPUTS.map((name) => resolveLanguageId(name))),
)
