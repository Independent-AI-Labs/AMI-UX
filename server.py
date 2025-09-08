#!/usr/bin/env python3
"""
Minimal server that renders landing.html exactly like a WordPress Custom HTML block:
- Reads Cocoa-exported landing.html
- Extracts the visible text from <body> (which is entity-encoded HTML+CSS)
- Decodes entities and injects the resulting markup into a plain HTML shell
- Serves at /

No external deps. Uses stdlib only.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import re
import html
from pathlib import Path

ROOT = Path(__file__).parent
LANDING_PATH = ROOT / "landing.html"


def _extract_encoded_body_text(src: str) -> str:
    """Extract the entity-encoded snippet text from Cocoa-exported HTML body.

    Preserve raw content: remove only Cocoa wrapper tags (<p>, <span>) and keep
    all original character data untouched. Do NOT trim or normalize whitespace.
    """
    m = re.search(r"<body[^>]*>([\s\S]*?)</body>", src, flags=re.IGNORECASE)
    if not m:
        return ""
    body_html = m.group(1)

    # Drop only real Cocoa wrapper tags; leave everything else verbatim.
    # This will keep the entity-encoded snippet exactly as authored.
    text_only = re.sub(r"</?(?:p|span)(?:\s[^>]*)?>", "", body_html, flags=re.IGNORECASE)

    # Remove stray Cocoa <br> tags (not part of encoded content)
    text_only = re.sub(r"<br\s*/?>", "", text_only, flags=re.IGNORECASE)

    # Replace Cocoa-inserted non-breaking spaces with normal spaces.
    # U+00A0 at the start of CSS lines breaks CSS parsing if left intact.
    text_only = text_only.replace("\u00a0", " ")

    return text_only


def build_wp_like_document() -> bytes:
    """Return the decoded snippet bytes, unwrapped.

    This mirrors WP Custom HTML block insertion while avoiding any outer shell
    that could cause the browser to reparent/move nodes. Browsers will create
    implied <html><head><body> around this fragment at parse time.
    """
    raw = LANDING_PATH.read_text(encoding="utf-8")
    encoded = _extract_encoded_body_text(raw)
    decoded_snippet = html.unescape(encoded)
    return decoded_snippet.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (stdlib interface)
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            try:
                content = build_wp_like_document()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404, "landing.html not found")
            return

        if parsed.path == "/page":
            try:
                raw = LANDING_PATH.read_text(encoding="utf-8")
                encoded = _extract_encoded_body_text(raw)
                decoded_snippet = html.unescape(encoded)

                # Non-interfering background: fixed sibling behind content
                doc = f"""<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\"> 
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>landing snippet (with page background)</title>
    <style>
      html, body {{ margin: 0; padding: 0; background: #ffffff; }}
      .page-bg {{
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          radial-gradient(at 20% 30%, #d0d0d0 0, #c4c4c4 40%, transparent 65%),
          radial-gradient(at 80% 20%, #cecece 0, #c0c0c0 35%, transparent 60%),
          radial-gradient(at 30% 80%, #d2d2d2 0, #c5c5c5 40%, transparent 65%),
          radial-gradient(at 70% 70%, #cccccc 0, #bfbfbf 35%, transparent 60%),
          #d8d8d8;
        background-size: 200% 200%, 200% 200%, 200% 200%, 200% 200%, auto;
        animation: pageGradientShift 24s ease-in-out infinite alternate;
      }}
      @keyframes pageGradientShift {{
        0%   {{ background-position: 0% 0%,   100% 0%,  0% 100%, 100% 100%, 0 0; }}
        50%  {{ background-position: 50% 50%, 50% 0%,  50% 100%, 0% 50%,    0 0; }}
        100% {{ background-position: 100% 100%, 0% 100%, 100% 0%,  0% 0%,    0 0; }}
      }}
      #content {{ position: relative; z-index: 1; }}
    </style>
  </head>
  <body>
    <div class=\"page-bg\" aria-hidden=\"true\"></div>
    <div id=\"content\">{decoded_snippet}</div>
  </body>
</html>
""".encode("utf-8")

                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(doc)))
                self.end_headers()
                self.wfile.write(doc)
            except FileNotFoundError:
                self.send_error(404, "landing.html not found")
            return

        if parsed.path == "/healthz":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            body = b"ok\n"
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_error(404, "Not Found")


def main() -> None:
    port = 8000
    httpd = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving on http://127.0.0.1:{port}  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
