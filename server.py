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
    """Build a minimal HTML doc that wraps the decoded snippet.

    Adds a neutral wrapper with an animated light-gray multipoint gradient
    background, without altering the snippet markup itself.
    """
    raw = LANDING_PATH.read_text(encoding="utf-8")
    encoded = _extract_encoded_body_text(raw)
    decoded_snippet = html.unescape(encoded)

    doc = f"""<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\"> 
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>landing snippet</title>
    <style>
      html, body {{ margin: 0; padding: 0; background: #ffffff; }}
      /* Animated light-gray multipoint gradient background */
      .iail-bg-anim {{
        min-height: 100vh;
        background:
          radial-gradient(at 20% 30%, #e9e9e9 0, #e2e2e2 40%, transparent 65%),
          radial-gradient(at 80% 20%, #e7e7e7 0, #dfdfdf 35%, transparent 60%),
          radial-gradient(at 30% 80%, #ebebeb 0, #e3e3e3 40%, transparent 65%),
          radial-gradient(at 70% 70%, #e6e6e6 0, #dddddd 35%, transparent 60%),
          #f6f6f6;
        background-size: 200% 200%, 200% 200%, 200% 200%, 200% 200%, auto;
        animation: iailGradientShift 24s ease-in-out infinite alternate;
      }}

      @keyframes iailGradientShift {{
        0% {{
          background-position:
            0% 0%, 100% 0%, 0% 100%, 100% 100%, 0 0;
        }}
        50% {{
          background-position:
            50% 50%, 50% 0%, 50% 100%, 0% 50%, 0 0;
        }}
        100% {{
          background-position:
            100% 100%, 0% 100%, 100% 0%, 0% 0%, 0 0;
        }}
      }}
    </style>
  </head>
  <body>
    <div class=\"iail-wrapper iail-bg-anim\">
      {decoded_snippet}
    </div>
  </body>
</html>
"""
    return doc.encode("utf-8")


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
