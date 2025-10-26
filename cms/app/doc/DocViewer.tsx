'use client'

import { useEffect } from 'react'

interface DocViewerProps {
  searchParams: {
    embed?: string
    rootKey?: string
    path?: string
    label?: string
    focus?: string
    mode?: string
  }
}

interface WindowWithDocViewer extends Window {
  __CMS_BOOT_OPTIONS__?: {
    rootKey?: string
    path?: string
    label?: string | null
    focusPath?: string
    fileOnly?: boolean
  }
  __AMI_HIGHLIGHT_CONFIG__?: {
    assetBase?: string
    engineMode?: string
    [key: string]: unknown
  }
  __AMI_HIGHLIGHT_ASSET_ROOT__?: string
}

declare const window: WindowWithDocViewer

/**
 * DocViewer component that renders an embedded documentation viewer.
 * Handles dynamic script loading, theme initialization, and highlight plugin configuration.
 */
export default function DocViewer({ searchParams }: DocViewerProps) {
  const isEmbed = searchParams.embed === '1'
  const requestedMode = searchParams.mode || ''
  const rootKey = searchParams.rootKey || ''
  const path = searchParams.path || ''
  const label = searchParams.label || null
  const focus = searchParams.focus || ''

  useEffect(() => {
    const loadedScripts: HTMLScriptElement[] = []
    const loadedLinks: HTMLLinkElement[] = []

    /**
     * Loads a stylesheet if not already present in the document.
     */
    const loadStylesheet = (href: string) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        document.head.appendChild(link)
        loadedLinks.push(link)
      }
    }

    /**
     * Loads a script if not already present in the document.
     */
    const loadScript = (src: string, type?: string) => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script')
        script.src = src
        if (type) script.type = type
        if (type === 'module') script.async = true
        document.body.appendChild(script)
        loadedScripts.push(script)
      }
    }

    loadStylesheet('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap')
    loadStylesheet('https://cdn.jsdelivr.net/npm/remixicon@4.3.0/fonts/remixicon.css')
    loadStylesheet('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css')
    loadStylesheet('/styles/shared.css?v=20251003e')

    loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js')
    loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js')
    loadScript('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js')
    loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js')
    loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js')
    loadScript('/js/highlight-plugin/bootstrap.js?v=20250310', 'module')
    loadScript('/js/doc.js?v=20251004', 'module')

    document.body.classList.add('doc-viewer')

    // Initialize boot options with all required parameters
    const boot = window.__CMS_BOOT_OPTIONS__ || {}
    if (rootKey) boot.rootKey = rootKey
    if (path) boot.path = path
    if (label) boot.label = label
    if (focus) boot.focusPath = focus
    if (requestedMode === 'file') boot.fileOnly = true
    window.__CMS_BOOT_OPTIONS__ = boot

    // Theme initialization
    try {
      const theme = localStorage.getItem('theme')
      if (theme) {
        document.documentElement.setAttribute('data-theme', theme)
      }
      document.documentElement.classList.add('fx-glow')
    } catch (error) {
      console.warn('Failed to initialize theme from localStorage:', error)
    }

    // Highlight plugin configuration
    try {
      const existingCfg = window.__AMI_HIGHLIGHT_CONFIG__
      const cfg = existingCfg && typeof existingCfg === 'object' ? { ...existingCfg } : {}
      if (!cfg.assetBase) {
        const explicitRoot = typeof window.__AMI_HIGHLIGHT_ASSET_ROOT__ === 'string'
          ? window.__AMI_HIGHLIGHT_ASSET_ROOT__
          : null
        if (explicitRoot) {
          cfg.assetBase = explicitRoot
        } else {
          try {
            const base = new URL('.', window.location.href)
            cfg.assetBase = base.toString()
          } catch {
            cfg.assetBase = '/'
          }
        }
      }
      if (!cfg.engineMode) cfg.engineMode = 'shiki'
      window.__AMI_HIGHLIGHT_CONFIG__ = cfg
    } catch (error) {
      console.warn('Failed to configure highlight plugin:', error)
    }

    // Apply embed/file-only styles
    if (isEmbed) {
      document.documentElement.classList.add('embed')
      const root = document.documentElement
      root.style.setProperty('--doc-header-height', '0px')
    }

    if (boot.fileOnly) {
      document.documentElement.classList.add('file-only')
      const root = document.documentElement
      root.style.setProperty('--doc-header-height', '0px')
    }

    return () => {
      document.body.classList.remove('doc-viewer')
      document.documentElement.classList.remove('embed', 'file-only', 'fx-glow')

      // Cleanup dynamically loaded scripts
      loadedScripts.forEach((script) => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      })
    }
  }, [isEmbed, requestedMode, rootKey, path, label, focus])

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --doc-toc-width: 17.5rem;
          --doc-header-height: 4rem;
        }
        body.doc-viewer {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        body.doc-viewer > header {
          flex: 0 0 auto;
        }
        body.doc-viewer > main {
          flex: 1 1 auto;
        }
        body.doc-viewer main {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(240px, var(--doc-toc-width)) 1fr;
          align-items: stretch;
        }
        body.doc-viewer main > nav {
          position: sticky;
          top: var(--doc-header-height);
          height: calc(100vh - var(--doc-header-height));
          overflow: auto;
          border-right: 1px solid var(--border);
          background: var(--panel);
        }
        body.doc-viewer main > section#content {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          padding: 1rem 1.5rem;
        }
        nav .toc {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.25rem 1rem 2rem;
          font-size: 0.8125rem;
        }
        nav .toc h3 {
          margin: 0;
          padding: 0 0.25rem;
          font-size: 0.75rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        nav .toc .structure-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        nav .toc .structure-nav a {
          display: block;
          padding: 0.375rem 0.5rem 0.375rem var(--struct-indent, 2.25rem);
          border-radius: 6px;
          color: var(--muted);
          transition: color 0.2s var(--easing-standard), background 0.2s var(--easing-standard);
        }
        nav .toc .structure-nav a:hover {
          background: color-mix(in oklab, var(--panel) 65%, transparent);
          color: var(--text);
        }
        nav .toc .structure-nav a.is-active {
          color: var(--accent);
          font-weight: 600;
        }
        nav .toc .structure-nav details summary {
          position: relative;
          padding: 0.375rem 0.5rem 0.375rem var(--struct-indent, 2.25rem);
          border: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: var(--muted);
          border-radius: 6px;
          transition: color 0.2s var(--easing-standard), background 0.2s var(--easing-standard);
          cursor: pointer;
        }
        nav .toc .structure-nav details summary:hover {
          background: color-mix(in oklab, var(--panel) 65%, transparent);
          color: var(--text);
        }
        nav .toc .structure-nav details summary.is-active {
          color: var(--accent);
        }
        nav .toc .structure-nav details summary a {
          flex: 1;
          min-width: 0;
          color: inherit;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
        }
        nav .toc .structure-nav details summary .struct-toggle {
          position: absolute;
          left: var(--struct-toggle-offset, 12px);
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 12px;
          pointer-events: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        nav .toc .structure-nav details summary .struct-toggle::before,
        nav .toc .structure-nav details summary .struct-toggle::after {
          content: '';
          position: absolute;
          background: currentColor;
          transition: opacity 0.2s ease;
        }
        nav .toc .structure-nav details summary .struct-toggle::before {
          width: 100%;
          height: 2px;
          border-radius: 1px;
        }
        nav .toc .structure-nav details summary .struct-toggle::after {
          height: 100%;
          width: 2px;
          border-radius: 1px;
        }
        nav .toc .structure-nav details[open] summary .struct-toggle::after {
          opacity: 0;
        }
        nav .toc .structure-nav details > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-left: 0.75rem;
        }
        nav .toc .toc-headings {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        nav .toc .toc-headings a {
          display: block;
          padding: 0.375rem 0.5rem;
          border-radius: 6px;
          color: var(--muted);
          transition: color 0.2s var(--easing-standard), background 0.2s var(--easing-standard);
        }
        nav .toc .toc-headings a:hover {
          background: color-mix(in oklab, var(--panel) 65%, transparent);
          color: var(--text);
        }
        .dir,
        .file {
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          background: var(--panel);
          margin: 8px 0;
        }
        details {
          padding: 0;
        }
        summary {
          list-style: none;
          cursor: pointer;
          padding: 0.625rem 0.75rem;
          border-bottom: 1px solid var(--border);
          font-weight: 600;
        }
        summary::marker,
        summary::-webkit-details-marker {
          display: none;
        }
        summary .meta {
          color: var(--muted);
          font-weight: 400;
          margin-left: 0.5rem;
        }
        section#content summary {
          color: var(--muted);
          transition: color 0.2s ease;
        }
        section#content summary.is-visible {
          color: var(--accent);
        }
        .indent {
          display: inline-block;
          width: calc(var(--depth, 0) * 1rem);
        }
        .body {
          padding: 0.75rem 1rem;
          background: var(--bg);
        }
        .md h1,
        .md h2,
        .md h3,
        .md h4,
        .html-document h1,
        .html-document h2,
        .html-document h3,
        .html-document h4 {
          scroll-margin-top: 4.375rem;
        }
        .md pre,
        .html-document pre {
          background: var(--code-bg);
          padding: 0.75rem;
          border-radius: 6px;
          overflow: auto;
        }
        .md code,
        .html-document code {
          background: var(--code-bg);
          padding: 2px 0.25rem;
          border-radius: 4px;
        }
        .html-document {
          position: relative;
          width: 100%;
          overflow-x: auto;
        }
        .html-document img,
        .html-document video,
        .html-document canvas,
        .html-document svg,
        .html-document iframe {
          max-width: 100%;
        }
        .muted {
          color: var(--muted);
        }
        .anchor {
          visibility: hidden;
          margin-left: 0.375rem;
          font-size: 0.75rem;
        }
        .md h1:hover .anchor,
        .md h2:hover .anchor,
        .md h3:hover .anchor,
        .html-document h1:hover .anchor,
        .html-document h2:hover .anchor,
        .html-document h3:hover .anchor {
          visibility: visible;
        }
        .hidden {
          display: none !important;
        }

        .embed body.doc-viewer > header {
          display: none !important;
        }
        .embed body.doc-viewer main {
          min-height: 100vh;
        }
        .embed body.doc-viewer main > nav {
          top: 0;
          height: 100vh;
        }

        .file-only body.doc-viewer > header {
          display: none !important;
        }
        .file-only body.doc-viewer main {
          grid-template-columns: 1fr;
          min-height: 100vh;
        }
        .file-only body.doc-viewer main > nav {
          display: none !important;
        }
        .file-only body.doc-viewer main > section#content {
          padding: clamp(1.5rem, 6vw, 5.25rem);
        }

        @media (max-width: 60rem) {
          body.doc-viewer main {
            grid-template-columns: 1fr;
          }
          body.doc-viewer main > nav {
            display: none;
          }
        }
        @media print {
          body.doc-viewer main {
            grid-template-columns: 1fr;
          }
          .file,
          .dir,
          summary {
            border: none;
          }
        }
      `}} />

      <header data-ami-highlight-exclude="1">
        <h1 id="appTitle">Docs</h1>
        <input id="search" type="search" placeholder="Search files and headings (/)" />
        <button
          className="icon-button"
          id="themeToggle"
          data-hint="Toggle Theme"
          aria-label="Toggle Theme"
          data-ami-highlight-exclude="1"
        >
          <svg
            id="iconThemeDoc"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
        <span className="muted" id="docRootLabel" data-hint="Current doc root"></span>
        <button
          className="icon-button"
          id="printBtn"
          data-hint="Print"
          aria-label="Print"
          data-ami-highlight-exclude="1"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8" rx="2"></rect>
          </svg>
        </button>
      </header>
      <main>
        <nav>
          <div className="toc" id="toc"></div>
        </nav>
        <section id="content"></section>
      </main>

    </>
  )
}
