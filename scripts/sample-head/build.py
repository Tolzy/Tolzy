#!/usr/bin/env python3
"""
Builds the Portrait Studio sample head (public/models/sample-head/sample-head.glb)
from CC0 MakeHuman assets. See README.md in this folder for sources and licences.

Pipeline
  1. Load the MakeHuman hm08 base mesh (CC0) and apply macro shape targets
     (CC0) for an adult male (~40 years, African ethnicity weights).
  2. Keep the head, neck and upper shoulders as a classical bust cut.
  3. Fit proxies (eyes, eyebrows, eyelashes, hair; all CC0) to the reshaped
     mesh using their .mhclo vertex bindings.
  4. Crop the CC0 skin textures to the head region and build PBR textures.
  5. Write a single binary glTF (GLB) in metres, Y up, facing +Z.

Usage
  python3 -I scripts/sample-head/build.py \
      --makehuman <makehuman repo>/makehuman/data \
      --assets <makehuman_system_assets_cc0 folder> \
      --skins <skins02_cc0 folder> \
      --out public/models/sample-head/sample-head.glb

Requires numpy and Pillow.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

DM_TO_M = 0.1  # MakeHuman units are decimetres
AGE_YEARS = 40.0

# ───────────────────────── OBJ / target / mhclo parsing ─────────────────────────


@dataclass
class Obj:
    v: np.ndarray  # (n, 3)
    vt: np.ndarray  # (m, 2)
    faces: list[tuple[str, list[tuple[int, int]]]] = field(default_factory=list)  # (group, [(vi, ti)])


def read_obj(path: Path) -> Obj:
    v, vt, faces, group = [], [], [], "default"
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            if line.startswith("v "):
                v.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                vt.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                group = line.split(maxsplit=1)[1].strip()
            elif line.startswith("f "):
                corners = []
                for tok in line.split()[1:]:
                    parts = tok.split("/")
                    corners.append((int(parts[0]) - 1, int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1))
                faces.append((group, corners))
    return Obj(np.array(v, dtype=np.float64), np.array(vt, dtype=np.float64), faces)


def read_target(path: Path, n: int) -> np.ndarray:
    delta = np.zeros((n, 3))
    with open(path) as fh:
        for line in fh:
            if line.startswith("#") or not line.strip():
                continue
            i, x, y, z = line.split()
            delta[int(i)] = (float(x), float(y), float(z))
    return delta


def fit_proxy(mhclo: Path, base: np.ndarray) -> tuple[np.ndarray, Path]:
    """Positions proxy vertices on the (morphed) base mesh, as MakeHuman does."""
    refs, scales, obj_file, in_verts = [], {}, None, False
    with open(mhclo, encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if in_verts:
                if len(parts) == 9 and parts[0].lstrip("-").isdigit():
                    refs.append(parts)
                    continue
                if len(parts) == 1 and parts[0].isdigit():
                    refs.append([parts[0], parts[0], parts[0], "1", "0", "0", "0", "0", "0"])
                    continue
                in_verts = False
            if parts[0] == "obj_file":
                obj_file = mhclo.parent / parts[1]
            elif parts[0] in ("x_scale", "y_scale", "z_scale"):
                scales["xyz".index(parts[0][0])] = (int(parts[1]), int(parts[2]), float(parts[3]))
            elif parts[0] == "verts":
                in_verts = True
    s = np.array([abs(base[a][axis] - base[b][axis]) / den for axis, (a, b, den) in sorted(scales.items())])
    r = np.array([[int(x) for x in p[:3]] for p in refs])
    w = np.array([[float(x) for x in p[3:6]] for p in refs])
    d = np.array([[float(x) for x in p[6:9]] for p in refs])
    coords = (base[r] * w[..., None]).sum(axis=1) + d * s
    assert obj_file is not None
    return coords, obj_file


# ───────────────────────── geometry helpers ─────────────────────────


def triangulate(corners: list[tuple[int, int]]) -> list[list[tuple[int, int]]]:
    return [[corners[0], corners[i], corners[i + 1]] for i in range(1, len(corners) - 1)]


def vertex_normals(pos: np.ndarray, tris: np.ndarray) -> np.ndarray:
    n = np.zeros_like(pos)
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    fn = np.cross(b - a, c - a)  # area-weighted
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    length = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.maximum(length, 1e-12)


@dataclass
class Prim:
    name: str
    positions: np.ndarray
    normals: np.ndarray
    uvs: np.ndarray
    indices: np.ndarray
    material: int


def build_prim(name, pos, normals, vt, tri_corners, material, uv_transform=None) -> Prim:
    """Splits vertices on UV seams (keeping smooth normals from the position index)."""
    key_to_index: dict[tuple[int, int], int] = {}
    out_p, out_n, out_t, idx = [], [], [], []
    for tri in tri_corners:
        for vi, ti in tri:
            key = (vi, ti)
            k = key_to_index.get(key)
            if k is None:
                k = len(out_p)
                key_to_index[key] = k
                out_p.append(pos[vi])
                out_n.append(normals[vi])
                u, v = vt[ti]
                out_t.append(uv_transform(u, v) if uv_transform else (u, 1.0 - v))
            idx.append(k)
    return Prim(
        name,
        np.array(out_p, np.float32),
        np.array(out_n, np.float32),
        np.array(out_t, np.float32),
        np.array(idx, np.uint32),
        material,
    )


# ───────────────────────── textures ─────────────────────────


def encode(img: Image.Image, fmt: str, quality=90, palette=False) -> bytes:
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True, progressive=False)
    else:
        if palette:  # 256-colour palette with alpha: much smaller, visually identical here
            img = img.convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def darken_iris(img: Image.Image) -> Image.Image:
    """Shifts the source texture's chestnut-red iris to a darker, natural brown."""
    rgba = img.convert("RGBA")
    hsv = np.asarray(rgba.convert("RGB").convert("HSV")).astype(np.float32)
    h, s_, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    iris = (s_ > 90) & ((h < 22) | (h > 235))  # saturated reds (PIL hue is 0–255)
    h[iris] = 17  # ~24°: warm umber
    s_[iris] *= 0.78
    v[iris] *= 0.62
    rgb = Image.fromarray(np.stack([h, s_, v], -1).astype(np.uint8), "HSV").convert("RGB")
    out = rgb.convert("RGBA")
    out.putalpha(rgba.getchannel("A"))
    return out


def max_side(img: Image.Image, size: int) -> Image.Image:
    if max(img.size) <= size:
        return img
    scale = size / max(img.size)
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


# ───────────────────────── glTF writer ─────────────────────────


class Gltf:
    def __init__(self) -> None:
        self.bin = bytearray()
        self.doc: dict = {
            "asset": {
                "version": "2.0",
                "generator": "portrait-studio scripts/sample-head/build.py",
                "copyright": "CC0 1.0 — derived from MakeHuman assets (makehumancommunity.org)",
            },
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [],
            "meshes": [],
            "materials": [],
            "textures": [],
            "images": [],
            "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
            "accessors": [],
            "bufferViews": [],
            "buffers": [],
        }

    def _view(self, data: bytes, target: int | None = None) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.bin.extend(data)
        self.doc["bufferViews"].append(view)
        return len(self.doc["bufferViews"]) - 1

    def accessor(self, arr: np.ndarray, kind: str, minmax=False) -> int:
        is_index = kind == "SCALAR"
        if is_index:
            arr = arr.astype(np.uint16 if arr.max() < 65535 else np.uint32)
        comp = {np.dtype(np.float32): 5126, np.dtype(np.uint16): 5123, np.dtype(np.uint32): 5125}[arr.dtype]
        view = self._view(arr.tobytes(), 34963 if is_index else 34962)
        acc = {"bufferView": view, "componentType": comp, "count": int(len(arr)), "type": kind}
        if minmax:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        self.doc["accessors"].append(acc)
        return len(self.doc["accessors"]) - 1

    def texture(self, data: bytes, mime: str) -> int:
        view = self._view(data)
        self.doc["images"].append({"bufferView": view, "mimeType": mime})
        self.doc["textures"].append({"source": len(self.doc["images"]) - 1, "sampler": 0})
        return len(self.doc["textures"]) - 1

    def material(self, mat: dict) -> int:
        self.doc["materials"].append(mat)
        return len(self.doc["materials"]) - 1

    def add_prims(self, prims: list[Prim], root_name: str) -> None:
        children = []
        for p in prims:
            prim = {
                "attributes": {
                    "POSITION": self.accessor(p.positions, "VEC3", minmax=True),
                    "NORMAL": self.accessor(p.normals, "VEC3"),
                    "TEXCOORD_0": self.accessor(p.uvs, "VEC2"),
                },
                "indices": self.accessor(p.indices, "SCALAR"),
                "material": p.material,
            }
            self.doc["meshes"].append({"name": p.name, "primitives": [prim]})
            self.doc["nodes"].append({"name": p.name, "mesh": len(self.doc["meshes"]) - 1})
            children.append(len(self.doc["nodes"]) - 1)
        self.doc["nodes"].insert(0, {"name": root_name, "children": [c + 1 for c in children]})

    def write(self, path: Path) -> None:
        self.doc["buffers"] = [{"byteLength": len(self.bin)}]
        js = json.dumps(self.doc, separators=(",", ":")).encode()
        js += b" " * ((4 - len(js) % 4) % 4)
        binary = bytes(self.bin) + b"\0" * ((4 - len(self.bin) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(binary)
        with open(path, "wb") as fh:
            fh.write(struct.pack("<III", 0x46546C67, 2, total))
            fh.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
            fh.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


# ───────────────────────── bust cut ─────────────────────────

BASE_MATERIAL = {
    "name": "Base",
    "pbrMetallicRoughness": {"baseColorFactor": [0.16, 0.12, 0.1, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.9},
}

Corner = tuple[np.ndarray, np.ndarray, np.ndarray]  # position, normal, uv


def clip_polygon(poly: list[Corner], fn) -> list[Corner]:
    """Sutherland–Hodgman clip against fn(p) >= 0, bisecting for non-linear surfaces."""
    out: list[Corner] = []
    for i, a in enumerate(poly):
        b = poly[(i + 1) % len(poly)]
        fa, fb = fn(a[0]), fn(b[0])
        if fa >= 0:
            out.append(a)
        if (fa >= 0) != (fb >= 0):
            lo, hi = 0.0, 1.0  # a side is inside at lo when fa >= 0
            for _ in range(24):
                mid = (lo + hi) / 2
                fm = fn(a[0] + (b[0] - a[0]) * mid)
                if (fm >= 0) == (fa >= 0):
                    lo = mid
                else:
                    hi = mid
            t = (lo + hi) / 2
            out.append(tuple(a[k] + (b[k] - a[k]) * t for k in range(3)))  # type: ignore[arg-type]
    return out


def ear_clip(poly: np.ndarray) -> list[tuple[int, int, int]]:
    """Triangulates a simple 2D polygon (n, 2) by ear clipping. Returns index triples."""
    idx = list(range(len(poly)))
    area = 0.5 * sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in idx)
    if area < 0:
        idx.reverse()  # make counter-clockwise

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside_tri(p, a, b, c):
        return cross(a, b, p) >= 0 and cross(b, c, p) >= 0 and cross(c, a, p) >= 0

    out: list[tuple[int, int, int]] = []
    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if cross(a, b, c) <= 1e-12:
                continue  # reflex or degenerate corner
            if any(inside_tri(poly[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            out.append((i0, i1, i2))
            idx.pop(k)
            break
        else:
            break  # no ear found (degenerate input): stop rather than loop
    if len(idx) == 3:
        out.append((idx[0], idx[1], idx[2]))
    return out


def build_clipped_skin(coords, normals, vt, kept, crossing, planes, uv_fn, skin_mat, base_mat) -> tuple[Prim, Prim]:
    """Skin mesh clipped exactly on the cut surface, plus a cap closing the section."""
    tris: list[list[Corner]] = []

    def corner(vi: int, ti: int) -> Corner:
        u, v = vt[ti]
        return (coords[vi].copy(), normals[vi].copy(), np.array(uv_fn(u, v)))

    for t in kept:
        tris.append([corner(vi, ti) for vi, ti in t])
    for t in crossing:
        poly = [corner(vi, ti) for vi, ti in t]
        for fn in planes:
            poly = clip_polygon(poly, fn)
            if len(poly) < 3:
                break
        for i in range(1, len(poly) - 1):
            tris.append([poly[0], poly[i], poly[i + 1]])

    # Weld identical corners.
    index: dict[tuple, int] = {}
    pos, nrm, uvs, idx = [], [], [], []
    for tri in tris:
        for p, n, uv in tri:
            key = (*np.round(p, 5), *np.round(uv, 5))
            k = index.get(key)
            if k is None:
                k = len(pos)
                index[key] = k
                pos.append(p)
                nrm.append(n / max(np.linalg.norm(n), 1e-12))
                uvs.append(uv)
            idx.append(k)
    P = np.array(pos)

    # Boundary edges lying on the cut form the section outline. Topology is
    # traced on positions only, so UV seams do not split the outline.
    pos_id: dict[tuple, int] = {}
    canon = np.array([pos_id.setdefault(tuple(np.round(p, 5)), k) for k, p in enumerate(P)])
    I = canon[np.array(idx)].reshape(-1, 3)
    edges: dict[tuple[int, int], int] = {}
    for a, b, c in I:
        for e in ((a, b), (b, c), (c, a)):
            edges[tuple(sorted(e))] = edges.get(tuple(sorted(e)), 0) + 1

    def on_cut(k: int) -> bool:
        return min(abs(fn(P[k])) for fn in planes) < 1e-3

    boundary = [e for e, count in edges.items() if count == 1 and on_cut(e[0]) and on_cut(e[1])]
    nbrs: dict[int, list[int]] = {}
    for a, b in boundary:
        nbrs.setdefault(a, []).append(b)
        nbrs.setdefault(b, []).append(a)

    loops, seen = [], set()
    for start in nbrs:
        if start in seen:
            continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            nxt = [n for n in nbrs[cur] if n != prev and n not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            seen.add(cur)
            loop.append(cur)
        if len(loop) >= 3:
            loops.append(loop)

    # Close each outline with a flat cap, triangulated by ear clipping in the
    # cut plane (the chest cross-section is not convex, so a fan would overlap).
    cap_pos: list[np.ndarray] = []
    cap_idx: list[int] = []
    for loop in loops:
        base_i = len(cap_pos)
        cap_pos.extend(P[loop])
        tris2d = ear_clip(P[loop][:, [0, 2]])
        for t in tris2d:
            a_, b_, c_ = (base_i + k for k in t)
            n_ = np.cross(cap_pos[b_] - cap_pos[a_], cap_pos[c_] - cap_pos[a_])
            cap_idx.extend([a_, b_, c_] if n_[1] < 0 else [a_, c_, b_])  # face down, out of the bust
    CP = np.array(cap_pos)
    CI = np.array(cap_idx).reshape(-1, 3)
    CN = vertex_normals(CP, CI)

    skin = Prim(
        "Skin",
        (P * DM_TO_M).astype(np.float32),
        np.array(nrm, np.float32),
        np.array(uvs, np.float32),
        np.array(idx, np.uint32),
        skin_mat,
    )
    cap = Prim(
        "Base",
        (CP * DM_TO_M).astype(np.float32),
        CN.astype(np.float32),
        np.zeros((len(CP), 2), np.float32),
        CI.reshape(-1).astype(np.uint32),
        base_mat,
    )
    expected = sum(len(lp) - 2 for lp in loops)
    print(f"bust section: {len(loops)} outline loop(s), {len(CI)}/{expected} cap triangles")
    return skin, cap


# ───────────────────────── main ─────────────────────────


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--makehuman", type=Path, required=True)
    ap.add_argument("--assets", type=Path, required=True)
    ap.add_argument("--skins", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--cut-depth", type=float, default=3.2, help="bust cut, decimetres below the crown")
    args = ap.parse_args()

    base = read_obj(args.makehuman / "3dobjs/base.obj")
    n = len(base.v)

    # Macro targets: male, African, ~40 years, average muscle and weight.
    # MakeHuman age slider: 0.5 = 25 years, 1.0 = 90 years.
    age = 0.5 + (AGE_YEARS - 25) / (90 - 25) * 0.5
    old = (age - 0.5) / 0.5
    young = 1 - old
    macro = args.makehuman / "targets/macrodetails"
    coords = base.v.copy()
    for name, weight in [
        ("african-male-young", young),
        ("african-male-old", old),
        ("universal-male-young-averagemuscle-averageweight", young),
        ("universal-male-old-averagemuscle-averageweight", old),
    ]:
        coords += weight * read_target(macro / f"{name}.target", n)

    # Bust cut: a single horizontal plane, like a classical bust with a flat
    # base. The section then faces straight down and cannot be seen from the
    # front, three-quarter or side views. (An earlier curved cut that rose
    # towards the shoulders exposed its cap at ~20°+ of rotation.)
    body_faces = [c for g, c in base.faces if g == "body"]
    body_tris = [t for c in body_faces for t in triangulate(c)]
    tri_v = np.array([[vi for vi, _ in t] for t in body_tris])
    normals = vertex_normals(coords, tri_v)
    body_idx = np.unique(tri_v)
    crown_y = coords[body_idx][:, 1].max()
    cut_y = crown_y - args.cut_depth

    def cut_value(p: np.ndarray) -> float:
        """>= 0 inside the bust (above the cut plane)."""
        return p[1] - cut_y

    cut_planes = [cut_value]

    def inside(vi: int) -> bool:
        return all(fn(coords[vi]) >= 0 for fn in cut_planes)

    kept = [t for t in body_tris if all(inside(vi) for vi, _ in t)]
    crossing = [t for t in body_tris if any(inside(vi) for vi, _ in t) and not all(inside(vi) for vi, _ in t)]

    # Skin textures, cropped to the UVs actually used.
    skin_dir = args.skins / "skins/mindfront_skin_male_african_middleage"
    diffuse = Image.open(skin_dir / "skin_male_african_middleage.png").convert("RGB")
    normal_map = Image.open(skin_dir / "skin_male_african_middleage_NRM.png").convert("RGB")
    spec = Image.open(skin_dir / "skin_male_african_middleage_SPEC.png").convert("L")
    W, H = diffuse.size
    used_t = np.array([base.vt[ti] for t in kept for _, ti in t])
    pad = 12
    x0 = max(0, int(np.floor(used_t[:, 0].min() * W)) - pad)
    x1 = min(W, int(np.ceil(used_t[:, 0].max() * W)) + pad)
    y0 = max(0, int(np.floor((1 - used_t[:, 1].max()) * H)) - pad)
    y1 = min(H, int(np.ceil((1 - used_t[:, 1].min()) * H)) + pad)
    if (x1 - x0) * (y1 - y0) > 0.8 * W * H:
        x0, y0, x1, y1 = 0, 0, W, H  # cropping would save little; keep power-of-two textures
    box = (x0, y0, x1, y1)
    cw, ch = x1 - x0, y1 - y0

    def skin_uv(u: float, v: float) -> tuple[float, float]:
        return ((u * W - x0) / cw, ((1 - v) * H - y0) / ch)

    # Roughness from the specular map: brighter spec = smoother skin.
    spec_arr = np.asarray(spec.crop(box), dtype=np.float32) / 255.0
    rough = np.clip(0.72 - 0.38 * spec_arr, 0.32, 0.9)
    orm = np.zeros((*rough.shape, 3), np.uint8)
    orm[..., 0] = 255  # occlusion: none
    orm[..., 1] = (rough * 255).astype(np.uint8)  # roughness
    orm_img = Image.fromarray(orm, "RGB")

    g = Gltf()
    t_diffuse = g.texture(encode(diffuse.crop(box), "JPEG", 90), "image/jpeg")
    t_normal = g.texture(encode(normal_map.crop(box), "JPEG", 86), "image/jpeg")
    t_orm = g.texture(encode(max_side(orm_img, 1024), "JPEG", 88), "image/jpeg")
    m_skin = g.material(
        {
            "name": "Skin",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": t_diffuse},
                "metallicFactor": 0.0,
                "roughnessFactor": 1.0,
                "metallicRoughnessTexture": {"index": t_orm},
            },
            "normalTexture": {"index": t_normal, "scale": 0.7},
        }
    )

    skin_prim, cap_prim = build_clipped_skin(
        coords, normals, base.vt, kept, crossing, cut_planes, skin_uv, m_skin, g.material(BASE_MATERIAL)
    )
    prims = [skin_prim, cap_prim]

    # Proxies fitted to the reshaped body.
    def proxy(
        name: str, mhclo: Path, tex: Path, material: dict, tex_size: int, fmt: str, flip=False, adjust=None
    ) -> None:
        pcoords, obj_path = fit_proxy(mhclo, coords)
        obj = read_obj(obj_path)
        tris = [t for _, c in obj.faces for t in triangulate(c)]
        if flip:
            tris = [[t[0], t[2], t[1]] for t in tris]
        pn = vertex_normals(pcoords, np.array([[vi for vi, _ in t] for t in tris]))
        img = max_side(Image.open(tex), tex_size)
        if adjust:
            img = adjust(img)
        if fmt == "JPEG":
            tid = g.texture(encode(img, "JPEG", 90), "image/jpeg")
        else:
            tid = g.texture(encode(img.convert("RGBA"), "PNG", palette=True), "image/png")
        material.setdefault("pbrMetallicRoughness", {})["baseColorTexture"] = {"index": tid}
        material["pbrMetallicRoughness"].setdefault("metallicFactor", 0.0)
        mid = g.material(material)
        prims.append(build_prim(name, pcoords * DM_TO_M, pn, obj.vt, tris, mid))

    a = args.assets
    # The eye texture's transparent region forms the cornea shell, so alpha must be kept.
    proxy(
        "Eyes",
        a / "eyes/high-poly/high-poly.mhclo",
        a / "eyes/materials/brown_eye.png",
        {
            "name": "Eyes",
            "alphaMode": "BLEND",
            "pbrMetallicRoughness": {"roughnessFactor": 0.08, "baseColorFactor": [0.86, 0.84, 0.82, 1.0]},
        },
        512,
        "PNG",
        adjust=darken_iris,
    )
    proxy(
        "Eyebrows",
        a / "eyebrows/eyebrow001/eyebrow001.mhclo",
        a / "eyebrows/eyebrow001/eyebrow001.png",
        {
            "name": "Eyebrows",
            "alphaMode": "BLEND",
            "doubleSided": True,
            "pbrMetallicRoughness": {"roughnessFactor": 0.85, "baseColorFactor": [1.0, 1.0, 1.0, 0.85]},
        },
        256,
        "PNG",
    )
    proxy(
        "Eyelashes",
        a / "eyelashes/eyelashes02/eyelashes02.mhclo",
        a / "eyelashes/eyelashes02/eyelashes02.png",
        {
            "name": "Eyelashes",
            "alphaMode": "BLEND",
            "doubleSided": True,
            "pbrMetallicRoughness": {"roughnessFactor": 0.85, "baseColorFactor": [1.0, 1.0, 1.0, 0.7]},
        },
        256,
        "PNG",
    )
    proxy(
        "Hair",
        a / "hair/short01/short01.mhclo",
        a / "hair/short01/short01_diffuse.png",
        {
            "name": "Hair",
            "alphaMode": "MASK",
            "alphaCutoff": 0.45,
            "doubleSided": True,
            "pbrMetallicRoughness": {"roughnessFactor": 0.75, "baseColorFactor": [0.55, 0.5, 0.48, 1.0]},
        },
        1024,
        "PNG",
    )

    # Recentre: bust base at y = 0, centred on x/z of the skin.
    skin = prims[0].positions
    offset = np.array(
        [-(skin[:, 0].min() + skin[:, 0].max()) / 2, -skin[:, 1].min(), -(skin[:, 2].min() + skin[:, 2].max()) / 2],
        np.float32,
    )
    for p in prims:
        p.positions = p.positions + offset

    g.add_prims(prims, "SampleHead")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    g.write(args.out)

    tris = sum(len(p.indices) // 3 for p in prims)
    verts = sum(len(p.positions) for p in prims)
    size = args.out.stat().st_size
    bbox = np.concatenate([p.positions for p in prims])
    print(f"wrote {args.out} — {size / 1024:.0f} KB, {tris} triangles, {verts} vertices")
    print("bbox (m):", bbox.min(axis=0).round(3).tolist(), bbox.max(axis=0).round(3).tolist())
    print("skin texture crop:", box, f"{cw}x{ch}")


if __name__ == "__main__":
    main()
