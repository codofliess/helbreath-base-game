import re
from pathlib import Path

text = Path(
    r"C:\Users\54116\helbreath-base-game\multiplayer\mp-client\src\constants\OlympiaItems.generated.ts"
).read_text(encoding="utf-8")

# Each item is roughly { id: N, ... },
for m in re.finditer(
    r"id:\s*(\d+),\s*name:\s*\"([^\"]+)\",[\s\S]*?itemType:\s*\"shield\"([\s\S]*?)(?=\n\s*\{|\n\];)",
    text,
):
    iid, name, rest = m.group(1), m.group(2), m.group(3)
    start = re.search(r"startSpriteSheetIndex:\s*(\d+)", rest)
    male = re.search(r"equippedSpriteMale:\s*\"([^\"]+)\"", rest)
    print(
        iid,
        name,
        "start=",
        start.group(1) if start else "none",
        "male=",
        male.group(1) if male else "?",
    )
