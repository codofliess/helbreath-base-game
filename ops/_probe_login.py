#!/usr/bin/env python3
"""Quick prod probe: WS upgrade + middleware auth challenge."""
import base64
import json
import os
import socket
import ssl
import http.client
import urllib.request

def tcp(host, port):
    s = socket.create_connection((host, port), 5)
    s.close()
    print(f"tcp {host}:{port} ok")


def ws_upgrade(host, port, path, sni_host=None, use_tls=False):
    key = base64.b64encode(os.urandom(16)).decode()
    headers = {
        "Host": sni_host or host,
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Key": key,
        "Sec-WebSocket-Version": "13",
    }
    if use_tls:
        ctx = ssl.create_default_context()
        conn = http.client.HTTPSConnection(host, port, timeout=15, context=ctx)
    else:
        conn = http.client.HTTPConnection(host, port, timeout=15)
    conn.request("GET", path, headers=headers)
    resp = conn.getresponse()
    print(f"ws {host}:{port}{path} -> {resp.status} {resp.reason} upgrade={resp.getheader('Upgrade')}")
    conn.close()


def http_json(url, data=None, method=None):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
        method = method or "POST"
    req = urllib.request.Request(url, data=body, headers=headers, method=method or "GET")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8", "replace")
            print(f"{method or 'GET'} {url} -> {r.status} {raw[:200]}")
    except Exception as e:
        print(f"{method or 'GET'} {url} -> ERR {e}")


if __name__ == "__main__":
    tcp("46.224.129.38", 80)
    # from this machine we may not reach 1337 (firewalled); try via nginx
    try:
        tcp("46.224.129.38", 1337)
    except Exception as e:
        print("tcp 1337", e)
    ws_upgrade("46.224.129.38", 80, "/ws", sni_host="play.chainlords.net")
    # via cloudflare https
    try:
        ws_upgrade("play.chainlords.net", 443, "/ws", sni_host="play.chainlords.net", use_tls=True)
    except Exception as e:
        print("wss via CF", e)

    http_json("https://play.chainlords.net/api/realm-stats")
    http_json("https://chainlords-middleware-production.up.railway.app/health")
    # wallet auth challenge
    http_json(
        "https://chainlords-middleware-production.up.railway.app/auth/challenge",
        {"wallet": "11111111111111111111111111111111"},
    )
    http_json(
        "https://chainlords-middleware-production.up.railway.app/auth/nonce",
        {"wallet": "11111111111111111111111111111111"},
    )
