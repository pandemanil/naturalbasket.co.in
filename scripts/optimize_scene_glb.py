"""Shrink the landscape, pond and Gir-cow models for the web.

Run from this folder: python3 -I optimize_scene_glb.py
Merges meshes per material, shrinks textures to WebP, and decimates the heavy untextured cow.
"""
import io, json, os, struct
import numpy as np
from PIL import Image
import optimize_glb as o

OUT = o.OUT


def collect_mat(j, b, fix=np.eye(4), thin=None):
    res = {}

    def walk(i, parent):
        n = j['nodes'][i]
        m = parent @ o.node_matrix(n)
        if 'mesh' in n:
            nm = np.linalg.inv(m[:3, :3]).T
            for p in j['meshes'][n['mesh']]['primitives']:
                at = p['attributes']
                pos = o.acc(j, b, at['POSITION']).astype(np.float64)
                nrm = o.acc(j, b, at['NORMAL']).astype(np.float64)
                uv = o.acc(j, b, at['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in at else np.zeros((len(pos), 2))
                idx = o.acc(j, b, p['indices']).reshape(-1).astype(np.int64)
                pos = (np.c_[pos, np.ones(len(pos))] @ m.T)[:, :3]
                nrm = nrm @ nm.T
                res.setdefault(p.get('material', 0), []).append((pos, nrm, uv, idx))
        for c in n.get('children', []):
            walk(c, m)

    for r in j['scenes'][0]['nodes']:
        walk(r, fix)
    out = {}
    for k, parts in res.items():
        if thin and k in thin:
            parts = parts[::thin[k]]
        P, N, U, F, base = [], [], [], [], 0
        for pos, nrm, uv, idx in parts:
            P.append(pos); N.append(nrm); U.append(uv); F.append(idx.reshape(-1, 3) + base); base += len(pos)
        out[k] = (np.vstack(P), np.vstack(N), np.vstack(U), np.vstack(F))
    return out


def write_multi(path, prims, materials, images):
    """prims: [(pos,nrm,uv,faces,material_index)], images: list of (bytes, mime)."""
    blobs, views, off = [], [], 0

    def add(data, target=None):
        nonlocal off
        pad = (-len(data)) % 4
        blobs.append(data + b'\0' * pad)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        off += len(blobs[-1])
        return len(views) - 1

    accessors, primitives = [], []
    for pos, nrm, uv, faces, mat in prims:
        pos = pos.astype(np.float32); nrm = nrm.astype(np.float32); uv = uv.astype(np.float32)
        idx = faces.astype(np.uint16 if len(pos) < 65535 else np.uint32).reshape(-1)
        ids = []
        for data, typ, ct, extra, tgt in [
            (pos.tobytes(), 'VEC3', 5126, {'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()}, 34962),
            (nrm.tobytes(), 'VEC3', 5126, {}, 34962),
            (uv.tobytes(), 'VEC2', 5126, {}, 34962),
            (idx.tobytes(), 'SCALAR', 5123 if idx.dtype == np.uint16 else 5125, {}, 34963),
        ]:
            bv = add(data, tgt)
            cnt = {'VEC3': len(pos), 'VEC2': len(uv), 'SCALAR': len(idx)}[typ]
            accessors.append({'bufferView': bv, 'componentType': ct, 'count': cnt, 'type': typ, **extra})
            ids.append(len(accessors) - 1)
        primitives.append({'attributes': {'POSITION': ids[0], 'NORMAL': ids[1], 'TEXCOORD_0': ids[2]}, 'indices': ids[3], 'material': mat})
    img_defs = []
    for data, mime in images:
        bv = add(data)
        img_defs.append({'bufferView': bv, 'mimeType': mime})
    j = {
        'asset': {'version': '2.0', 'generator': 'natural-basket optimizer'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': primitives}],
        'materials': materials,
        'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': off}],
    }
    if img_defs:
        j['images'] = img_defs
        j['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
        j['textures'] = [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': i}}} for i in range(len(img_defs))]
        j['extensionsUsed'] = ['EXT_texture_webp']
        j['extensionsRequired'] = ['EXT_texture_webp']
    jb = json.dumps(j, separators=(',', ':')).encode()
    jb += b' ' * ((-len(jb)) % 4)
    bin_ = b''.join(blobs)
    total = 12 + 8 + len(jb) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(jb), b'JSON') + jb)
        f.write(struct.pack('<I4s', len(bin_), b'BIN\0') + bin_)
    print(path, round(total / 1e3), 'KB', sum(len(p[3]) for p in prims), 'tris')


def webp(img, size, quality=78):
    img = img.copy()
    img.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue(), 'image/webp'


def multi(src, dst, fix, size_for, skip=(), recentre=True, material_override=None, ground_mat=None, thin=None):
    j, b = o.load(o.SRC + src)
    mats = collect_mat(j, b, fix, thin)
    allpos = np.vstack([v[0] for k, v in mats.items() if k not in skip])
    mn, mx = allpos.min(0), allpos.max(0)
    shift = np.array([-(mn[0] + mx[0]) / 2, 0, -(mn[2] + mx[2]) / 2])
    if ground_mat is not None:
        shift[1] = -mats[ground_mat][0][:, 1].max()
    prims, materials, images, cache = [], [], [], {}
    for k, (pos, nrm, uv, faces) in mats.items():
        if k in skip:
            continue
        gm = j['materials'][k]
        pm = gm.get('pbrMetallicRoughness', {})
        mdef = {'name': gm.get('name', f'm{k}')[:30], 'doubleSided': gm.get('doubleSided', True),
                'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.9}}
        if 'baseColorFactor' in pm:
            mdef['pbrMetallicRoughness']['baseColorFactor'] = pm['baseColorFactor']
        if gm.get('alphaMode') in ('MASK', 'BLEND'):
            mdef['alphaMode'] = gm['alphaMode']
            if gm['alphaMode'] == 'MASK':
                mdef['alphaCutoff'] = gm.get('alphaCutoff', 0.5)
        if 'baseColorTexture' in pm:
            src_img = j['textures'][pm['baseColorTexture']['index']]['source']
            if src_img not in cache:
                im = o.image_of(j, b, src_img)
                im = im.convert('RGBA' if gm.get('alphaMode') == 'MASK' else 'RGB')
                images.append(webp(im, size_for(gm)))
                cache[src_img] = len(images) - 1
            mdef['pbrMetallicRoughness']['baseColorTexture'] = {'index': cache[src_img]}
        if material_override and k in material_override:
            mdef['pbrMetallicRoughness'].update(material_override[k].get('pbr', {}))
            for kk, vv in material_override[k].items():
                if kk != 'pbr':
                    mdef[kk] = vv
        materials.append(mdef)
        nl = np.linalg.norm(nrm, axis=1, keepdims=True); nl[nl == 0] = 1
        prims.append(((pos + shift), nrm / nl, uv, faces, len(materials) - 1))
    write_multi(OUT + dst, prims, materials, images)


def gir():
    j, b = o.load(o.SRC + '613cc2db-tmpoxs8a418.glb')
    p = j['meshes'][0]['primitives'][0]
    pos = o.acc(j, b, p['attributes']['POSITION']).astype(np.float64)
    faces = o.acc(j, b, p['indices']).reshape(-1, 3).astype(np.int64)
    pos = np.c_[-pos[:, 2], pos[:, 1], pos[:, 0]]  # head +x -> +z
    pos = o.normalise(pos, 2, 2.2)
    uv = np.zeros((len(pos), 2))
    lo, hi = 0.002, 0.05
    for _ in range(18):
        cell = (lo + hi) / 2
        p2, u2, f2 = o.cluster(pos, uv, faces, cell, uvbuckets=1)
        if len(f2) > 20000:
            lo = cell
        else:
            hi = cell
    p2, u2, f2 = o.cluster(pos, uv, faces, hi, uvbuckets=1)
    n2 = o.normals(p2, f2)
    write_multi(OUT + 'gir.glb', [(p2, n2, u2, f2, 0)], [{
        'name': 'gir', 'doubleSided': False,
        'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.85},
    }], [])


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    gir()
    multi('68be7f1f-the_landscape_is_a_forest_in_the_mountains_1.glb', 'landscape.glb', np.eye(4),
          size_for=lambda m: 1024 if m.get('alphaMode') != 'MASK' else 512, ground_mat=None)
    zup = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=float)  # z-up -> y-up
    multi('6cbe4542-realistic_water_and_plants.glb', 'pond.glb', zup,
          size_for=lambda m: 512, skip=(2,), ground_mat=0, thin={3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 3, 10: 2},
          material_override={1: {'pbr': {'baseColorFactor': [0.12, 0.38, 0.42, 0.78], 'roughnessFactor': 0.05, 'metallicFactor': 0.1}}})
