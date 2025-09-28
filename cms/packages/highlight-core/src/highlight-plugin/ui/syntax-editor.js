import { ensureHighlighter } from '../../lib/code-view.js'

function normalise(value) {
  if (value == null) return ''
  return String(value)
}

function applyHighlight(codeEl, text, language) {
  if (!codeEl) return
  const safe = normalise(text)
  codeEl.parentElement?.parentElement?.setAttribute('data-empty', safe ? 'false' : 'true')
  if (!safe) {
    codeEl.innerHTML = '&nbsp;'
    return
  }
  const hljs = typeof window !== 'undefined' ? window.hljs : null
  if (hljs?.highlight) {
    try {
      const result = hljs.highlight(safe, { language })
      codeEl.innerHTML = result.value || '&nbsp;'
      return
    } catch (error) {
      console.warn('Syntax highlight failed', error)
    }
  }
  codeEl.textContent = safe
}

function ensureLineNumbers(gutterEl, text, minLines = 1) {
  if (!gutterEl) return
  const content = normalise(text)
  const requestedLines = content ? content.split(/\r?\n|\r/g).length : 1
  const minimum = minLines > 0 ? minLines : 1
  const lineTotal = Math.max(minimum, requestedLines, 1)

  if (gutterEl.childElementCount === lineTotal) {
    let index = 1
    let differs = false
    for (const child of gutterEl.children) {
      if (child.textContent !== String(index)) {
        differs = true
        break
      }
      index += 1
    }
    if (!differs) return
  }

  while (gutterEl.firstChild) gutterEl.removeChild(gutterEl.firstChild)
  const ownerDocument = gutterEl.ownerDocument || (typeof document !== 'undefined' ? document : null)
  for (let i = 1; i <= lineTotal; i += 1) {
    const lineEl = ownerDocument ? ownerDocument.createElement('span') : null
    if (lineEl) {
      lineEl.textContent = String(i)
      gutterEl.appendChild(lineEl)
    }
  }
}

function scheduleHighlight(codeEl, text, language, gutterEl, minLines) {
  applyHighlight(codeEl, text, language)
  ensureLineNumbers(gutterEl, text, minLines)
  ensureHighlighter()
    .then((hljs) => {
      if (!hljs) return
      applyHighlight(codeEl, text, language)
      ensureLineNumbers(gutterEl, text, minLines)
    })
    .catch((error) => console.warn('Syntax highlighter init failed', error))
}

function syncScroll(surface, gutter) {
  if (!surface) return
  const textarea = surface.querySelector('textarea')
  const highlight = surface.querySelector('pre')
  if (!textarea || !highlight) return
  const sync = () => {
    const offsetX = textarea.scrollLeft
    const offsetY = textarea.scrollTop
    highlight.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`
    if (gutter) gutter.style.transform = `translateY(${-offsetY}px)`
  }
  sync()
  textarea.addEventListener('scroll', sync)
  return () => textarea.removeEventListener('scroll', sync)
}

export function createSyntaxEditorToolkit(React) {
  const { useRef, useEffect, useCallback } = React
  const h = React.createElement

  function SyntaxEditor({
    value = '',
    onChange,
    language = 'javascript',
    placeholder = '',
    disabled = false,
    name,
    autoFocus = false,
    minLines = 8,
  }) {
    const wrapperRef = useRef(null)
    const surfaceRef = useRef(null)
    const textareaRef = useRef(null)
    const codeRef = useRef(null)
    const gutterRef = useRef(null)
    const destroyScrollRef = useRef(null)

    const handleChange = useCallback(
      (event) => {
        const next = normalise(event.target.value)
        scheduleHighlight(codeRef.current, next, language, gutterRef.current, minLines)
        if (typeof onChange === 'function') onChange(next)
      },
      [onChange, language, minLines],
    )

    useEffect(() => {
      const surface = surfaceRef.current
      if (!surface) return () => {}
      destroyScrollRef.current?.()
      destroyScrollRef.current = syncScroll(surface, gutterRef.current)
      return () => {
        destroyScrollRef.current?.()
        destroyScrollRef.current = null
      }
    }, [])

    useEffect(() => {
      const text = normalise(value)
      scheduleHighlight(codeRef.current, text, language, gutterRef.current, minLines)
      const wrapper = wrapperRef.current
      if (wrapper) {
        wrapper.dataset.language = language
        if (placeholder) wrapper.dataset.placeholder = placeholder
        else delete wrapper.dataset.placeholder
        wrapper.dataset.empty = text ? 'false' : 'true'
        const lines = minLines > 0 ? minLines : 8
        wrapper.style.setProperty('--syntax-editor-min-lines', String(lines))
        wrapper.style.setProperty('--syntax-editor-height', `${(lines * 1.55).toFixed(2)}em`)
      }
      if (textareaRef.current && textareaRef.current.value !== text) {
        textareaRef.current.value = text
      }
    }, [value, language, placeholder, minLines])

    useEffect(() => {
      if (autoFocus && textareaRef.current) textareaRef.current.focus()
    }, [autoFocus])

    useEffect(() => {
      if (textareaRef.current) textareaRef.current.disabled = !!disabled
      const wrapper = wrapperRef.current
      if (wrapper) wrapper.dataset.disabled = disabled ? 'true' : 'false'
    }, [disabled])

    return h(
      'div',
      {
        ref: wrapperRef,
        className: 'syntax-editor',
        'data-placeholder': placeholder || undefined,
        'data-language': language,
        'data-empty': value ? 'false' : 'true',
        'data-disabled': disabled ? 'true' : 'false',
      },
      h('div', { className: 'syntax-editor__gutter', ref: gutterRef, 'aria-hidden': 'true' }),
      h(
        'div',
        { className: 'syntax-editor__surface', ref: surfaceRef },
        h('pre', { className: 'syntax-editor__highlight' }, h('code', { ref: codeRef }, '')),
        h('textarea', {
          ref: textareaRef,
          className: 'syntax-editor__textarea-base',
          defaultValue: normalise(value),
          spellCheck: false,
          onChange: handleChange,
          disabled,
          name,
          autoFocus,
        }),
      ),
    )
  }

  return { SyntaxEditor }
}
