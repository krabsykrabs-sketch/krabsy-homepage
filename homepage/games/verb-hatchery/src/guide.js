// A dashed line on the ground from the player to where to go next (owner 2026-11-26:
// "a dotted line that leads us to the first egg, and back to the farm"). Used by the
// first-minutes guidance. The dashes run towards the target, follow the ground and fade
// out near both ends. One InstancedMesh (one draw call).
import * as THREE from 'three';
import { height } from './world.js';

const N = 60, GAP = 1.1, START = 1.3, END = 1.4;

export class Guide {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(0.22, 0.6).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcf5e, transparent: true, opacity: 0.9, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, N);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.visible = false;
    scene.add(this.mesh);
    this.to = null; this.t = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._p = new THREE.Vector3();
    this._c = new THREE.Color();
  }
  // show the way to (x, z); null hides it
  set(x, z) { this.to = x === null ? null : { x, z }; if (!this.to) this.mesh.visible = false; }
  update(dt, from) {
    if (!this.to) return;
    this.t += dt;
    const dx = this.to.x - from.x, dz = this.to.z - from.z, L = Math.hypot(dx, dz);
    const span = L - START - END;
    if (span < 0.5) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const ux = dx / L, uz = dz / L;
    this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(ux, uz));
    const shift = (this.t * 1.6) % GAP; // the dashes crawl towards the target
    let n = 0;
    for (let d = START + shift; d < L - END && n < N; d += GAP, n++) {
      const x = from.x + ux * d, z = from.z + uz * d;
      this._p.set(x, height(x, z) + 0.07, z);
      const fade = Math.min(1, (d - START) / 1.5, (L - END - d) / 1.5);
      this._s.setScalar(0.4 + 0.6 * Math.max(0, fade));
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(n, this._m);
      this.mesh.setColorAt(n, this._c.setRGB(1, 1, 1).multiplyScalar(0.55 + 0.45 * Math.max(0, fade)));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
}
