"""
Re-encode the flavor 360 videos as animated WebP with a real alpha
channel so the bottle rotation can sit on top of the section background
gradient with no visible rectangle.

Animated WebP is supported in every modern browser (Chrome 32+,
Firefox 65+, Safari 14+, Edge 79+) and plays automatically inside an
`<img>` tag. Unlike VP9 alpha in WebM, libwebp's animation encoder in
this ffmpeg build produces a working alpha track.

Usage:
    python scripts/build-flavor-videos.py
"""

from pathlib import Path
import subprocess
import sys

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "assets" / "video"

# Lumakey threshold tuned to remove the studio cyclorama (very near white)
# without eating into the bottle's lit highlights or the label's white text.
LUMA_THRESHOLD = 0.94
LUMA_TOLERANCE = 0.04
LUMA_SOFTNESS = 0.04

# Output is a 384x384 animated WebP. Source is 2048x2048 / 8.4s; we trim
# to 4 seconds (a half rotation, still enough to read as motion) which
# halves the file size.
OUTPUT_SIZE = 384
TRIM_SECONDS = 4
QUALITY = 72


def encode(src: Path, dst: Path) -> None:
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        print(f"  skip - {dst.name} already up to date")
        return

    vf = (
        f"scale={OUTPUT_SIZE}:{OUTPUT_SIZE}:flags=lanczos,"
        f"lumakey=threshold={LUMA_THRESHOLD}:tolerance={LUMA_TOLERANCE}:softness={LUMA_SOFTNESS},"
        "format=yuva420p"
    )

    cmd = [
        FFMPEG,
        "-y",
        "-i", str(src),
        "-t", str(TRIM_SECONDS),
        "-vf", vf,
        "-c:v", "libwebp_anim",
        "-pix_fmt", "yuva420p",
        "-loop", "0",         # infinite loop
        "-lossless", "0",
        "-compression_level", "6",
        "-q:v", str(QUALITY),
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
    print("Building flavor 360 animated WebPs with alpha channel")
    print(f"  ffmpeg: {FFMPEG}")
    for src in sorted(VIDEO_DIR.glob("*-360.mp4")):
        dst = src.with_suffix(".webp")
        encode(src, dst)


if __name__ == "__main__":
    main()
