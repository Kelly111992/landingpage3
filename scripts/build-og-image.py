"""
Build a 1200x630 Open Graph image for the H2PRO landing page.

Composites both bottles (blueberry on the left, limonada on the right) onto a
brand-aligned light canvas. Output is JPEG, optimized to stay well under
WhatsApp's 600 KB OG-image limit.

Usage:
    python scripts/build-og-image.py

Output:
    assets/img/og-image.jpg
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "assets" / "img"

OUTPUT = IMG_DIR / "og-image.jpg"
WIDTH, HEIGHT = 1200, 630
BG_COLOR = (244, 246, 248)  # #F4F6F8 — matches <meta name="theme-color">

bottles = [
    IMG_DIR / "bottle-blueberry.png",
    IMG_DIR / "bottle-limonada.png",
]

canvas = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)

# Bottle target size — generous so the product reads well in feed previews.
bottle_h = 560
gap = 40

scaled = []
for path in bottles:
    src = Image.open(path).convert("RGBA")
    ratio = bottle_h / src.height
    new_w = int(src.width * ratio)
    scaled.append(src.resize((new_w, bottle_h), Image.LANCZOS))

total_w = sum(b.width for b in scaled) + gap * (len(scaled) - 1)
x = (WIDTH - total_w) // 2
y = (HEIGHT - bottle_h) // 2

for b in scaled:
    canvas.paste(b, (x, y), b)
    x += b.width + gap

canvas.save(OUTPUT, "JPEG", quality=88, optimize=True, progressive=True)
print(f"Wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size / 1024:.1f} KB)")
