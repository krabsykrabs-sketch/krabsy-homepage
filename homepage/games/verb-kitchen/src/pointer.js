// Mistake pointer (owner feedback 2026-11-23, all levels): when a station's
// speech bubble says something is MISSING ("bring a plate", "use a plate or a
// bun", "bring a bowl", "wash a plate first" …), the place where that thing is
// lights up for a few seconds: a bobbing teal arrow above it and a pulsing
// ring around it. It lives in the 3D scene (no DOM overlay), so it works the
// same with touch controls and never covers the kitchen or takes input.
import * as THREE from 'three';

const SHOW_TIME = 3.2;     // seconds a pointer stays up
const MAX_MARKS = 3;       // never light up more than this many places at once

export class MistakePointer {
  constructor(scene) {
    this.scene = scene;
    this.marks = [];       // [{ st, group, ring, arrow }]
    this.t = 0;            // time left
    this.clock = 0;
    this.arrowGeo = new THREE.ConeGeometry(0.26, 0.55, 14);
    this.ringGeo = new THREE.TorusGeometry(0.95, 0.07, 8, 36);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0x2ee6c0, depthTest: false, transparent: true });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x2ee6c0, depthTest: false, transparent: true, opacity: 0.85 });
  }

  /** Point at these stations (deduplicated, nearest-first is up to the caller). */
  show(stations) {
    this.clear();
    const list = [...new Set(stations.filter(Boolean))].slice(0, MAX_MARKS);
    for (const st of list) {
      const group = new THREE.Group();
      group.position.set(st.pos.x, st.topY || 1, st.pos.z);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      ring.renderOrder = 6;
      const arrow = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      arrow.rotation.x = Math.PI;           // tip points down at the station
      arrow.renderOrder = 6;
      group.add(ring, arrow);
      this.scene.add(group);
      this.marks.push({ st, group, ring, arrow });
    }
    this.t = list.length ? SHOW_TIME : 0;
  }

  get active() { return this.marks.length > 0; }

  update(dt) {
    if (!this.marks.length) return;
    this.t -= dt;
    this.clock += dt;
    if (this.t <= 0) { this.clear(); return; }
    const fade = Math.min(1, this.t / 0.4);                 // fade out over the last 0.4 s
    const bob = Math.abs(Math.sin(this.clock * 5)) * 0.28;  // little bounce
    const pulse = 1 + Math.sin(this.clock * 7) * 0.08;
    this.arrowMat.opacity = fade;
    this.ringMat.opacity = 0.85 * fade;
    for (const m of this.marks) {
      m.arrow.position.y = 1.35 + bob;
      m.ring.scale.setScalar(pulse);
    }
  }

  clear() {
    for (const m of this.marks) this.scene.remove(m.group);
    this.marks = [];
    this.t = 0;
  }
}
