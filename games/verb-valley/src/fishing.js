// Pond fishing — a timing minigame built on the KayKit Fishing_* clips.
// State machine: cast → waiting → bite (react window) → catch / miss.
// game.js drives it: start() on E at the pond, press() on E during play,
// tick(dt) every frame. Moving cancels (game.js calls cancel()).

import * as THREE from 'three';
import { LAYOUT, FISHING } from './config.js';

export function createFishing(scene, player, hooks) {
  // hooks: { onCatch(type), onMiss(), bubble(pos,text,ms), toast(msg) }
  let phase = 'idle';   // idle | casting | waiting | bite | reeling
  let timer = 0;
  let rng = Math.random;   // swappable for QA determinism

  // Bobber: a tiny float dropped on the pond surface.
  const bobber = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xff8585 }));
  ball.position.y = 0.08;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffffff }));
  tip.position.y = 0.2;
  bobber.add(ball, tip);
  bobber.visible = false;
  scene.add(bobber);

  function bobberSpot() {
    // a point on the pond between the player and the pond centre
    const p = player.position;
    const c = LAYOUT.pond;
    const dx = c.x - p.x, dz = c.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const d = Math.min(len - 0.4, Math.max(1.6, len * 0.55));
    return new THREE.Vector3(p.x + dx / len * d, 0.05, p.z + dz / len * d);
  }

  function start() {
    if (phase !== 'idle') return { ok: false, reason: 'already-fishing' };
    phase = 'casting';
    timer = 0.9;
    player.playAction('Fishing_Cast', { timeScale: 1.3 });
    bobber.position.copy(bobberSpot());
    return { ok: true };
  }

  function press() {
    if (phase === 'bite') {
      phase = 'reeling';
      timer = 1.0;
      player.playAction('Fishing_Catch', { timeScale: 1.2 });
      bobber.visible = false;
      const type = rng() < FISHING.GOLD_CHANCE ? 'goldfish' : 'fish';
      hooks.onCatch?.(type);
      return { ok: true, caught: type };
    }
    if (phase === 'waiting' || phase === 'casting') {
      // reeled in too early — quietly reset
      cancel();
      hooks.toast?.('Too soon — wait for the bite! 🎣');
      return { ok: false, reason: 'too-soon' };
    }
    return { ok: false, reason: 'not-fishing' };
  }

  function cancel() {
    if (phase === 'idle') return;
    phase = 'idle';
    bobber.visible = false;
    player.stopAction();
  }

  function tick(dt, clock) {
    if (phase === 'idle') return;
    timer -= dt;
    if (phase === 'casting' && timer <= 0) {
      phase = 'waiting';
      timer = FISHING.WAIT_MIN + rng() * (FISHING.WAIT_MAX - FISHING.WAIT_MIN);
      bobber.visible = true;
      player.playAction('Fishing_Idle', { loop: true, timeScale: 1 });
    } else if (phase === 'waiting') {
      bobber.position.y = 0.05 + Math.sin(clock * 2.2) * 0.03;
      if (timer <= 0) {
        phase = 'bite';
        timer = FISHING.BITE_WINDOW;
        player.playAction('Fishing_Bite', { loop: true, timeScale: 1.4 });
        hooks.onBite?.();
      }
    } else if (phase === 'bite') {
      bobber.position.y = -0.12 + Math.abs(Math.sin(clock * 14)) * 0.16;
      if (timer <= 0) {
        phase = 'idle';
        bobber.visible = false;
        player.stopAction();
        hooks.onMiss?.();
      }
    } else if (phase === 'reeling' && timer <= 0) {
      phase = 'idle';
      player.stopAction();
    }
  }

  return {
    start, press, cancel, tick,
    get phase() { return phase; },
    get active() { return phase !== 'idle'; },
    _setRng(fn) { rng = fn; },   // QA hook
  };
}
