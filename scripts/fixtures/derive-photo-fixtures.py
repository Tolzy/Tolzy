"""Derives photo-check test fixtures from the rendered CC0 sample head.

Run after render-photo-fixtures.mjs:  python3 scripts/fixtures/derive-photo-fixtures.py
Writes tests/fixtures/photos/*. Every image derives from the CC0 MakeHuman
sample bust (scripts/sample-head/README.md) — no real person's photo.
"""
import os
from PIL import Image, ImageEnhance, ImageFilter

SRC = "tests/fixtures/photos/source"
OUT = "tests/fixtures/photos"


def load(name):
    im = Image.open(os.path.join(SRC, f"{name}.png")).convert("RGB")
    return im.crop((0, 0, im.width, 1440))  # drop the viewport toolbar


front = load("front")
front.save(f"{OUT}/front.jpg", quality=88)
front.save(f"{OUT}/front.png", optimize=True)
front.save(f"{OUT}/front.webp", quality=85)
load("three-quarter").save(f"{OUT}/three-quarter.jpg", quality=88)
load("profile").save(f"{OUT}/profile.jpg", quality=88)

front.filter(ImageFilter.GaussianBlur(14)).save(f"{OUT}/blurry.jpg", quality=88)
ImageEnhance.Brightness(front).enhance(0.18).save(f"{OUT}/dark.jpg", quality=88)
front.resize((600, 655), Image.LANCZOS).save(f"{OUT}/low-res.jpg", quality=88)

pair = Image.new("RGB", (front.width * 2, front.height))
pair.paste(front, (0, 0))
pair.paste(front, (front.width, 0))
pair.save(f"{OUT}/two-people.jpg", quality=85)

def framed(scale, canvas):
    im = Image.new("RGB", (canvas, canvas), (22, 22, 24))
    s = front.resize((int(front.width * scale), int(front.height * scale)), Image.LANCZOS)
    im.paste(s, ((canvas - s.width) // 2, (canvas - s.height) // 2))
    return im


framed(0.45, 2200).save(f"{OUT}/small-face.jpg", quality=88)  # face ≈ 13 % of the height
framed(0.5, 2000).save(f"{OUT}/distant-face.jpg", quality=88)  # face ≈ 16 %

# Patterned cap drawn over the hair (red / white / navy zigzag, like a kufi
# or knitted cap). Synthetic — tests the "head covered" suggestion.
from PIL import ImageDraw

def cap(palette, background, name):
    capped = front.copy()
    mask = Image.new("L", capped.size, 0)
    ImageDraw.Draw(mask).chord((420, 200, 900, 690), 180, 360, fill=255)
    ImageDraw.Draw(mask).rectangle((420, 440, 900, 455), fill=255)
    pattern = Image.new("RGB", capped.size, background)
    pd = ImageDraw.Draw(pattern)
    for i, y in enumerate(range(190, 470, 28)):
        points = [(x, y + (14 if (x // 28) % 2 else 0)) for x in range(400, 930, 28)]
        pd.line(points, fill=palette[i % len(palette)], width=12)
    capped.paste(pattern, (0, 0), mask)
    capped.save(f"{OUT}/{name}", quality=88)


# Vivid: red / navy / white zigzag.
cap([(176, 30, 40), (30, 34, 70), (245, 240, 235)], (245, 240, 235), "headwear.jpg")
# Dark: maroon / black with thin white threads — close in colour to deep skin
# tones, like a woven fila cap (found missed in product-owner testing).
cap([(96, 28, 36), (26, 20, 22), (220, 214, 204), (60, 22, 28)], (40, 26, 28), "headwear-dark.jpg")

grad = Image.linear_gradient("L").resize((1600, 1200)).convert("RGB")
grad.save(f"{OUT}/no-face.jpg", quality=88)

front.resize((400, 436)).save(f"{OUT}/unsupported.gif")
with open(f"{OUT}/not-an-image.jpg", "w") as f:
    f.write("This is a text file with a .jpg name.\n")
# HEIC signature (ftyp/heic) without real HEVC data: Chromium can't decode HEIC.
with open(f"{OUT}/photo.heic", "wb") as f:
    f.write(b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" + bytes(2048))
print("fixtures written to", OUT)
