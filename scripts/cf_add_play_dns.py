#!/usr/bin/env python3
"""
Add play.chainlords.net → Hetzner VPS in Cloudflare DNS.

Usage (PowerShell):
  $env:CLOUDFLARE_API_TOKEN = "tu-token-dns-edit"
  python scripts/cf_add_play_dns.py

Token: Cloudflare → My Profile → API Tokens → Create Token
  Permissions: Zone → DNS → Edit, Zone → Zone → Read
  Zone Resources: Include → Specific zone → chainlords.net

Default: proxied=True (orange cloud) so browsers get free HTTPS immediately
via Cloudflare Universal SSL even before Let's Encrypt on origin.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

DOMAIN = "chainlords.net"
RECORD_NAME = "play"  # play.chainlords.net
# Live soft-test VPS (try-cx23-fsn1)
TARGET_IP = os.getenv("PLAY_ORIGIN_IP", "178.105.242.156").strip()
# Orange cloud = free TLS at edge. Set CF_PROXIED=0 for grey cloud (LE on origin).
PROXIED = os.getenv("CF_PROXIED", "1").strip() not in ("0", "false", "False", "no")
API = "https://api.cloudflare.com/client/v4"


def token() -> str:
    for key in ("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"):
        val = os.getenv(key, "").strip()
        if val:
            return val
    for p in (
        Path(__file__).resolve().parent / ".cloudflare_token",
        Path(r"C:\Users\54116\insurance-automation\scripts\.cloudflare_token"),
        Path(r"C:\Users\54116\helbreath-base-game\.cloudflare_token"),
    ):
        if p.exists():
            t = p.read_text(encoding="utf-8").strip()
            if t:
                return t
    raise SystemExit(
        "Falta CLOUDFLARE_API_TOKEN.\n"
        "Cloudflare → My Profile → API Tokens → Create Token\n"
        "Permisos: Zone DNS Edit + Zone Read · zone chainlords.net\n"
        "Luego: $env:CLOUDFLARE_API_TOKEN='...'; python scripts/cf_add_play_dns.py"
    )


def headers() -> dict:
    return {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}


def cf(method: str, path: str, **kwargs) -> dict:
    r = requests.request(method, f"{API}{path}", headers=headers(), timeout=45, **kwargs)
    try:
        data = r.json()
    except Exception:
        print(r.status_code, r.text[:500])
        raise SystemExit(1)
    if not data.get("success"):
        print(json.dumps(data, indent=2))
        raise SystemExit(1)
    return data


def main() -> None:
    zones = cf("GET", f"/zones?name={DOMAIN}")
    results = zones.get("result") or []
    if not results:
        raise SystemExit(f"Zona {DOMAIN} no encontrada con este token.")
    zone_id = results[0]["id"]
    print(f"Zone {DOMAIN} id={zone_id}")
    print(f"Target A {RECORD_NAME}.{DOMAIN} → {TARGET_IP} proxied={PROXIED}")

    existing = cf(
        "GET",
        f"/zones/{zone_id}/dns_records",
        params={"name": f"{RECORD_NAME}.{DOMAIN}", "per_page": 50},
    )
    recs = existing.get("result") or []
    body = {
        "type": "A",
        "name": RECORD_NAME,
        "content": TARGET_IP,
        "ttl": 1 if PROXIED else 300,
        "proxied": PROXIED,
        "comment": "Chain Lords play client + game WS (Hetzner)",
    }

    if recs:
        rid = recs[0]["id"]
        out = cf("PUT", f"/zones/{zone_id}/dns_records/{rid}", json=body)
        print("UPDATED:", json.dumps(out.get("result"), indent=2)[:600])
    else:
        out = cf("POST", f"/zones/{zone_id}/dns_records", json=body)
        print("CREATED:", json.dumps(out.get("result"), indent=2)[:600])

    # SSL mode recommendation
    try:
        ssl = cf("GET", f"/zones/{zone_id}/settings/ssl")
        print("SSL mode:", ssl.get("result", {}).get("value"))
        if PROXIED and ssl.get("result", {}).get("value") == "off":
            cf("PATCH", f"/zones/{zone_id}/settings/ssl", json={"value": "flexible"})
            print("SSL mode set to flexible (edge HTTPS, origin HTTP ok for now)")
    except SystemExit:
        print("(no SSL setting permission — set SSL/TLS to Flexible or Full in dashboard)")

    print("\nListo. Proba en ~30–60s:")
    print(f"  https://play.{DOMAIN}/")
    print("Si el candado sigue mal: Cloudflare → SSL/TLS → Overview → Flexible o Full")


if __name__ == "__main__":
    main()
