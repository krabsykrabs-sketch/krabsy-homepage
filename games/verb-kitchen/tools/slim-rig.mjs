// Build assets/models/chef/Rig_Medium_Kitchen.glb: only the animation clips chef.js plays,
// cut from the three KayKit Rig_Medium_* files (3 MB -> 0.3 MB; faster first load on phones).
// Needs @gltf-transform/core + /functions (npm i in any folder, run with NODE_PATH or from there).
// Add a clip name to KEEP when chef.js starts playing a new one, rerun, copy to homepage/games/verb-kitchen/.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample } from '@gltf-transform/functions';
const C = new URL('../assets/models/chef/', import.meta.url).pathname;
const KEEP = ['Idle_A','Running_A','Chopping','PickUp','Holding_B','Working_A'];
const io = new NodeIO();
const base = await io.read(C + 'Rig_Medium_MovementBasic.glb');
const root = base.getRoot(); const buf = root.listBuffers()[0];
const byName = new Map(root.listNodes().map(n => [n.getName(), n]));
for (const f of ['Rig_Medium_General.glb','Rig_Medium_Tools.glb']) {
  const src = await io.read(C + f);
  for (const a of src.getRoot().listAnimations()) {
    if (!KEEP.includes(a.getName())) continue;
    const na = base.createAnimation(a.getName());
    for (const ch of a.listChannels()) {
      const s = ch.getSampler(); const tgt = byName.get(ch.getTargetNode()?.getName());
      if (!tgt) { console.log('missing node', ch.getTargetNode()?.getName()); continue; }
      const acc = (x) => base.createAccessor().setType(x.getType()).setArray(x.getArray().slice()).setBuffer(buf);
      const ns = base.createAnimationSampler().setInput(acc(s.getInput())).setOutput(acc(s.getOutput())).setInterpolation(s.getInterpolation());
      na.addSampler(ns).addChannel(base.createAnimationChannel().setSampler(ns).setTargetNode(tgt).setTargetPath(ch.getTargetPath()));
    }
  }
}
for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const m of root.listMeshes()) m.dispose(); for (const s of root.listSkins()) s.dispose();
await base.transform(resample(), dedup(), prune());
console.log('clips', root.listAnimations().map(a => a.getName()).join(','), 'meshes', root.listMeshes().length);
await io.write(C + 'Rig_Medium_Kitchen.glb', base);
