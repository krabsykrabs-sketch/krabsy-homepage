// Rapier wrapper. The -compat build ships its WASM inline so init() needs no extra fetch.
import RAPIER from '@dimforge/rapier3d-compat';

let ready = false;

export async function initPhysics() {
  if (!ready) {
    await RAPIER.init();
    ready = true;
  }
  const gravity = { x: 0, y: -25, z: 0 };
  const world = new RAPIER.World(gravity);
  return { RAPIER, world };
}

// Static box collider from world-space center + half-extents.
export function addStaticBox(world, RAPIER, center, halfExtents) {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
  const collider = world.createCollider(colDesc, body);
  return { body, collider };
}

// Kinematic box collider — caller updates position each frame via setNextKinematicTranslation.
// The character controller's collision resolution will push the player when this body moves.
export function addKinematicBox(world, RAPIER, center, halfExtents) {
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
  const collider = world.createCollider(colDesc, body);
  return { body, collider };
}

// Static trimesh collider built from arbitrary triangle data. Vertices/indices are in the
// rigid body's local frame; the body's translation positions the trimesh in world space.
// Use this for non-boxy shapes (slopes, platforms with holes) where a cuboid wouldn't match
// the visible geometry.
export function addStaticTrimesh(world, RAPIER, position, vertices, indices) {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
  const collider = world.createCollider(colDesc, body);
  return { body, collider };
}
