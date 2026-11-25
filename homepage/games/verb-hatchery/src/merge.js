// Static batches: everything that never moves (trees, rocks, props, the house …)
// is baked into a few big meshes, so a view costs a handful of draw calls instead
// of one per model part.
//  - Colours are baked into vertex colours (material colour × the palette texture
//    sampled at the vertex), so all models share ONE material. A mesh whose texture
//    is a real picture (checked per triangle) keeps its texture and its own bucket.
//  - The Quaternius models (trees with cut-out leaves, textured rocks …) come from
//    one pack with one texture atlas; that atlas is the shared material's texture.
//  - The island is cut into square cells (CELL metres); each cell gets its own mesh,
//    so cells outside the view or the shadow box are culled as a whole.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CELL = 48;
const OFF = { x: 24, z: -14 }; // the grid is shifted so the home base sits in the middle of a cell
const cellOf = (x, z) => [Math.floor((x + OFF.x) / CELL), Math.floor((z + OFF.z) / CELL)];
const cellCentre = (ix, iz) => [(ix + 0.5) * CELL - OFF.x, (iz + 0.5) * CELL - OFF.z];

const toLinear = (() => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; t[i] = c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); } return t; })();
const pixelCache = new Map(); // texture source → { w, h, data } | null
function pixels(map) {
  const key = map.source?.uuid || map.uuid;
  if (pixelCache.has(key)) return pixelCache.get(key);
  let out = null;
  try {
    const img = map.image, w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    out = { w, h, data: x.getImageData(0, 0, w, h).data, flip: map.flipY };
  } catch (_) { /* unreadable: the mesh keeps its texture */ }
  pixelCache.set(key, out);
  return out;
}
const wrap = (v) => v - Math.floor(v);
function sample(px, u, v, out) {
  const x = Math.min(px.w - 1, Math.floor(wrap(u) * px.w)), y = Math.min(px.h - 1, Math.floor((px.flip ? 1 - wrap(v) : wrap(v)) * px.h));
  const i = (y * px.w + x) * 4;
  out[0] = px.data[i]; out[1] = px.data[i + 1]; out[2] = px.data[i + 2];
}

// The ONE lit material all baked meshes share: vertex colours × the Quaternius atlas
// (assets/qnature/atlas.webp, set by setAtlas). Geometry without a texture has uv
// (0, 0), a white opaque texel, so trees with cut-out leaves, textured rocks and
// plain painted props all sit in the same mesh. Double-sided because leaf cards are;
// normals are NOT flipped on back faces (the crowns use soft "ball" normals, and
// closed models never show a back face).
const shared = {};
let atlas = null;
// See-through (owner, 2026-11-23: "the leaves often block my view and I can't see my
// player anymore"): what lies between the camera and the player, inside a tube around
// that line, is not drawn (dithered at the tube's edge). main / world set `player`
// every frame. Only the camera's picture is cut: the shadow pass uses its own depth
// material, so a tree with a hole in it still throws its whole shadow.
export const seeThrough = { player: { value: new THREE.Vector3(0, -1e4, 0) } };
// Wind (world step 4): leaves, grass, palms and banners sway. Every vertex carries
// `aSway` = (bend, flutter): bend = how far it leans with the gusts (0–1 = 0–0.5 m; grows
// with the height above the plant's foot, so trunks stay rooted), flutter = how much it
// trembles on its own (0–1 = 0–0.25 m; leaves, palm fronds, cloth). Rocks, buildings and
// props have (0, 0). The weights are written when a model is placed (setSway below);
// the vertex shader moves the vertex. The same lines run in the shadow pass
// (windDepthMat), so the shadows on the ground sway with the crowns, and before the
// see-through test, so the hole follows the leaves. world.update sets wind.time.
export const wind = { time: { value: 0 }, k: { value: 1 } };
const WIND_PARS = '#include <common>\nattribute vec2 aSway;\nuniform float uWindT, uWindK;';
const WIND_VERT = `#include <begin_vertex>
  {
    vec4 swW = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      swW = instanceMatrix * swW;
    #endif
    swW = modelMatrix * swW;
    // gusts run over the island as slow waves: plants lean with the wind and swing back
    float swA = uWindT * 0.8 - dot( swW.xz, vec2( 0.050, 0.036 ) );
    float swG = 0.45 + 0.4 * sin( swA ) + 0.15 * sin( swA * 2.3 + 1.7 );
    float swF1 = sin( uWindT * 3.3 + swW.x * 1.9 + swW.y * 2.7 ), swF2 = sin( uWindT * 2.6 + swW.z * 2.3 - swW.y * 1.3 );
    vec3 swV = vec3( 0.8, 0.0, 0.6 ) * ( aSway.x * 0.5 * swG ) + vec3( swF1, 0.4 * swF1 * swF2, swF2 ) * ( aSway.y * 0.25 * ( 0.55 + 0.45 * swG ) );
    swV *= uWindK;
    #ifdef USE_INSTANCING
      // (into the instance's own space; the result scales with the instance, so small tufts move less)
      swV = ( swV * mat3( instanceMatrix ) ) / length( instanceMatrix[ 0 ].xyz );
    #endif
    transformed += swV;
  }`;
function addWind(sh) {
  sh.uniforms.uWindT = wind.time; sh.uniforms.uWindK = wind.k;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', WIND_PARS).replace('#include <begin_vertex>', WIND_VERT);
}
// the shadow pass of the static world: the same sway (three copies map / alphaTest /
// side from the lit material onto it for every draw)
let _depth = null;
export function windDepthMat() {
  if (_depth) return _depth;
  _depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  _depth.onBeforeCompile = addWind;
  _depth.customProgramCacheKey = () => 'bakedDepthWind';
  return _depth;
}
function bakedMat(glow, see = true, sway = see) {
  const k = `${glow}|${see}|${sway}`;
  if (shared[k]) return shared[k];
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.shadowSide = THREE.DoubleSide;
  if (atlas) { m.map = atlas; m.alphaTest = 0.42; }
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );\nvec3 nonPerturbedNormal = normal;');
    // glowing things (crystals): the vertex colour also shines by itself
    if (sway) addWind(sh);
    if (glow) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(2)};`);
    if (see) {
      sh.uniforms.uSeePlayer = seeThrough.player;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;') // (after addWind: '#include <common>' is still its first line)
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 seeW = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            seeW = instanceMatrix * seeW;
          #endif
          vSeeW = ( modelMatrix * seeW ).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSeePlayer;\nvarying vec3 vSeeW;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          {
            vec3 seeAB = uSeePlayer - cameraPosition; float seeL = length( seeAB ); vec3 seeD = seeAB / max( seeL, 0.001 );
            float seeT = dot( vSeeW - cameraPosition, seeD );
            if ( seeT > 0.0 && seeT < seeL - 0.7 ) {
              // the tube: wide at the camera (a whole crown in front of the lens goes), narrower at the player
              float seeR = length( vSeeW - cameraPosition - seeD * seeT ) / mix( 2.3, 1.25, seeT / seeL );
              float seeN = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
              if ( seeR < 0.72 + 0.28 * seeN ) discard;
            }
          }`);
    }
  };
  m.customProgramCacheKey = () => `baked${k}`;
  return (shared[k] = m);
}
// (for things that are not part of the static world: crabs, pens, the wind wheel)
export const paintMat = () => bakedMat(0, false);
// (the grass near the player: no see-through, but it sways)
export const swayMat = () => bakedMat(0, false, true);

// Which pack models sway, and how. (Dead trees, mushrooms, vines, crops on stakes: no.)
const SWAY = [[/^(CommonTree|Pine|TwistedTree)/, 'tree'], [/^Bush/, 'bush'], [/^(Grass|Fern|Clover|Plant|Flower|Crop_Wheat|Crop_Corn)/, 'plant'], [/^Banner/, 'cloth']];
export const swayKind = (name) => { for (const [re, k] of SWAY) if (re.test(name)) return k; return null; };
// Write the sway weights of one placed model: `g` in world orientation, y0 = its foot,
// H = its height (metres). On entry aSway.y marks foliage (set by paintQ). kind null = none.
export function setSway(g, kind, y0 = 0, H = 1) {
  const p = g.attributes.position, a = g.attributes.aSway.array, n = p.count;
  if (!kind) { a.fill(0); return g; }
  for (let i = 0; i < n; i++) {
    const rel = Math.min(1, Math.max(0, (p.getY(i) - y0) / H)), fol = a[i * 2 + 1] > 127;
    let bend = 0, fl = 0;
    if (kind === 'tree') { bend = Math.min(0.3, 0.02 * H) * rel * rel; fl = fol ? 0.07 : 0; }           // the whole tree leans a little, its leaves rustle
    else if (kind === 'bush') { bend = 0.05 * rel; fl = fol ? 0.05 : 0; }
    else if (kind === 'plant') { bend = Math.min(0.22, 0.22 * H) * rel * rel; fl = 0.03 * rel; }
    else if (kind === 'cloth') { bend = 0.1 * (1 - rel); fl = 0.06 * (1 - rel); }                        // hangs from its top edge
    else if (kind === 'palm') { const t = Math.min(1, Math.max(0, (rel - 0.6) / 0.35)); bend = Math.min(0.32, 0.034 * H) * rel * rel; fl = 0.1 * t * t * (3 - 2 * t); } // the fronds are the top third
    else if (kind === 'buoy') { bend = 0.16 * (rel - 0.25); bend = Math.max(0, bend); }                  // rocks on the swell
    a[i * 2] = Math.round(Math.min(1, bend / 0.5) * 255); a[i * 2 + 1] = Math.round(Math.min(1, fl / 0.25) * 255);
  }
  return g;
}
export function setAtlas(tex) {
  atlas = tex;
  for (const m of Object.values(shared)) { m.map = tex; m.alphaTest = 0.42; m.needsUpdate = true; }
}

// A copy of `geometry` with position, normal and a colour per vertex (no uv), indexed.
export function paint(geometry, hex, flat = false) {
  let g = geometry.clone();
  if (flat && g.index) { g = g.toNonIndexed(); g.computeVertexNormals(); }
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  return finish(g, col);
}
// → position + normal (floats), color, uv (atlas coordinates, 16 bit; zeros = white texel),
// aSway (wind weights, 8 bit; zeros = stands still)
function finish(g, col, uv = null, sway = null) {
  if (!sway && g.attributes.aSway) sway = g.attributes.aSway.array;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  for (const k of ['position', 'normal']) { // plain float attributes (some files pack them)
    const a = g.attributes[k];
    if (a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array) || a.normalized) {
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(k, new THREE.BufferAttribute(f, 3));
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv || new Uint16Array(g.attributes.position.count * 2), 2, true));
  g.setAttribute('aSway', new THREE.BufferAttribute(sway || new Uint8Array(g.attributes.position.count * 2), 2, true));
  if (!g.index) { const n = g.attributes.position.count, idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(idx); }
  g.morphAttributes = {}; g.clearGroups();
  return g;
}
// A Quaternius pack model (src/qnature.js) as batch geometry. tint = the colour of its
// foliage (leaf crowns, grass, banner cloth); mul multiplies everything.
const _c = new THREE.Color();
export function paintQ(model, tint = 0xffffff, mul = 0xffffff) {
  const src = model.geo, n = src.attributes.position.count, sc = src.attributes.color, col = new Float32Array(n * 3), fol = new Uint8Array(n * 2);
  // (tint as [r, g, b] may go over 1: the pack's grass is green, wheat needs more than white)
  const t = Array.isArray(tint) ? new THREE.Color().setRGB(tint[0], tint[1], tint[2]) : new THREE.Color(tint), m = new THREE.Color(mul);
  for (let i = 0; i < n; i++) {
    _c.setRGB(sc.getX(i), sc.getY(i), sc.getZ(i), THREE.SRGBColorSpace);
    if (sc.getW(i) < 0.5) { _c.multiply(t); fol[i * 2 + 1] = 255; } // (foliage: marked for setSway)
    col[i * 3] = _c.r * m.r; col[i * 3 + 1] = _c.g * m.g; col[i * 3 + 2] = _c.b * m.b;
  }
  const uv = Uint16Array.from(src.attributes.uv.array);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.attributes.position.clone()); g.setAttribute('normal', src.attributes.normal.clone());
  g.setIndex(src.index.clone());
  return finish(g, col, uv, fol);
}

export class StaticBatch {
  constructor(scene) {
    this.scene = scene;
    this.buckets = new Map();  // key → { geos, mesh, dirty, mat, ix, iz }
    this.baked = new Map();    // geometry + material (+ options) → baked geometry in model space
    this.texMats = new Map();
    this.meshes = [];
  }
  // Bake one mesh's geometry in model space → { geo, mat }.
  _bake(geometry, material, o) {
    material = Array.isArray(material) ? material[0] : material;
    const key = `${geometry.uuid}|${material.uuid}|${o.color ?? ''}|${o.mul ?? ''}|${o.glow ?? 0}`;
    if (this.baked.has(key)) return this.baked.get(key);
    let g = geometry.clone();
    if (material.flatShading && g.index) { g = g.toNonIndexed(); g.deleteAttribute('normal'); }
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const base = material.color ? material.color.clone() : new THREE.Color(1, 1, 1);
    if (o.mul !== undefined) base.multiply(new THREE.Color(o.mul));
    const uv = g.attributes.uv, px = material.map && uv && o.color === undefined ? pixels(material.map) : null;
    const vc = material.vertexColors ? g.attributes.color : null;
    let ok = !(material.map && uv && o.color === undefined) || !!px;
    if (px) {
      // is the texture a palette (each triangle one colour or a smooth blend)? compare
      // the middle of every triangle with the mean of its corners
      const s = new Uint8Array(n * 3), t = [0, 0, 0], idx = g.index;
      for (let i = 0; i < n; i++) { sample(px, uv.getX(i), uv.getY(i), t); s[i * 3] = t[0]; s[i * 3 + 1] = t[1]; s[i * 3 + 2] = t[2]; }
      const tris = (idx ? idx.count : n) / 3;
      for (let f = 0; f < tris && ok; f++) {
        const a = idx ? idx.getX(f * 3) : f * 3, b = idx ? idx.getX(f * 3 + 1) : f * 3 + 1, c = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
        sample(px, (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3, t);
        for (let k = 0; k < 3; k++) if (Math.abs(t[k] - (s[a * 3 + k] + s[b * 3 + k] + s[c * 3 + k]) / 3) > 20) ok = false;
      }
      if (ok) for (let i = 0; i < n * 3; i++) col[i] = toLinear[s[i]] * (i % 3 === 0 ? base.r : i % 3 === 1 ? base.g : base.b);
    }
    let res;
    if (!ok) {
      // a real picture: keep the texture (own bucket per source material)
      if (!this.texMats.has(material.uuid)) this.texMats.set(material.uuid, material);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.index) { const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(idx); }
      res = { geo: g, mat: `tex:${material.uuid}` };
    } else {
      if (!px) {
        const c = o.color !== undefined ? new THREE.Color(o.color) : base;
        for (let i = 0; i < n; i++) {
          const k = vc ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : [1, 1, 1];
          col[i * 3] = c.r * k[0]; col[i * 3 + 1] = c.g * k[1]; col[i * 3 + 2] = c.b * k[2];
        }
      }
      res = { geo: finish(g, col), mat: `${o.glow ?? 0}` };
    }
    this.baked.set(key, res);
    return res;
  }
  // Add one geometry at a world matrix. Options: color (replace the colour), mul
  // (multiply it), glow (0–1, shines by itself), at [x, z] (which cell; default: the matrix position),
  // sway { kind, y0, h } (wind, see setSway).
  addGeo(geometry, material, matrix, o = {}) {
    const { geo, mat } = this._bake(geometry, material, o);
    const x = o.at ? o.at[0] : matrix.elements[12], z = o.at ? o.at[1] : matrix.elements[14];
    const [ix, iz] = cellOf(x, z), [cx, cz] = cellCentre(ix, iz);
    const g = geo.clone().applyMatrix4(matrix).translate(-cx, 0, -cz);
    if (o.sway && g.attributes.aSway) setSway(g, o.sway.kind, o.sway.y0, o.sway.h);
    const key = `${mat}|${ix},${iz}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, b = { geos: [], mesh: null, mat, cx, cz });
    b.geos.push(g); b.dirty = true;
  }
  // Add a geometry that is already painted (vertex colours) and in world coordinates.
  addPainted(g, x, z) {
    const [ix, iz] = cellOf(x, z), [cx, cz] = cellCentre(ix, iz), mat = '0';
    g = finish(g, g.attributes.color.array).translate(-cx, 0, -cz);
    const key = `${mat}|${ix},${iz}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, b = { geos: [], mesh: null, mat, cx, cz });
    b.geos.push(g); b.dirty = true;
  }
  // Add a Quaternius pack model at a world matrix. Options: tint (foliage colour), mul, at.
  addQ(model, matrix, o = {}) {
    const key = `q|${model.name}|${o.tint ?? ''}|${o.mul ?? ''}`;
    let geo = this.baked.get(key);
    if (!geo) this.baked.set(key, geo = paintQ(model, o.tint, o.mul));
    const x = o.at ? o.at[0] : matrix.elements[12], z = o.at ? o.at[1] : matrix.elements[14];
    const [ix, iz] = cellOf(x, z), [cx, cz] = cellCentre(ix, iz);
    const k2 = `0|${ix},${iz}`;
    let b = this.buckets.get(k2);
    if (!b) this.buckets.set(k2, b = { geos: [], mesh: null, mat: '0', cx, cz });
    const g = geo.clone().applyMatrix4(matrix), e = matrix.elements, sy = Math.hypot(e[4], e[5], e[6]);
    setSway(g, o.sway === false ? null : swayKind(model.name), e[13] + model.minY * sy, model.h * sy);
    b.geos.push(g.translate(-cx, 0, -cz)); b.dirty = true;
  }
  // Add every mesh of a model whose root sits at `matrix` (the model itself stays untouched).
  addModel(root, matrix, o = {}) {
    const m = new THREE.Matrix4();
    if (typeof o.sway === 'string') o = { ...o, sway: { kind: o.sway, y0: matrix.elements[13], h: o.swayH || 1 } };
    root.updateMatrixWorld(true);
    root.traverse((c) => { if (c.isMesh) this.addGeo(c.geometry, c.material, m.multiplyMatrices(matrix, c.matrixWorld), o); });
  }
  _material(mat) {
    if (mat.startsWith('tex:')) return this.texMats.get(mat.slice(4));
    return bakedMat(Number(mat));
  }
  // (Re)build the meshes of the cells that changed. `last` frees the source geometry.
  build(last = false) {
    for (const b of this.buckets.values()) {
      if (b.dirty) {
        if (b.mesh) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); this.meshes.splice(this.meshes.indexOf(b.mesh), 1); }
        const mesh = new THREE.Mesh(mergeGeometries(b.geos), this._material(b.mat));
        mesh.position.set(b.cx, 0, b.cz); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        mesh.castShadow = true; mesh.receiveShadow = true;
        if (!b.mat.startsWith('tex:')) mesh.customDepthMaterial = windDepthMat();
        this.scene.add(mesh); this.meshes.push(mesh);
        b.mesh = mesh; b.dirty = false;
      }
      if (last) { for (const g of b.geos) g.dispose(); b.geos = []; }
    }
    if (last) { for (const r of this.baked.values()) (r.geo || r).dispose(); this.baked.clear(); pixelCache.clear(); }
  }
}
