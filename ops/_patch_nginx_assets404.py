#!/usr/bin/env python3
from pathlib import Path

p = Path("/etc/nginx/sites-enabled/chainlords-play")
text = p.read_text()
if "@assets_missing" in text:
    print("already_patched")
    raise SystemExit(0)

start = text.find("    location ^~ /assets/ {")
if start < 0:
    print("not_found")
    raise SystemExit(1)

end = text.find("    location ^~ /.well-known/", start)
if end < 0:
    print("end_not_found")
    raise SystemExit(1)

new_block = """    location ^~ /assets/ {
        # Short positive TTL; hashed filenames change on each build.
        # Missing files: named location returns 404 with no-store (avoid CF 404 poison).
        add_header Cache-Control "public, max-age=120, must-revalidate" always;
        add_header X-Content-Type-Options nosniff always;
        add_header Cloudflare-CDN-Cache-Control "max-age=120" always;
        try_files $uri @assets_missing;
    }

    location @assets_missing {
        internal;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Cloudflare-CDN-Cache-Control "no-store" always;
        add_header Pragma "no-cache" always;
        return 404;
    }

"""

p.write_text(text[:start] + new_block + text[end:])
print("patched")
