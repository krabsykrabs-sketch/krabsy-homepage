// The Quaternius pack (CC0): trees, bushes, plants, flowers, rocks, stepping stones,
// a lantern, banners, fences; since world step 3 also the hatchery's walls and roofs,
// yard and camp props, and the farm's crops. One file with all models + one texture atlas, built by
// tools/build-qnature.mjs (simplified, bark and wood baked into vertex colours).
// A model = { name, geo, h, w, minY }. Its geometry has position, normal, uv (atlas)
// and color (rgb = sRGB colour, a = 0 marks foliage that gets a tint when placed).
// Static copies go through world.batch.addQ (merge.js); the grass near the player
// (ground.js) draws them as instances with the same atlas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadQ() {
  const [gltf, atlas] = await Promise.all([
    new GLTFLoader().loadAsync('assets/qnature/qnature.glb'),
    new THREE.TextureLoader().loadAsync('assets/qnature/atlas.webp'),
  ]);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.flipY = false; // glTF texture coordinates
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping; atlas.anisotropy = 2;
  const models = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry; geo.computeBoundingBox();
    const b = geo.boundingBox;
    models[o.name] = { name: o.name, geo, q: true, parts: 1, h: b.max.y - b.min.y || 1, w: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1, minY: b.min.y };
  });
  return { models, atlas };
}
