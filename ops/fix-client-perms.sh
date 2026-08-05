#!/bin/bash
set -euo pipefail
CLIENT=/opt/chainlords/client

echo "=== before (www-data) ==="
sudo -u www-data test -r "$CLIENT/assets/index-DbpFQKY7.js" && echo js_ok || echo js_fail
sudo -u www-data ls "$CLIENT/assets/sprites" >/dev/null 2>&1 && echo sprites_list_ok || echo sprites_list_FAIL
sudo -u www-data ls "$CLIENT/assets/maps" >/dev/null 2>&1 && echo maps_list_ok || echo maps_list_FAIL

# Full game media from game-assets into assets (vite deploy often left partial + 700 dirs)
if [ -d "$CLIENT/game-assets/sprites" ]; then
  rsync -a "$CLIENT/game-assets/sprites/" "$CLIENT/assets/sprites/"
fi
if [ -d "$CLIENT/game-assets/maps" ]; then
  rsync -a "$CLIENT/game-assets/maps/" "$CLIENT/assets/maps/"
fi
if [ -d "$CLIENT/game-assets/music" ]; then
  rsync -a "$CLIENT/game-assets/music/" "$CLIENT/assets/music/"
fi
if [ -d "$CLIENT/game-assets/sounds" ]; then
  rsync -a "$CLIENT/game-assets/sounds/" "$CLIENT/assets/sounds/"
fi
if [ -d "$CLIENT/game-assets/images" ]; then
  rsync -a "$CLIENT/game-assets/images/" "$CLIENT/assets/images/"
fi

chown -R root:www-data "$CLIENT"
find "$CLIENT" -type d -exec chmod 755 {} \;
find "$CLIENT" -type f -exec chmod 644 {} \;

echo "=== after ==="
sudo -u www-data ls "$CLIENT/assets/sprites" | wc -l
sudo -u www-data ls "$CLIENT/assets/maps" | wc -l
curl -sS -o /dev/null -w "sprite=%{http_code} size=%{size_download}\n" http://127.0.0.1/assets/sprites/abs.spr
curl -sS -o /dev/null -w "map=%{http_code}\n" http://127.0.0.1/assets/maps/2ndmiddle.amd
curl -sS -o /dev/null -w "sitebg=%{http_code}\n" http://127.0.0.1/assets/images/SiteBg.jpg
curl -sS -o /dev/null -w "js=%{http_code}\n" http://127.0.0.1/assets/index-DbpFQKY7.js
ls -ld "$CLIENT/assets/sprites" "$CLIENT/assets/maps" "$CLIENT/assets/music" "$CLIENT/assets/sounds"
echo done
