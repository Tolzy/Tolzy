# Photo-check fixtures

Every image here is a render of the CC0 MakeHuman sample bust
(`scripts/sample-head/README.md`) or derived from one — **no real person's
photo is used**. Regenerate with:

```bash
npm run dev
node scripts/fixtures/render-photo-fixtures.mjs
python3 scripts/fixtures/derive-photo-fixtures.py
```

| File               | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| front.jpg/png/webp | Good front-facing photo in each supported format |
| three-quarter.jpg  | Head turned ≈ 40°                                |
| profile.jpg        | Side view                                        |
| blurry.jpg         | Strong blur → "too blurry"                       |
| dark.jpg           | Underexposed → lighting suggestion               |
| low-res.jpg        | 600 × 655 → below the 1024 px minimum            |
| two-people.jpg     | Two faces → "one person"                         |
| small-face.jpg     | Face ≈ 13 % of the frame → "too small"           |
| distant-face.jpg   | Face ≈ 16 % of the frame → suggestion            |
| no-face.jpg        | Gradient, no face                                |
| unsupported.gif    | Unsupported format                               |
| not-an-image.jpg   | Text file named .jpg (signature check)           |
| photo.heic         | HEIC signature without decodable data            |
