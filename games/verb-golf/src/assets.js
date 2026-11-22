// Model loading. Every course model of the KayKit Platformer pack uses the same texture
// (the colour comes from the UVs), and the scenery models share another one, so the whole
// course merges into one mesh per material (see course.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

THREE.Cache.enabled = true; // the texture is referenced by every model file

const COURSE = ['platform_2x2x1', 'platform_slope_2x2x2', 'railing_straight_padded', 'arch', 'star',
  'ball_red', 'flag_A_red']; // names without a colour are the green ones
const SCENERY = ['cloud_big', 'cloud_small', 'tree_single_A', 'tree_single_B', 'rock_single_B'];

function bake(scene) {
  // One geometry per model in model space (node transforms applied), position/normal/uv only.
  scene.updateMatrixWorld(true);
  const geos = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    }
    g.applyMatrix4(o.matrixWorld);
    geos.push(g);
  });
  return geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
}

export const Assets = {
  geos: new Map(),     // name → baked geometry
  courseMat: null,
  sceneryMat: null,

  async load(onProgress) {
    const loader = new GLTFLoader();
    const all = [...COURSE.map((n) => [n.replace(/_red$/, ''), `assets/course/${/_red$/.test(n) ? n : `${n}_green`}.gltf`, 'course']),
      ...SCENERY.map((n) => [n, `assets/scenery/${n}.gltf`, 'scenery'])];
    let done = 0;
    await Promise.all(all.map(([name, url, kind]) => loader.loadAsync(url).then((g) => {
      let map = null;
      g.scene.traverse((o) => { if (o.isMesh && !map) map = o.material.map; });
      if (kind === 'course' && !this.courseMat) this.courseMat = new THREE.MeshLambertMaterial({ map });
      if (kind === 'scenery' && !this.sceneryMat) this.sceneryMat = new THREE.MeshLambertMaterial({ map });
      this.geos.set(name, bake(g.scene));
      done += 1; if (onProgress) onProgress(done / all.length);
    })));
  },

  mesh(name, kind = 'course') {
    const m = new THREE.Mesh(this.geos.get(name), kind === 'course' ? this.courseMat : this.sceneryMat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  },

  // items: [{ name, m: Matrix4 }] → one mesh (one draw call)
  merge(items, kind = 'course') {
    if (!items.length) return null;
    const geos = items.map((it) => {
      const src = this.geos.get(it.name);
      if (!src) throw new Error(`Unknown model: ${it.name}`);
      return src.clone().applyMatrix4(it.m);
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, kind === 'course' ? this.courseMat : this.sceneryMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  },
};
