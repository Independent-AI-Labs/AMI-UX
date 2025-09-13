# CMS Snippet Server

A tiny, dependency‑free server that renders `landing.html` exactly like a WordPress “Custom HTML” block. It decodes the Cocoa‑exported body (which contains entity‑encoded HTML+CSS) and serves the result without extra wrappers that could interfere with layout.

## Prerequisites
- Python 3.8+ (stdlib only; no third‑party packages required)

## Run
- From the repo root:

```
python3 cms/server.py
```

- Open the snippet at:
  - http://127.0.0.1:8000/ (raw block, no additional background)
  - http://127.0.0.1:8000/page (same content with a non‑interfering animated page background)
  - http://127.0.0.1:8000/healthz (health check)

## Live Reload (optional)
The server exposes an `ETag`‑style endpoint that returns the mtime of `landing.html`:
- http://127.0.0.1:8000/etag

To auto‑reload the page on content changes, you can add a small inline script anywhere in your snippet (or temporarily while authoring):

```
<script>
(function(){
  try {
    var seen = '';
    function tick(){
      fetch('/etag', { cache: 'no-store' })
        .then(r => r.text())
        .then(txt => {
          txt = (txt || '').trim();
          if (!seen) { seen = txt; }
          else if (txt && txt !== seen) { location.reload(); }
        })
        .catch(() => {})
        .finally(() => setTimeout(tick, 1000));
    }
    tick();
  } catch (e) {}
})();
</script>
```

This keeps authoring simple while ensuring the served content stays true to WordPress output.

## Notes
- The server reads `cms/landing.html` and decodes only the entity‑encoded body.
- No extra HTML shell is injected at `/` — browsers will implicitly create the minimal document structure when rendering the fragment.
- For a full page preview with a background that doesn’t interfere with the snippet, use `/page`.
