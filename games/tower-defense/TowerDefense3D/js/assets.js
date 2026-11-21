import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Model loading. Everything in assets/hex/ comes from the KayKit Medieval Hexagon
// pack and shares one small texture atlas, so all models use ONE material. Static
// scenery is merged into a few big meshes by the renderer (see mergeStatic).

const HEX_MODELS = [
  // tiles
  'hex_grass', 'hex_water',
  'hex_road_A', 'hex_road_B', 'hex_road_C', 'hex_road_D', 'hex_road_E', 'hex_road_F',
  'hex_road_G', 'hex_road_M',
  // buildings
  'building_tower_A_blue', 'building_tower_B_blue', 'building_tower_cannon_blue',
  'building_tower_catapult_blue', 'building_tower_base_blue', 'building_castle_blue',
  'building_destroyed',
  // nature
  'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium',
  'mountain_A_grass_trees', 'hills_A_trees', 'hills_B_trees', 'rock_single_A',
  'rock_single_C', 'tree_single_A', 'tree_single_B', 'cloud_small', 'cloud_big',
  'waterlily_A', 'waterlily_B', 'waterplant_A', 'waterplant_B', 'waterplant_C',
  // props
  'flag_red', 'flag_blue', 'barrel', 'crate_A_big', 'bucket_arrows', 'weaponrack', 'target',
  // projectiles
  'projectile_arrow', 'projectile_cannonball', 'projectile_catapult',
];

export const Assets = {
  models: new Map(),   // name → THREE.Group (template; clone before use)
  material: null,      // shared atlas material
  ghostMaterial: null, // same atlas, see-through (placement preview)
  levelMaterials: [],  // tower look per upgrade level: blue, teal, gold
  towerMaterial: null, // summer atlas, fixed: towers and the castle keep their blue
  seasons: {},         // season name → atlas texture (summer, fall, winter)
  loaded: false,

  async load(onProgress) {
    const loader = new GLTFLoader();
    let done = 0;
    await Promise.all(HEX_MODELS.map(async (name) => {
      const gltf = await loader.loadAsync(`assets/hex/${name}.gltf`);
      this.models.set(name, gltf.scene);
      done += 1;
      if (onProgress) onProgress(done / HEX_MODELS.length);
    }));

    // Every file brought its own copy of the same atlas + material. Keep one.
    let atlas = null;
    for (const scene of this.models.values()) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        if (!atlas) atlas = o.material.map;
        else if (o.material.map && o.material.map !== atlas) o.material.map.dispose();
        o.material.dispose();
      });
    }
    // Seasons: same palette layout, other colours for grass, trees and water.
    const texLoader = new THREE.TextureLoader();
    const seasonTex = async (file) => {
      const tex = await texLoader.loadAsync(`assets/hex/${file}`);
      tex.colorSpace = atlas.colorSpace;
      tex.flipY = atlas.flipY;
      tex.wrapS = atlas.wrapS; tex.wrapT = atlas.wrapT;
      tex.magFilter = atlas.magFilter; tex.minFilter = atlas.minFilter;
      return tex;
    };
    const [fall, winter] = await Promise.all([
      seasonTex('hexagons_medieval_fall.png'), seasonTex('hexagons_medieval_winter.png'),
    ]);
    this.seasons = { summer: atlas, fall, winter };

    // The board material follows the level's season (setSeason); towers and the
    // castle always use the summer atlas, so their roofs stay blue / teal / gold.
    this.material = new THREE.MeshLambertMaterial({ map: atlas });
    this.towerMaterial = new THREE.MeshLambertMaterial({ map: atlas });
    this.ghostMaterial = new THREE.MeshLambertMaterial({
      map: atlas, transparent: true, opacity: 0.6, depthWrite: false,
    });
    this.levelMaterials = [
      this.towerMaterial,
      this._recolour(atlas, 0.46, 1.0, 0.02),   // teal
      this._recolour(atlas, 0.12, 1.15, 0.12),  // gold
    ];
    for (const scene of this.models.values()) {
      scene.traverse((o) => { if (o.isMesh) o.material = this.material; });
      scene.updateMatrixWorld(true);
    }
    this.loaded = true;
  },

  // A copy of the atlas material in which every blue swatch (roofs, flags, trim of the
  // blue team) is turned to another hue. The atlas is a tiny palette image, so this
  // costs a few kilobytes of memory and no download.
  _recolour(atlas, hue, satMul, lightAdd) {
    const img = atlas.image;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height), px = data.data;
    const col = new THREE.Color(), hsl = {};
    for (let i = 0; i < px.length; i += 4) {
      col.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255).getHSL(hsl);
      if (hsl.h > 0.5 && hsl.h < 0.72 && hsl.s > 0.3) {
        col.setHSL(hue, Math.min(1, hsl.s * satMul), Math.min(0.9, hsl.l + lightAdd));
        px[i] = col.r * 255; px[i + 1] = col.g * 255; px[i + 2] = col.b * 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = atlas.colorSpace;
    tex.flipY = atlas.flipY;
    tex.wrapS = atlas.wrapS; tex.wrapT = atlas.wrapT;
    tex.magFilter = atlas.magFilter; tex.minFilter = atlas.minFilter;
    return new THREE.MeshLambertMaterial({ map: tex });
  },

  setSeason(name) {
    this.material.map = this.seasons[name] || this.seasons.summer;
  },

  // A fresh instance of a model. Geometry and material are shared with the template.
  clone(name) {
    const src = this.models.get(name);
    if (!src) throw new Error(`Unknown model: ${name}`);
    return src.clone(true);
  },

  // Merge many static placements into one mesh (one draw call).
  // items: [{ name, x, z, y = 0, rot = 0, scale = 1 }]
  mergeStatic(items, material = this.material) {
    const geos = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const it of items) {
      const src = this.models.get(it.name);
      if (!src) throw new Error(`Unknown model: ${it.name}`);
      const s = it.scale || 1;
      m.compose(pos.set(it.x, it.y || 0, it.z), q.setFromAxisAngle(up, it.rot || 0), scl.set(s, s, s));
      src.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld).applyMatrix4(m);
        geos.push(g);
      });
    }
    if (geos.length === 0) return null;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.userData.ownGeo = true;
    return mesh;
  },
};
