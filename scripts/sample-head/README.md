# Sample head asset

`public/models/sample-head/sample-head.glb` is the development and
demonstration model shown in the studio as **"Sample head"**. It is a
synthetic person assembled from CC0 MakeHuman assets. It is **not** an
AI-generated portrait and does not depict a real individual.

## Licence

**CC0 1.0 Universal (public domain dedication)** — commercial use, modification
and redistribution are allowed without attribution. We credit MakeHuman
anyway, in the studio badge tooltip and in `public/models/sample-head/LICENSE.txt`.

| Component                                                      | Source asset                                                | Author                           | Licence (verified from)                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base mesh `hm08`                                               | `makehuman/data/3dobjs/base.obj`                            | MakeHuman team                   | CC0 — file header ("explicitly released as CC0 in september 2020") and `LICENSE.ASSETS.md` in [makehumancommunity/makehuman](https://github.com/makehumancommunity/makehuman)                          |
| Shape targets (age, gender, ethnicity)                         | `makehuman/data/targets/macrodetails/*.target`              | Manuel Bastioni / MakeHuman team | CC0 — file headers and `LICENSE.ASSETS.md`                                                                                                                                                             |
| Skin "Male African middle-age" (diffuse, normal, specular)     | `skins02_cc0.zip` → `mindfront_skin_male_african_middleage` | Mindfront                        | CC0 — `packs/skins02.json` (`"license": "CC0"`), author's note "I set the license to CC0 for maximum usage freedom"; [asset packs](https://static.makehumancommunity.org/assets/assetpacks/index.html) |
| Eyes (high-poly) + brown eye texture                           | `makehuman_system_assets_cc0.zip` → `eyes/`                 | MakeHuman team                   | CC0 — `packs/makehuman_system_assets.json` and `.mhclo` headers                                                                                                                                        |
| Eyebrows `eyebrow001`, eyelashes `eyelashes02`, hair `short01` | `makehuman_system_assets_cc0.zip`                           | MakeHuman team                   | CC0 — as above                                                                                                                                                                                         |

The MakeHuman **application code** is AGPL; none of it is used or bundled here.
Only CC0 data files are read by `build.py`, which is our own code. The MakeHuman
licence (section D) also states that output built from its assets carries no
restrictions.

## What the build does

1. Applies macro targets for an adult male (~40 years, African ethnicity, average
   muscle/weight) to the base mesh.
2. Keeps the head, neck and shoulders: triangles are clipped exactly on a
   horizontal plane 32 cm below the crown (`--cut-depth`, decimetres), and the
   flat section is closed with an ear-clipped, downward-facing "Base" cap in a
   dark warm matte. A flat base cannot be seen from front, three-quarter or
   profile views (an earlier curved cut exposed its cap as a dark wedge once
   the head turned past ~20°).
3. Fits the eye, eyebrow, eyelash and hair proxies to the reshaped mesh with
   their `.mhclo` bindings.
4. Builds PBR textures: base colour and tangent-space normal map from the skin;
   roughness derived from the specular map. The eye texture's iris is shifted
   from chestnut-red to a natural dark brown (CC0 allows modification).
5. Writes a GLB in metres, Y up, facing +Z, with no extensions required.

## Asset facts

| Property             | Value                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Format               | glTF 2.0 binary (`.glb`), no extensions, no Draco/meshopt                                                                            |
| File size            | ≈ 1.81 MB (1,808,308 bytes)                                                                                                          |
| Triangles / vertices | 15,502 / 9,549                                                                                                                       |
| Meshes               | Skin 9,118 tris · Base 106 · Eyes 2,040 · Eyebrows 192 · Eyelashes 368 · Hair 3,678                                                  |
| Textures             | Skin colour 2048² JPEG · skin normal 2048² JPEG · skin roughness 1024² JPEG · hair 1024² PNG · eyes 512² PNG · brows/lashes 256² PNG |
| Dimensions           | ≈ 45.6 × 33.8 × 24.4 cm (W × H × D)                                                                                                  |
| Coverage             | Face, ears, scalp and hair, back of head, neck, shoulders; closed flat base                                                          |
| Thumbnail            | `thumbnail.webp`, 640 × 800, rendered from the studio by `thumbnail.mjs`                                                             |

## Known asset limitations

- 14 skin triangles (≈ 7 mm² in total, under the jaw) have shading normals that
  disagree with their winding. They come from folded geometry in the MakeHuman
  base mesh, are invisible at any viewing distance, and are left as-is rather
  than altering the source topology.
- Hair is a simple card-based proxy with a slightly hard hairline.
- `src/lib/studio/sample-asset.test.ts` checks the base stays flat and faces
  down, and that the skin is open only along the base outline.

## Rebuilding

Download the inputs into a scratch folder (they are large and are not committed):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh
```

```bash
git -C mh sparse-checkout set makehuman/data/3dobjs makehuman/data/targets/macrodetails
```

```bash
curl -LO https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
```

```bash
curl -LO https://files2.makehumancommunity.org/asset_packs/skins02/skins02_cc0.zip
```

Unzip each pack into its own folder, then run (requires Python 3 with numpy and Pillow):

```bash
python3 -I scripts/sample-head/build.py --makehuman mh/makehuman/data --assets makehuman_system_assets_cc0 --skins skins02_cc0 --out public/models/sample-head/sample-head.glb
```

With the app running, regenerate the dashboard thumbnail:

```bash
node scripts/sample-head/thumbnail.mjs http://localhost:3000
```

## Candidates considered and rejected

| Candidate                                                | Reason                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Lee Perry-Smith head scan (three.js examples, CC BY 3.0) | Licence fine, but the mesh is a front/face scan: 858 open boundary edges around the whole perimeter, **no back of head**, no shoulders |
| Nefertiti bust (three.js examples)                       | **CC BY-NC** — non-commercial only                                                                                                     |
| Tennyson bust (Three D Scans)                            | Site describes itself as "free" but publishes **no licence terms**                                                                     |
| Walt Disney head (three.js examples)                     | No licence stated; depicts a real, famous person                                                                                       |
| `Head_69.fbx` (three.js examples)                        | No licence stated                                                                                                                      |
| Smithsonian Open Access (CC0) busts                      | Licence suitable, but 3d.si.edu blocks automated access from this environment, so items could not be verified                          |
| Sketchfab CC-BY heads                                    | Download requires an account/API token; licence pages could not be verified from here                                                  |
