// Animated characters (hero and skeletons). Clips come from one shared rig file.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export class Char {
  constructor(template, clips) {
    this.root = cloneSkinned(template);
    this.materials = [];
    const cloned = new Map();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // skinned bounds are wrong while animated
      if (!cloned.has(o.material)) { cloned.set(o.material, o.material.clone()); this.materials.push(cloned.get(o.material)); }
      o.material = cloned.get(o.material);
    });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const [n, c] of Object.entries(clips)) this.actions[n] = this.mixer.clipAction(c);
    this.current = null;
  }
  get pos() { return this.root.position; }
  dur(name) { return this.actions[name].getClip().duration; }
  play(name, { once = false, fade = 0.15, speed = 1 } = {}) {
    if (this.current === name) return;
    const next = this.actions[name], prev = this.current && this.actions[this.current];
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    next.play();
    if (prev) prev.crossFadeTo(next, fade, false);
    this.current = name;
  }
  face(dx, dz, dt, rate = 12) {
    let d = Math.atan2(dx, dz) - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * rate);
  }
  setVisible(v) { this.root.visible = v; }
  dispose() {
    this.mixer.stopAllAction();
    if (this.root.parent) this.root.parent.remove(this.root);
    for (const m of this.materials) m.dispose();
  }
}
