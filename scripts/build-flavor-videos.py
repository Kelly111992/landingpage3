"""
Re-encode the flavor 360° videos so the white studio backdrop is replaced
at encode time with a vertical gradient that matches the section background
for that flavor. The result is a standard h264 MP4 that drops onto the page
seamlessly without needing a runtime SVG filter (the SVG approach was
unreliable on Safari iOS).

The flavor section background changes by flavor:
    blueberry  -> linear-gradient(180deg, #EEF4FB 0%, #DDE8F4 100%)
    limonada   -> linear-gradient(180deg, #FBF7EC 0%, #F2E9D1 100%)

Output is also downscaled to 1024x1024 to keep file size reasonable.

Usage:
    python scripts/build-flavor-videos.py
"""

from pathlib import Path
import subprocess
import sys

from PIL import Image
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "assets" / "video"
TMP_DIR = VIDEO_DIR / "_tmp"

# Lumakey threshold tuned to remove the studio cyclorama (very near white)
# without eating into the bottle's lit highlights or the label's white text.
LUMA_THRESHOLD = 0.94
LUMA_TOLERANCE = 0.04
LUMA_SOFTNESS = 0.04

OUTPUT_SIZE = 1024
CRF = 24

# Per-flavor gradients matching the section CSS in css/style.css
# (.flavors.is-blueberry and .flavors.is-limonada).
FLAVOR_BG = {
    "blueberry": ((0xEE, 0xF4, 0xFB), (0xDD, 0xE8, 0xF4)),
    "limonada":  ((0xFB, 0xF7, 0xEC), (0xF2, 0xE9, 0xD1)),
}


def build_gradient_png(top: tuple, bottom: tuple, out: Path) -> None:
    img = Image.new("RGB", (OUTPUT_SIZE, OUTPUT_SIZE), bottom)
    for y in range(OUTPUT_SIZE):
        t = y / (OUTPUT_SIZE - 1)
        r = round(top[0] * (1 - t) + bottom[0] * t)
        g = round(top[1] * (1 - t) + bottom[1] * t)
        b = round(top[2] * (1 - t) + bottom[2] * t)
        for x in range(OUTPUT_SIZE):
            img.putpixel((x, y), (r, g, b))
    img.save(out, "PNG")


def encode(src: Path, dst: Path, bg_png: Path) -> None:
    if dst.exists() and dst.stat().st_mtime >= max(src.stat().st_mtime, bg_png.stat().st_mtime):
        print(f"  skip - {dst.name} already up to date")
        return

    # Pipeline:
    #   1. Read the gradient bg as a still image, loop it for video duration
    #   2. Lumakey the source video so white pixels become transparent
    #   3. Overlay the keyed video onto the looped gradient
    filter_complex = (
        f"[0:v]scale={OUTPUT_SIZE}:{OUTPUT_SIZE}:flags=lanczos,"
        f"lumakey=threshold={LUMA_THRESHOLD}:tolerance={LUMA_TOLERANCE}:softness={LUMA_SOFTNESS}[fg];"
        "[1:v][fg]overlay=shortest=1,format=yuv420p[v]"
    )

    cmd = [
        FFMPEG,
        "-y",
        "-i", str(src),
        "-loop", "1", "-i", str(bg_png),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "slow",
        "-crf", str(CRF),
        "-movflags", "+faststart",
        "-an",
        str(dst),
    ]

    print(f"  encoding {src.name} -> {dst.name}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit(f"ffmpeg failed for {src.name}")
    print(f"  wrote {dst.name} ({dst.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print("Building flavor 360 MP4 videos with per-flavor gradient background")
    print(f"  ffmpeg: {FFMPEG}")

    TMP_DIR.mkdir(exist_ok=True)
    try:
        for flavor, (top, bottom) in FLAVOR_BG.items():
            src = VIDEO_DIR / f"{flavor}-360.mp4"
            if not src.exists():
                print(f"  missing source: {src.name}")
                continue
            bg_png = TMP_DIR / f"{flavor}-bg.png"
            print(f"  building gradient: {flavor}")
            build_gradient_png(top, bottom, bg_png)
            dst = src.with_name(f"{flavor}-360.clean.mp4")
            encode(src, dst, bg_png)
    finally:
        # Clean up tmp gradient PNGs — they're easy to regenerate.
        for f in TMP_DIR.glob("*.png"):
            f.unlink()
        if TMP_DIR.exists() and not any(TMP_DIR.iterdir()):
            TMP_DIR.rmdir()


if __name__ == "__main__":
    main()
