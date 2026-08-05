#!/usr/bin/env python3
import urllib.request

for url in ("http://127.0.0.1/", "http://127.0.0.1/assets/index-jq_aHoLD.js"):
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=10) as r:
            print("URL", url, "status", r.status)
            for k, v in r.headers.items():
                print(f"  {k}: {v}")
    except Exception as e:
        print("URL", url, "ERR", e)
    print("---")

# Also GET body size and first bytes of HTML
with urllib.request.urlopen("http://127.0.0.1/", timeout=10) as r:
    body = r.read()
    print("GET / len", len(body))
    print(body[:200])
