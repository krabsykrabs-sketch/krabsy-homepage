// GLTF asset registry. Everything the game needs is preloaded here (the
// loading screen waits on loadAssets()), then handed out as clones via
// prop(). Characters are skinned, so they clone through SkeletonUtils and
// carry their animation clips (merged from the shared KayKit rig files —
// every KayKit medium character shares the same skeleton/bone names).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();

// name → { scene, animations } (raw gltf payloads, never added to a scene)
const lib = new Map();

const MANIFEST = {
  // character + shared animation rigs (clips only)
  ranger:        'assets/char/Ranger.glb',
  rigMove:       'assets/char/Rig_Medium_MovementBasic.glb',
  rigGeneral:    'assets/char/Rig_Medium_General.glb',
  rigTools:      'assets/char/Rig_Medium_Tools.glb',
  // hand tools
  shovel:        'assets/tools/shovel.gltf',
  bucket:        'assets/tools/bucket_metal.gltf',
  pickaxe:       'assets/tools/pickaxe.gltf',
  axe:           'assets/tools/axe.gltf',
  lantern:       'assets/tools/lantern.gltf',
  sword:         'assets/weapons/sword_B.gltf',
  // forest props
  tree1:         'assets/forest/Tree_1_A_Color1.gltf',
  tree2:         'assets/forest/Tree_2_A_Color1.gltf',
  tree3:         'assets/forest/Tree_3_A_Color1.gltf',
  tree5:         'assets/forest/Tree_5_A_Color1.gltf',
  bush1:         'assets/forest/Bush_1_A_Color1.gltf',
  bush2:         'assets/forest/Bush_2_A_Color1.gltf',
  bush4:         'assets/forest/Bush_4_A_Color1.gltf',
  rock1:         'assets/forest/Rock_1_A_Color1.gltf',
  rock3:         'assets/forest/Rock_3_A_Color1.gltf',
  rock5:         'assets/forest/Rock_5_A_Color1.gltf',
  grass1:        'assets/forest/Grass_1_A_Color1.gltf',
  grass2:        'assets/forest/Grass_2_A_Color1.gltf',
  // resource bits
  woodLog:       'assets/resource/Wood_Log_A.gltf',
  woodStack:     'assets/resource/Wood_Log_Stack.gltf',
  stoneSmall:    'assets/resource/Stone_Chunks_Small.gltf',
  stoneLarge:    'assets/resource/Stone_Chunks_Large.gltf',
  stoneBrick:    'assets/resource/Stone_Brick.gltf',
  gemSmall:      'assets/resource/Gem_Small.gltf',
  gemMedium:     'assets/resource/Gem_Medium.gltf',
  goldNugget:    'assets/resource/Gold_Nugget_Medium.gltf',
  berryBlue:     'assets/resource/Food_Berry_Blue.gltf',
  berryBasket:   'assets/resource/Food_Basket_A_Berries.gltf',
  crateWood:     'assets/resource/Containers_Crate_Medium_Wood.gltf',
  crateBerries:  'assets/resource/Food_Crate_Small_Berries.gltf',
};

export async function loadAssets(onProgress) {
  const names = Object.keys(MANIFEST);
  let done = 0;
  await Promise.all(names.map(async (name) => {
    const gltf = await loader.loadAsync(MANIFEST[name]);
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // KayKit ships MeshStandardMaterial; the scene is lit for lambert
        // levels, so soften the PBR response.
        if (o.material) { o.material.metalness = 0; o.material.roughness = 1; }
      }
    });
    lib.set(name, gltf);
    done++;
    onProgress?.(done / names.length);
  }));
}

// A fresh clone of a static prop, ready to add to the scene.
export function prop(name, scale = 1) {
  const src = lib.get(name);
  if (!src) throw new Error(`asset not loaded: ${name}`);
  const obj = src.scene.clone(true);
  if (scale !== 1) obj.scale.setScalar(scale);
  return obj;
}

// The player character: a skinned clone with all animation clips merged in
// from the shared rig files. Returns { group, mixer, clips }.
export function makeRanger() {
  const src = lib.get('ranger');
  const group = SkeletonUtils.clone(src.scene);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  const clips = [
    ...src.animations,
    ...lib.get('rigMove').animations,
    ...lib.get('rigGeneral').animations,
    ...lib.get('rigTools').animations,
  ];
  const mixer = new THREE.AnimationMixer(group);
  return { group, mixer, clips };
}
