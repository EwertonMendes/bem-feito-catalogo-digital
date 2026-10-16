#!/usr/bin/env python3
"""Produce the French-lavender medallion assets from the approved soap silhouettes."""
import colorsys
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public/assets/format-medallions"
SOURCE = BASE / "frutas-vermelhas"
DEST = BASE / "lavanda-francesa"
CATALOG = ROOT / "public/data/catalog.json"
FORMATS = (
    "coracoezinhos", "mini-florzinhas", "patinha-m", "patinha-g",
    "barra-arredondada", "floral", "massageador"
)

def lilac_image(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            _, saturation, brightness = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            warmth = max(0.0, min(1.0, ((r - max(g, b)) / max(r, 1)) * 4))
            strength = max(0.0, min(1.0, (saturation - 0.07) / 0.30)) * warmth
            if strength == 0:
                continue
            lilac_saturation = min(0.43, saturation * 0.22 + 0.15)
            lilac_brightness = min(1.0, brightness * 0.70 + 0.31)
            lr, lg, lb = colorsys.hsv_to_rgb(0.759, lilac_saturation, lilac_brightness)
            pixels[x, y] = (
                round(r * (1 - strength) + lr * 255 * strength),
                round(g * (1 - strength) + lg * 255 * strength),
                round(b * (1 - strength) + lb * 255 * strength),
                a,
            )
    return rgba

def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for slug in FORMATS:
        src = SOURCE / f"{slug}.webp"
        if not src.is_file():
            raise FileNotFoundError(f"Missing approved medallion: {src}")
        with Image.open(src) as image:
            output = lilac_image(image)
            if output.size != (128, 128):
                raise ValueError(f"Unexpected format dimensions {slug}: {output.size}")
            output.save(DEST / f"{slug}.webp", format="WEBP", quality=86, method=6)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    fragrance = next(f for f in catalog["fragrances"] if f["id"] == "lavanda-francesa")
    if set(fragrance["availableFormats"]) != set(FORMATS):
        raise ValueError("Fragrance available formats don't match the approved seven")
    fragrance["medallionImages"] = {
        slug: f"assets/format-medallions/lavanda-francesa/{slug}.webp"
        for slug in FORMATS
    }
    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Generated seven 128×128 transparent lavender WebP images and updated catalog.json")

if __name__ == "__main__":
    main()
