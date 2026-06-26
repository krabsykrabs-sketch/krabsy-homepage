// Building-level commute: plan a world-space path between two rooms (exit to the
// back corridor → elevator → corridor → enter destination), and drive the
// elevator cabs that carry residents between floors.
import * as THREE from 'three';
import { CONFIG } from './config.js';

/** Find an elevator that serves both floors. */
export function elevatorFor(built, fA, fB) {
  const lo = Math.min(fA, fB), hi = Math.max(fA, fB);
  return (built.circ?.elevators || []).find((e) => e.fMin <= lo && e.fMax >= hi) || null;
}

/**
 * Plan a trip from room (fromF,fromCol) to (toF,toCol) via an elevator.
 * Returns { wps:[Vector3 world…], boardI, alightI, elevC, fromF, toF } or null.
 */
export function planTrip(built, fromF, fromCol, toF, toCol) {
  if (fromF === toF) return null;                 // same floor — no vertical travel needed
  const pitch = built.pitch;
  const corridorZ = built.circ.corridorZ;
  const fromX = built.colX(fromCol), toX = built.colX(toCol);
  const yF = fromF * pitch, yT = toF * pitch;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // adjacent floor + a staircase → take the stairs (no elevator needed)
  if (Math.abs(toF - fromF) === 1) {
    const stair = (built.circ?.stairs || []).find((s) => s.f === Math.min(fromF, toF));
    if (stair) {
      const sX = stair.x, run = CONFIG.CIRCULATION.STAIR_RUN;
      const wps = [
        V(fromX, yF, corridorZ),                 // exit into corridor
        V(sX, yF, corridorZ),                    // to the foot of the stairs
        V(sX, (yF + yT) / 2, corridorZ - run / 2), // climb (mid)
        V(sX, yT, corridorZ),                    // top landing
        V(toX, yT, corridorZ),                   // corridor to dest column
        V(toX, yT, corridorZ + Math.abs(corridorZ) * 0.6), // into the dest room
      ];
      return { wps, boardI: -1, alightI: -1, elevC: null, fromF, toF };
    }
  }

  // otherwise an elevator that serves both floors
  const elev = elevatorFor(built, fromF, toF);
  if (!elev) return null;                          // no reachable circulation
  const eX = elev.x, eZ = elev.z;
  const wps = [
    V(fromX, yF, corridorZ),     // 0: exit room into the back corridor
    V(eX, yF, corridorZ),        // 1: corridor to the elevator column
    V(eX, yF, eZ),               // 2: forward to the lift door  (board after this)
    V(eX, yT, eZ),               // 3: alight at destination floor (placed by the cab)
    V(eX, yT, corridorZ),        // 4: back to the corridor
    V(toX, yT, corridorZ),       // 5: corridor to destination column
    V(toX, yT, eZ * 0.4),        // 6: step into the destination room
  ];
  return { wps, boardI: 3, alightI: 4, elevC: elev.c, fromF, toF };
}

// ── elevator cabs ─────────────────────────────────────────────────────────
export class ElevatorManager {
  constructor(built) {
    const elevs = built.circ?.elevators || [];
    this.pitch = built.pitch;
    this.lifts = elevs.map((e) => ({
      e, queue: [], rider: null, state: 'idle', pitch: built.pitch,
      cabY: e.cab.position.y, goalY: e.cab.position.y,
      offset: e.floorY(0),                          // cab-centre height above the floor it serves
    }));
  }
  byCol(c) { return this.lifts.find((l) => l.e.c === c) || null; }
  /** A waiting resident requests its elevator (set in its commute plan). */
  request(rider) { const l = this.byCol(rider.commute.elevC); if (l) l.queue.push(rider); else abort(rider); }

  update(dt) {
    const sp = CONFIG.CIRCULATION.ELEVATOR_SPEED;
    for (const l of this.lifts) {
      if (!l.rider && l.queue.length) { l.rider = l.queue.shift(); l.state = 'toPickup'; l.goalY = l.cabY; /* recompute below */ }
      let goalY;
      if (l.rider) goalY = l.state === 'toPickup' ? floorCabY(l, l.rider.commute.fromF) : floorCabY(l, l.rider.commute.toF);
      else goalY = floorCabY(l, l.e.fMin);          // idle → return to bottom
      const dy = goalY - l.cabY;
      l.cabY += Math.sign(dy) * Math.min(Math.abs(dy), sp * dt);
      l.e.cab.position.y = l.cabY;

      if (l.rider && l.rider.commute && l.rider.commute.sub === 'ride') {
        l.rider.obj.position.set(l.e.x, l.cabY - l.offset, l.e.z);   // ride with the cab
      }
      if (l.rider && Math.abs(goalY - l.cabY) < 0.03) {
        if (l.state === 'toPickup') { l.rider.commute.sub = 'ride'; l.state = 'toDrop'; }
        else if (l.state === 'toDrop') {
          const r = l.rider;
          r.commute.sub = 'walk'; r.commute.i = r.commute.alightI;
          r.obj.position.set(l.e.x, r.commute.toF * this.pitch, l.e.z);
          l.rider = null; l.state = 'idle';
        }
      }
    }
  }
}
function floorCabY(l, f) { return f * l.pitch + l.offset; }
function abort(rider) { if (rider.commute) { rider.commute.sub = 'walk'; rider.commute.i = rider.commute.alightI; } }
