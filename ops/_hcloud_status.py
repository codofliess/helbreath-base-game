#!/usr/bin/env python3
"""Quick Hetzner Cloud status for Chain Lords handoff."""
import json
import os
import subprocess
import urllib.request

def token():
    raw = open("/opt/chainlords/ops/config.env", encoding="utf-8").read()
    for line in raw.splitlines():
        if line.startswith("HCLOUD_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("no HCLOUD_TOKEN")

def api(path: str):
    req = urllib.request.Request(
        f"https://api.hetzner.cloud/v1{path}",
        headers={"Authorization": f"Bearer {token()}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    os.environ["HCLOUD_TOKEN"] = token()
    print("=== SERVERS ===")
    data = api("/servers")
    for s in data.get("servers", []):
        st = s.get("server_type") or {}
        ip = ((s.get("public_net") or {}).get("ipv4") or {}).get("ip")
        print(
            f"{s.get('name')}: type={st.get('name')} cores={st.get('cores')} "
            f"mem={st.get('memory')}G disk={st.get('disk')}G status={s.get('status')} ip={ip}"
        )
    if not data.get("servers"):
        print("(none)")

    print("\n=== TYPE AVAIL (fsn1/nbg1/hel1) + monthly gross fsn1 ===")
    for t in ["cx33", "cx43", "cx53", "cpx42", "cpx52", "cpx62"]:
        try:
            d = api(f"/server_types?name={t}")
            rows = d.get("server_types") or []
            if not rows:
                # fallback describe via list all once
                continue
        except Exception as e:
            print(t, "ERR", e)
            continue

    # list all types once
    all_types = api("/server_types").get("server_types") or []
    want = {x: None for x in ["cx33", "cx43", "cx53", "cpx42", "cpx52", "cpx62"]}
    for st in all_types:
        name = st.get("name")
        if name not in want:
            continue
        locs = []
        for loc in st.get("prices") or []:
            # prices don't have availability; use locations from describe-like field
            pass
        # Hetzner API server_types include prices per location; availability needs datacenters
        mon = None
        for p in st.get("prices") or []:
            if p.get("location") == "fsn1":
                mon = (p.get("price_monthly") or {}).get("gross")
        want[name] = mon
        print(f"{name:7} monthly_fsn1_gross≈€{mon}  cores={st.get('cores')} mem={st.get('memory')}")

    print("\n=== NOTE ON CREDIT ===")
    print("Hetzner Cloud public API does NOT expose remaining prepaid credit / balance.")
    print("Check https://console.hetzner.cloud/ → Billing / Credit for remaining balance.")

    # Try account endpoint (may 404)
    try:
        acc = api("/account")
        print("account endpoint:", json.dumps(acc)[:300])
    except Exception as e:
        print("account endpoint: not available (", type(e).__name__, ")")

if __name__ == "__main__":
    main()
