// Constrained orbit camera for the 3D dollhouse. Drag horizontally to orbit
// around the tower, drag vertically to pan up/down floors, wheel to zoom. The
// rig also distinguishes a click (no drag) from a drag and forwards clicks/hover
// to the slot picker, so building still works while orbiting.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));

export class CameraRig {
  constructor(camera, dom) {
    const C = CONFIG.CAMERA3D;
    this.cam = camera;
    this.dom = dom;
    this.target = new THREE.Vector3();
    this.goalTarget = new THREE.Vector3();
    this.az = C.AZ0_DEG * DEG; this.goalAz = this.az;
    this.pol = C.POL0_DEG * DEG; this.goalPol = this.pol;
    this.rad = 40; this.goalRad = 40;
    this.yMin = 0; this.yMax = 20;
    this.onClick = null;
    this.onHover = null;

    this._down = false; this._dragged = false;
    this._sx = 0; this._sy = 0; this._lx = 0; this._ly = 0;
    dom.addEventListener('pointerdown', (e) => this._pd(e));
    dom.addEventListener('pointermove', (e) => this._pm(e));
    window.addEventListener('pointerup', (e) => this._pu(e));
    dom.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
  }

  /** Fit the orbit to a Box3 (sets target, radius, pan limits). */
  fit(box) {
    const C = CONFIG.CAMERA3D;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const asp = (Number.isFinite(this.cam.aspect) && this.cam.aspect > 0) ? this.cam.aspect : 1.5;
    const vFov = this.cam.fov * DEG;
    const fitH = (size.y / 2) / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * asp);
    const fitW = (size.x / 2) / Math.tan(hFov / 2);
    const r = Math.max(fitH, fitW) * C.FIT_MARGIN + size.z * 0.5;
    this.goalRad = clamp(r, C.RAD_MIN, C.RAD_MAX);
    if (this._first === undefined) { this.rad = this.goalRad; this._first = false; }
    // shift the look point left so the building sits right of the dock
    const gutterWorld = size.x * C.DOCK_GUTTER;
    this.goalTarget.set(center.x - gutterWorld, center.y, center.z);
    if (!this._targetInit) { this.target.copy(this.goalTarget); this._targetInit = true; }
    this.yMin = box.min.y + size.y * 0.12;
    this.yMax = box.max.y - size.y * 0.12;
    this.goalTarget.y = clamp(this.goalTarget.y, this.yMin, this.yMax);
    this._gutterWorld = gutterWorld; this._centerX = center.x;
  }

  resetView() {
    const C = CONFIG.CAMERA3D;
    this.goalAz = C.AZ0_DEG * DEG; this.goalPol = C.POL0_DEG * DEG;
    this.goalTarget.x = this._centerX - this._gutterWorld;
    this.goalTarget.y = (this.yMin + this.yMax) / 2;
  }

  _pd(e) { if (e.button !== 0) return; this._down = true; this._dragged = false; this._sx = this._lx = e.clientX; this._sy = this._ly = e.clientY; }
  _pm(e) {
    if (!this._down) { this.onHover && this.onHover(e); return; }
    const C = CONFIG.CAMERA3D;
    const dx = e.clientX - this._lx, dy = e.clientY - this._ly;
    if (!this._dragged && Math.hypot(e.clientX - this._sx, e.clientY - this._sy) > 5) this._dragged = true;
    if (this._dragged) {
      this.goalAz = clamp(this.goalAz - dx * C.ROT_SPEED * DEG, -C.AZ_MAX_DEG * DEG, C.AZ_MAX_DEG * DEG);
      this.goalTarget.y = clamp(this.goalTarget.y + dy * C.PAN_SPEED, this.yMin, this.yMax);
    }
    this._lx = e.clientX; this._ly = e.clientY;
  }
  _pu(e) {
    if (this._down && !this._dragged && this.onClick) this.onClick(e);
    this._down = false;
  }
  _wheel(e) {
    e.preventDefault();
    const C = CONFIG.CAMERA3D;
    this.goalRad = clamp(this.goalRad * (1 + e.deltaY * C.ZOOM_STEP), C.RAD_MIN, C.RAD_MAX);
  }

  update(dt) {
    const C = CONFIG.CAMERA3D, k = C.DAMP;
    this.az = damp(this.az, this.goalAz, k, dt);
    this.pol = damp(this.pol, this.goalPol, k, dt);
    this.rad = damp(this.rad, this.goalRad, k, dt);
    this.target.x = damp(this.target.x, this.goalTarget.x, k, dt);
    this.target.y = damp(this.target.y, this.goalTarget.y, k, dt);
    this.target.z = damp(this.target.z, this.goalTarget.z, k, dt);
    const cp = Math.cos(this.pol), sp = Math.sin(this.pol);
    this.cam.position.set(
      this.target.x + Math.sin(this.az) * cp * this.rad,
      this.target.y + sp * this.rad,
      this.target.z + Math.cos(this.az) * cp * this.rad,
    );
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.target);
    this.cam.near = Math.max(0.5, this.rad - 60);
    this.cam.far = this.rad + 200;
    this.cam.updateProjectionMatrix();
  }
}
