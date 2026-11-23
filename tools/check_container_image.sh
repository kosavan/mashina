#!/usr/bin/env bash
set -euo pipefail

image=${1:?Provide a built image reference}
source_dir=${2:-.}
volume=$(docker volume create)
container=
cleanup() {
  if [[ -n "$container" ]]; then
    docker rm -f "$container" >/dev/null
  fi
  docker volume rm "$volume" >/dev/null
}
trap cleanup EXIT

container=$(docker run -d --init --read-only --tmpfs /tmp:rw,size=128m,mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges \
  --mount "type=volume,source=$volume,target=/app/data" -p 127.0.0.1::8000 "$image")
address=$(docker port "$container" 8000/tcp)
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://$address/api/v1/health"; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    docker logs "$container"
    exit 1
  fi
  sleep 2
done
test "$(docker exec "$container" id -u)" = 10001
docker exec -i "$container" /app/.venv/bin/python < "$source_dir/tools/check_container_restore.py"

docker exec -i "$container" /app/.venv/bin/python - <<'PY'
import io

from PIL import Image, ImageDraw, ImageFont

from backend.ocr import recognize

image = Image.new("RGB", (1400, 500), "white")
font = ImageFont.truetype("backend/assets/fonts/Manrope-Regular.ttf", 40)
ImageDraw.Draw(image).text((60, 40), "TOTAL 1234.56", fill="black", font=font)
for format in ("PNG", "PDF"):
    buffer = io.BytesIO()
    image.save(buffer, format=format, resolution=150)
    result = recognize(buffer.getvalue(), "receipt", 1)
    assert result["engine"] == "tesseract-local"
    assert "1234.56" in result["candidates"].get("amount", []), result
    assert result["fields"].get("amount") in (None, "1234.56"), result
print("Production container: actual image and PDF OCR passed")
PY
