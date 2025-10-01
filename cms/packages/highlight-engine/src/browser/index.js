import { getSingletonHighlighter } from 'shiki/dist/bundle-full.mjs'
import { amiDarkTheme, amiLightTheme, THEME_DEFINITIONS, DEFAULT_THEME } from './themes.js'
import { SHIKI_LANGUAGE_IDS, DEFAULT_LANGUAGE, resolveLanguageId } from './languages.js'

const FONT_STYLE = {
  italic: 1,
  bold: 2,
  underline: 4,
}

const THEME_LOOKUP = {
  'ami-dark': amiDarkTheme,
  'ami-light': amiLightTheme,
}

let highlighterPromise = null

function resolveThemeId(input) {
  if (!input) return DEFAULT_THEME
  const key = String(input).trim().toLowerCase()
  if (THEME_DEFINITIONS[key]) return key
  return DEFAULT_THEME
}

async function ensureHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      themes: Object.values(THEME_LOOKUP),
      langs: SHIKI_LANGUAGE_IDS,
    })
  }
  return highlighterPromise
}

function cloneToken(token) {
  return {
    content: token.content ?? '',
    color: token.color ?? null,
    fontStyle: typeof token.fontStyle === 'number' ? token.fontStyle : 0,
    offset: typeof token.offset === 'number' ? token.offset : 0,
  }
}

export async function highlightText({ code = '', language, theme } = {}) {
  const highlighter = await ensureHighlighter()
  const resolvedTheme = resolveThemeId(theme)
  const resolvedLanguage = resolveLanguageId(language)

  let output
  try {
    output = highlighter.codeToTokens(code, { lang: resolvedLanguage, theme: resolvedTheme })
  } catch (err) {
    if (resolvedLanguage !== DEFAULT_LANGUAGE) {
      output = highlighter.codeToTokens(code, { lang: DEFAULT_LANGUAGE, theme: resolvedTheme })
    } else {
      throw err
    }
  }

  const lines = output.tokens.map((line) => line.map(cloneToken))

  return {
    language: resolvedLanguage,
    theme: resolvedTheme,
    lines,
    foreground: output.fg ?? 'var(--text)',
    background: output.bg ?? 'transparent',
  }
}

export function getSupportedThemes() {
  return Object.keys(THEME_DEFINITIONS)
}

export function getSupportedLanguageIds() {
  return SHIKI_LANGUAGE_IDS.slice()
}

export { FONT_STYLE }
