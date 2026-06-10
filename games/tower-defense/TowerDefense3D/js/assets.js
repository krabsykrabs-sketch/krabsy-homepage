// 3D version: all visuals are procedural placeholder meshes built in renderer.js,
// so there are no image assets to preload. This stub keeps the same API surface as
// the 2D Assets module so main.js / tower.js run unchanged.
//
// When real 3D assets (glTF/GLB) arrive, load them here with THREE.GLTFLoader
// (lib/GLTFLoader.js is already included) and hand the loaded scenes to Renderer.

const FARMER_LAYER_ORDER = []; // legacy constant referenced by the 2D renderer; unused in 3D

const Assets = {
  images: Object.create(null),
  loaded: true,

  load() { return Promise.resolve(); },

  randomOutfit() { return null; },

  farmerLayer() { return null; },
};
