# AMI Highlight Tools Extension

This Chrome-compatible extension packages the CMS highlight manager as a standalone plugin.

## Install (Unpacked)

1. Run `npm install` in `ux/cms` if you have not already; this ensures Node scripts can run.
2. In Chrome (or any Chromium-based browser), open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and choose `ux/cms/extension/highlight-plugin`.
4. Visit any page; a floating highlight button appears in the top-right corner. Use it to open the settings dialog and toggle highlight targets.

## Development Notes

- Run `node scripts/sync-highlight-extension.mjs` after changing any highlight-related module (`public/js/highlight/*.js`, `dialog-service.js`, etc.) to copy updates into the extension bundle.
- Default selectors target headings, paragraphs, code, tables, and navigation links. Add `data-highlight-*="1"` attributes in the page to opt elements into specific highlight buckets.
- Trigger a manual refresh from the console with `window.__AMI_HIGHLIGHT_PLUGIN__.refresh()`.
- The content script observes DOM mutations and rebuilds highlight regions without requiring a page reload.
