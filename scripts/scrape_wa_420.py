"""Scrape WhatsApp Desktop group '420' via UI Automation (pywinauto)."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys

OUT = Path(r"C:\Users\54116\helbreath-base-game\tmp-wa-420-full.txt")
CLEAN = Path(r"C:\Users\54116\helbreath-base-game\tmp-wa-420-clean.txt")

NOISE = re.compile(
    r"^(WhatsApp|Chats|Calls|Status|Updates|Channels|Communities|Archived|"
    r"Locked chats|Tools|Advertise|Media|Settings|Profile|New chat|Menu|"
    r"All|Unread|Favorites|Search|Messages|Resize|Profile details|Lists|"
    r"Group video call|Scroll to bottom|Open chat details|Attach|"
    r"Emojis.*|Type a message|Voice message|System|Delivered|Read more|"
    r"Forward media|Quoted message|reaction|Sticker|Open picture|"
    r"Minimize|Maximize|Close|Non Client|AppWindow|End icon|"
    r"chat-list|Search results|Contacts|Groups in common|"
    r"Click here to get older|wds-ic-|You:|Muted chat|™️)$",
    re.I,
)


def find_wa():
    desk = Desktop(backend="uia")
    # Prefer main WhatsApp window with title WhatsApp
    for w in desk.windows():
        try:
            title = w.window_text() or ""
            name = w.element_info.name or ""
            cls = w.element_info.class_name or ""
            if "WhatsApp" in title and "Business" not in title:
                if w.is_visible():
                    return w
        except Exception:
            continue
    # fallback by process
    try:
        app = Application(backend="uia").connect(path="WhatsApp.Root.exe")
        return app.top_window()
    except Exception:
        pass
    raise RuntimeError("WhatsApp window not found")


def dump_texts(win) -> list[str]:
    texts = []
    try:
        # descendants can be huge; walk carefully
        for el in win.descendants():
            try:
                t = (el.window_text() or "").strip()
                if not t:
                    continue
                # skip pure chrome noise later
                texts.append(t)
            except Exception:
                continue
    except Exception as e:
        texts.append(f"[dump error: {e}]")
    return texts


def unique_keep_order(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for x in items:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def is_noise(t: str) -> bool:
    if len(t) <= 1:
        return True
    if NOISE.match(t):
        return True
    if t.startswith("Open chat details"):
        return True
    if t.startswith("reaction "):
        return True
    if re.match(r"^\d{1,2}:\d{2}\s*(AM|PM)?\s*(Delivered)?$", t, re.I):
        return True
    if re.match(r"^(Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$", t, re.I):
        return False  # keep day markers
    return False


def main():
    print("Connecting to WhatsApp...", flush=True)
    win = find_wa()
    win.set_focus()
    time.sleep(0.5)

    # Try Ctrl+F search for 420
    print("Searching 420...", flush=True)
    send_keys("^f")
    time.sleep(0.4)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.2)
    send_keys("420")
    time.sleep(1.2)
    send_keys("{ENTER}")
    time.sleep(1.5)

    # If search didn't open, try clicking list item via name contains 420
    try:
        # Press Escape once if search box still focused oddly, then ensure chat open
        pass
    except Exception:
        pass

    all_raw: list[str] = []
    all_clean: list[str] = []

    # Scroll up many times to load ~8h of history
    print("Scrolling history...", flush=True)
    for i in range(45):
        # Focus message area: click roughly center-right of window
        try:
            rect = win.rectangle()
            # message pane is right side
            cx = int(rect.left + (rect.right - rect.left) * 0.65)
            cy = int(rect.top + (rect.bottom - rect.top) * 0.55)
            win.click_input(coords=(cx - rect.left, cy - rect.top))
        except Exception:
            pass
        time.sleep(0.15)
        # Page up / wheel up
        send_keys("{PGUP}")
        time.sleep(0.25)
        if i % 5 == 0:
            raw = dump_texts(win)
            all_raw.extend(raw)
            for t in raw:
                if not is_noise(t):
                    all_clean.append(t)
            print(f"  scroll {i}/45 unique_clean={len(set(all_clean))}", flush=True)

    # Final dump at top of loaded history, then jump bottom for latest
    raw = dump_texts(win)
    all_raw.extend(raw)
    for t in raw:
        if not is_noise(t):
            all_clean.append(t)

    # Scroll to bottom for newest messages
    send_keys("^{END}")
    time.sleep(0.8)
    raw = dump_texts(win)
    all_raw.extend(raw)
    for t in raw:
        if not is_noise(t):
            all_clean.append(t)

    # Also try Home-area multiple PageDown dumps if needed
    for i in range(10):
        send_keys("{PGDN}")
        time.sleep(0.2)
    raw = dump_texts(win)
    all_raw.extend(raw)
    for t in raw:
        if not is_noise(t):
            all_clean.append(t)

    raw_u = unique_keep_order(all_raw)
    clean_u = unique_keep_order(all_clean)

    OUT.write_text("\n====\n".join(raw_u), encoding="utf-8")
    CLEAN.write_text("\n---\n".join(clean_u), encoding="utf-8")
    print(f"Wrote {OUT} ({len(raw_u)} raw lines)", flush=True)
    print(f"Wrote {CLEAN} ({len(clean_u)} clean lines)", flush=True)

    # Print clean for agent
    print("\n===== CLEAN PREVIEW =====\n", flush=True)
    for t in clean_u:
        print(t)
        print("---")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)
