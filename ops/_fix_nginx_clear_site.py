#!/usr/bin/env python3
from pathlib import Path

p = Path("/etc/nginx/sites-enabled/chainlords-play")
text = p.read_text(encoding="utf-8", errors="replace")
print("has_clear_before", "Clear-Site-Data" in text)
lines = [ln for ln in text.splitlines() if "Clear-Site-Data" not in ln]
p.write_text("\n".join(lines) + "\n", encoding="utf-8")
text2 = p.read_text(encoding="utf-8", errors="replace")
print("has_clear_after", "Clear-Site-Data" in text2)
print("lines", len(lines))
