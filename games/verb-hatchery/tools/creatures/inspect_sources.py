"""Blender: list what is inside source models (tris, bones, clips, textures, size).
  blender -b --factory-startup -P inspect_sources.py -- out.json file1 file2 ...
Only reads the files; nothing from the source folders is executed."""
import bpy, sys, json, os
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
out, files = args[0], args[1:]
if len(files) == 1 and files[0].endswith('.txt'): files = [l.strip() for l in open(files[0], encoding='utf8') if l.strip()]
res = []
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        if f.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=f)
        else: bpy.ops.import_scene.gltf(filepath=f)
    except Exception as e:
        res.append({'file': f, 'error': str(e)}); continue
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        e = o.evaluated_get(dg)
        for c in e.bound_box:
            w = e.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    res.append({'file': f, 'tris': tris, 'meshes': len(meshes), 'bones': sum(len(a.data.bones) for a in arms),
                'dims': [round(v, 3) for v in (hi - lo)], 'min': [round(v, 3) for v in lo],
                'actions': {a.name: [int(a.frame_range[0]), int(a.frame_range[1])] for a in bpy.data.actions},
                'mats': [m.name for m in bpy.data.materials],
                'images': {i.name: list(i.size) for i in bpy.data.images if i.size[0]},
                'vcol': any(len(o.data.color_attributes) for o in meshes),
                'shapekeys': any(o.data.shape_keys for o in meshes)})
json.dump(res, open(out, 'w'), indent=1)
