"""Shrink the supplied cow and wheat GLB models for the web.

Run: python3 -I optimize_glb.py   (needs numpy + Pillow)
Cow: merge meshes, vertex-cluster decimate, keep base-colour texture only (1024 JPEG).
Wheat: bake transforms, keep base-colour texture only (512 PNG with alpha).
"""
import io, json, struct, sys
import numpy as np
from PIL import Image

SRC = '/mnt/user-data/attachments/5b88520b-4596-523f-b466-931af314f3bd/'
OUT = '/home/claude/naturalbasket/public/models/'

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load(path):
    d = open(path, 'rb').read()
    jl, _ = struct.unpack('<II', d[12:20])
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl, _ = struct.unpack('<II', d[off:off + 8])
    return j, d[off + 8:off + 8 + bl]


def acc(j, b, i):
    a = j['accessors'][i]
    bv = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    dt = np.dtype(CT[a['componentType']])
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride')
    if stride and stride != dt.itemsize * n:
        raw = np.frombuffer(b, dtype=np.uint8, count=stride * a['count'], offset=start).reshape(a['count'], stride)
        return raw[:, :dt.itemsize * n].copy().view(dt).reshape(a['count'], n)
    return np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=start).reshape(a['count'], n)


def image_of(j, b, idx):
    bv = j['bufferViews'][j['images'][idx]['bufferView']]
    o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[o:o + bv['byteLength']]))


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if 'scale' in n:
        m = np.diag(list(n['scale']) + [1]) @ m
    return m


def collect(j, b):
    """All primitives with world transform applied."""
    out = []

    def walk(i, parent):
        n = j['nodes'][i]
        m = parent @ node_matrix(n)
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                pos = acc(j, b, p['attributes']['POSITION']).astype(np.float64)
                uv = acc(j, b, p['attributes']['TEXCOORD_0']).astype(np.float64)
                idx = acc(j, b, p['indices']).reshape(-1).astype(np.int64)
                pos = (np.c_[pos, np.ones(len(pos))] @ m.T)[:, :3]
                out.append((pos, uv, idx))
        for c in n.get('children', []):
            walk(c, m)

    for r in j['scenes'][0]['nodes']:
        walk(r, np.eye(4))
    return out


def merge(parts):
    P, U, F, base = [], [], [], 0
    for pos, uv, idx in parts:
        P.append(pos); U.append(uv); F.append(idx.reshape(-1, 3) + base); base += len(pos)
    return np.vstack(P), np.vstack(U), np.vstack(F)


def cluster(pos, uv, faces, cell, uvbuckets=40):
    q = np.floor((pos - pos.min(0)) / cell).astype(np.int64)
    u = np.clip((uv * uvbuckets).astype(np.int64), 0, uvbuckets)
    key = np.c_[q, u]
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    n = inv.max() + 1
    cnt = np.bincount(inv, minlength=n).astype(np.float64)
    npos = np.zeros((n, 3)); nuv = np.zeros((n, 2))
    for k in range(3):
        npos[:, k] = np.bincount(inv, weights=pos[:, k], minlength=n) / cnt
    for k in range(2):
        nuv[:, k] = np.bincount(inv, weights=uv[:, k], minlength=n) / cnt
    f = inv[faces]
    keep = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])
    f = f[keep]
    # drop duplicate faces
    s = np.sort(f, axis=1)
    _, first = np.unique(s, axis=0, return_index=True)
    f = f[np.sort(first)]
    # drop unused vertices
    used = np.unique(f)
    remap = -np.ones(n, dtype=np.int64); remap[used] = np.arange(len(used))
    return npos[used], nuv[used], remap[f]


def normals(pos, faces):
    a, b, c = pos[faces[:, 0]], pos[faces[:, 1]], pos[faces[:, 2]]
    fn = np.cross(b - a, c - a)
    nn = np.zeros_like(pos)
    for k in range(3):
        np.add.at(nn, faces[:, k], fn)
    ln = np.linalg.norm(nn, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return nn / ln


def write_glb(path, pos, nrm, uv, faces, tex_bytes, tex_mime, material):
    pos = pos.astype(np.float32); nrm = nrm.astype(np.float32); uv = uv.astype(np.float32)
    idx = faces.astype(np.uint16 if len(pos) < 65535 else np.uint32).reshape(-1)
    blobs = []

    def add(data):
        pad = (-len(data)) % 4
        blobs.append(data + b'\0' * pad)
        return len(blobs) - 1

    views = []
    off = 0
    for data, target in [(pos.tobytes(), 34962), (nrm.tobytes(), 34962), (uv.tobytes(), 34962), (idx.tobytes(), 34963), (tex_bytes, None)]:
        i = add(data)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        off += len(blobs[i])
    ct = 5123 if idx.dtype == np.uint16 else 5125
    j = {
        'asset': {'version': '2.0', 'generator': 'natural-basket optimizer'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
        'materials': [material],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': 4, 'mimeType': tex_mime}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
            {'bufferView': 1, 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5126, 'count': len(uv), 'type': 'VEC2'},
            {'bufferView': 3, 'componentType': ct, 'count': len(idx), 'type': 'SCALAR'},
        ],
        'bufferViews': views,
        'buffers': [{'byteLength': off}],
    }
    jb = json.dumps(j, separators=(',', ':')).encode()
    jb += b' ' * ((-len(jb)) % 4)
    bin_ = b''.join(blobs)
    total = 12 + 8 + len(jb) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(jb), b'JSON') + jb)
        f.write(struct.pack('<I4s', len(bin_), b'BIN\0') + bin_)
    print(path, total / 1e3, 'KB', len(pos), 'verts', len(faces), 'tris')


def normalise(pos, length_axis, length):
    pos = pos.copy()
    mn, mx = pos.min(0), pos.max(0)
    k = length / (mx[length_axis] - mn[length_axis])
    pos *= k
    mn, mx = pos.min(0), pos.max(0)
    pos[:, 0] -= (mn[0] + mx[0]) / 2
    pos[:, 2] -= (mn[2] + mx[2]) / 2
    pos[:, 1] -= mn[1]
    return pos


def cow():
    j, b = load(SRC + '40185ea0-brown_cow_3d_model.glb')
    pos, uv, faces = merge(collect(j, b))
    pos = normalise(pos, 2, 2.2)  # long axis is z; 2.2 units nose to tail
    uv = uv.copy()
    # glTF uv origin is top-left, same as stored; keep as is
    target = 22000
    lo, hi = 0.002, 0.08
    for _ in range(18):
        cell = (lo + hi) / 2
        p2, u2, f2 = cluster(pos, uv, faces, cell)
        if len(f2) > target:
            lo = cell
        else:
            hi = cell
    p2, u2, f2 = cluster(pos, uv, faces, hi)
    n2 = normals(p2, f2)
    img = image_of(j, b, 0).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=82, optimize=True)
    write_glb(OUT + 'cow.glb', p2, n2, u2, f2, buf.getvalue(), 'image/jpeg', {
        'name': 'cow', 'doubleSided': True,
        'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85},
    })
    return pos, uv, faces, p2, u2, f2, img


def wheat():
    j, b = load(SRC + 'bf16b9d6-wheat.glb')
    parts = collect(j, b)
    pos, uv, faces = merge(parts)
    pos = normalise(pos, 1, 1.0)  # 1 unit tall; scaled in code
    n = normals(pos, faces)
    img = image_of(j, b, 0).convert('RGBA')
    img.thumbnail((512, 512), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
    write_glb(OUT + 'wheat.glb', pos, n, uv, faces, buf.getvalue(), 'image/png', {
        'name': 'wheat', 'doubleSided': True, 'alphaMode': 'MASK', 'alphaCutoff': 0.5,
        'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.9},
    })


if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    cow()
    wheat()
