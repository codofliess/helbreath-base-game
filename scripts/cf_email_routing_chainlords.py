#!/usr/bin/env python3
"""
Enable Cloudflare Email Routing for chainlords.net and create:
  ops@chainlords.net  -> DESTINATION
  hello@chainlords.net -> DESTINATION

Usage (PowerShell):
  $env:CLOUDFLARE_API_TOKEN = "pegá-tu-token"
  $env:CF_DESTINATION_EMAIL = "tu-gmail@gmail.com"
  python scripts/cf_email_routing_chainlords.py

Token scopes (Create Custom Token):
  - Zone → Zone → Read (zone chainlords.net)
  - Zone → Email Routing Addresses → Edit
  - Zone → Email Routing Rules → Edit
  - Zone → DNS → Edit  (needed if enabling routing creates MX records)

Destination must already be verified in Cloudflare (API will invite if not).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

DOMAIN = "chainlords.net"
API = "https://api.cloudflare.com/client/v4"


def token() -> str:
    for key in ("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"):
        val = os.getenv(key, "").strip()
        if val:
            return val
    for p in (
        Path(__file__).resolve().parent / ".cloudflare_token",
        Path(__file__).resolve().parent.parent / "scripts" / ".cloudflare_token",
        Path.home() / "insurance-automation" / "scripts" / ".cloudflare_token",
        Path(r"C:\Users\54116\insurance-automation\scripts\.cloudflare_token"),
    ):
        if p.exists():
            t = p.read_text(encoding="utf-8").strip()
            if t:
                return t
    raise SystemExit(
        "Falta CLOUDFLARE_API_TOKEN.\n"
        "Cloudflare → My Profile → API Tokens → Create Token\n"
        "Permisos: Zone Read + Email Routing Addresses/Rules Edit + DNS Edit\n"
        "Zone Resources: Include → Specific zone → chainlords.net\n"
        "Luego: $env:CLOUDFLARE_API_TOKEN='...'; $env:CF_DESTINATION_EMAIL='tu@gmail.com'"
    )


def headers() -> dict:
    return {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}


def cf(method: str, path: str, **kwargs) -> dict:
    url = f"{API}{path}"
    r = requests.request(method, url, headers=headers(), timeout=45, **kwargs)
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
    dest = (os.getenv("CF_DESTINATION_EMAIL") or os.getenv("DESTINATION_EMAIL") or "").strip()
    if not dest or "@" not in dest:
        raise SystemExit(
            "Seteá el mail destino que YA uses:\n"
            "  $env:CF_DESTINATION_EMAIL = 'tu@gmail.com'\n"
            "Cloudflare te mandará un mail de verificación si no está verificado."
        )

    zones = cf("GET", f"/zones?name={DOMAIN}")
    results = zones.get("result") or []
    if not results:
        raise SystemExit(f"Zona {DOMAIN} no encontrada con este token.")
    zone_id = results[0]["id"]
    print(f"Zone {DOMAIN} id={zone_id}")

    # Enable email routing (creates MX if needed)
    try:
        en = cf("POST", f"/zones/{zone_id}/email/routing/enable")
        print("Email Routing enable:", en.get("result", {}).get("enabled", en.get("success")))
    except SystemExit:
        # Some accounts use PUT settings
        print("POST enable falló o ya estaba; probando settings…")
        try:
            st = cf("GET", f"/zones/{zone_id}/email/routing")
            print("Routing status:", json.dumps(st.get("result"), indent=2)[:400])
        except SystemExit:
            pass

    # Destination address
    dests = cf("GET", f"/zones/{zone_id}/email/routing/addresses")
    existing_dest = {d.get("email", "").lower(): d for d in (dests.get("result") or [])}
    if dest.lower() not in existing_dest:
        print(f"Creando destination {dest} (revisá tu bandeja para verificar)…")
        created = cf(
            "POST",
            f"/zones/{zone_id}/email/routing/addresses",
            json={"email": dest},
        )
        print("Destination created:", created.get("result", {}).get("email"), "verified=", created.get("result", {}).get("verified"))
        print(">>> Si verified=false, abrí el mail de Cloudflare y confirmá, luego re-ejecutá este script.")
    else:
        d = existing_dest[dest.lower()]
        print(f"Destination OK: {dest} verified={d.get('verified')}")
        if not d.get("verified"):
            print(">>> Destination NO verificado. Confirmá el mail y re-ejecutá.")
            raise SystemExit(2)

    # Routing rules (custom addresses)
    rules = cf("GET", f"/zones/{zone_id}/email/routing/rules")
    existing_matchers = set()
    for rule in rules.get("result") or []:
        for m in rule.get("matchers") or []:
            if m.get("type") == "literal" and m.get("field") == "to":
                existing_matchers.add(m.get("value", "").lower())

    for local in ("ops", "hello"):
        addr = f"{local}@{DOMAIN}"
        if addr.lower() in existing_matchers:
            print(f"Rule OK already: {addr} -> {dest}")
            continue
        body = {
            "name": f"route-{local}",
            "enabled": True,
            "matchers": [{"type": "literal", "field": "to", "value": addr}],
            "actions": [{"type": "forward", "value": [dest]}],
        }
        created = cf("POST", f"/zones/{zone_id}/email/routing/rules", json=body)
        print(f"CREATED rule: {addr} -> {dest}", "id=", (created.get("result") or {}).get("id"))

    print("\nListo. Proba mandando un mail a ops@chainlords.net y hello@chainlords.net")
    print(f"Deberían llegar a {dest}")


if __name__ == "__main__":
    main()
