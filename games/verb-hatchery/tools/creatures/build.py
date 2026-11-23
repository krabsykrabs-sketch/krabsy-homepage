"""Blender 4.5 batch: source model -> normalised game GLB + 128 px book icon (+ silhouette).

  blender -b --factory-startup -P build.py -- jobs.json

jobs.json = { "jobs": [ { id, src, out_glb, out_icon, out_sil, clips, yaw, texture, max_tris, tex, ... } ],
              "report": "report.json" }      (written by build.sh from roster.json)

Per job:  import (glb/gltf/fbx)  ->  keep the wanted clips, renamed to idle/walk/jump/eat/fun
          ->  root node "creature": faces +Z (glTF), stands on y = 0, longest side = 1.0
          ->  decimate above max_tris, metallic 0, textures <= tex px
          ->  render icon (three-quarter view, idle pose, transparent)  ->  export GLB.
Source files are only read as data; nothing inside the source folders is executed."""
import bpy, sys, json, os, math, traceback
import numpy as np
from mathutils import Vector, Matrix, Euler

CFG = json.load(open(sys.argv[sys.argv.index('--') + 1], encoding='utf8'))

# Standard clip -> source action names, best first.
AUTO = {
    'idle': ['Idle', 'Flying_Idle', 'Swimming_Normal', 'Swim', 'Flying', 'ArmatureAction'],
    'walk': ['Walk', 'Walking', 'WalkSlow', 'Fast_Flying', 'Swimming_Fast', 'Run', 'Running'],
    'jump': ['Jump', 'Gallop_Jump', 'Jump_toIdle', 'Jump_ToIdle', 'Swimming_Impulse', 'Headbutt'],
    'eat':  ['Eating', 'Bite_Front', 'Bite'],
    'fun':  ['Dance', 'Wave', 'Yes', 'Attack', 'Attack_Headbutt', 'Punch', 'Attack2'],
}

def short(name): return name.split('|')[-1]

def find_action(want, taken):
    acts = [a for a in bpy.data.actions if a not in taken]
    for a in acts:
        if short(a.name) == want: return a
    for a in acts:
        if short(a.name).endswith('_' + want): return a
    return None

def pick_clips(spec):
    """spec: {std: 'SourceName' | None} overrides; missing std names use AUTO."""
    out, taken = {}, []
    for std in ('idle', 'walk', 'jump', 'eat', 'fun'):
        if std in spec:
            if not spec[std]: continue
            a = find_action(spec[std], taken)
            if not a: print('  ! clip not found:', spec[std]); continue
        else:
            a = next((x for x in (find_action(c, taken) for c in AUTO[std]) if x), None)
            if not a: continue
        out[std] = a; taken.append(a)
    return out

def set_action(obj, act):
    if not obj.animation_data: obj.animation_data_create()
    obj.animation_data.action = act
    if act and hasattr(obj.animation_data, 'action_slot') and obj.animation_data.action_slot is None and len(act.slots):
        obj.animation_data.action_slot = act.slots[0]

def world_bbox(meshes):
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    pts = []
    for o in meshes:
        e = o.evaluated_get(dg); me = e.to_mesh()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        M = np.array(e.matrix_world); w = co @ M[:3, :3].T + M[:3, 3]
        pts.append(w); e.to_mesh_clear()
    pts = np.concatenate(pts)
    return pts.min(0), pts.max(0), pts

def tri_count(meshes): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)

def setup_render(size):
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = eng; break
        except TypeError: pass
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    try: sc.eevee.taa_render_samples = 32
    except Exception: pass
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 0.85
    cam = bpy.data.objects.new('IconCam', bpy.data.cameras.new('IconCam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; sc.camera = cam
    sun = bpy.data.objects.new('IconSun', bpy.data.lights.new('IconSun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 3.6; sun.data.angle = 0.3
    return cam, sun

def aim_camera(cam, sun, pts, az_deg, el_deg):
    """Creature looks at -Y (Blender). Camera in front, az to its left/right, el above."""
    az, el = math.radians(az_deg), math.radians(el_deg)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    rot = d.to_track_quat('Z', 'Y')            # camera looks along its -Z, so +Z points back at the camera
    cam.rotation_euler = rot.to_euler()
    R = rot.to_matrix()
    xs, ys = pts @ np.array(R.col[0]), pts @ np.array(R.col[1])     # the model as the camera sees it
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    cam.data.ortho_scale = max(xs.max() - xs.min(), ys.max() - ys.min()) * 1.08
    cam.location = R.col[0] * cx + R.col[1] * cy + d * 10
    cam.data.clip_start, cam.data.clip_end = 0.1, 50
    sd = Vector((math.sin(az - 0.9) * 0.6, -math.cos(az - 0.9) * 0.6, 0.85))
    sun.rotation_euler = sd.to_track_quat('Z', 'Y').to_euler()

def save_icons(tmp_png, out_icon, out_sil, size):
    img = bpy.data.images.load(tmp_png)
    if img.size[0] != size: img.scale(size, size)
    sc = bpy.context.scene
    fmt = 'WEBP' if out_icon.lower().endswith('.webp') else 'PNG'
    sc.render.image_settings.file_format = fmt; sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.quality = 90
    img.save_render(out_icon, scene=sc)
    if out_sil:
        px = np.empty(size * size * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
        px[:, 0], px[:, 1], px[:, 2] = 0.13, 0.16, 0.22
        img.pixels.foreach_set(px.ravel()); img.update(); img.save_render(out_sil, scene=sc)
    bpy.data.images.remove(img)
    sc.render.image_settings.file_format = 'PNG'

def default_pose(src):
    """Pose of every bone when no clip plays (the glTF nodes' own values).
    Many clips key only some bones; the others must stay in this pose, not in whatever the
    clip before left behind. Read by importing a copy of the file without its animations."""
    import struct, tempfile
    raw = open(src, 'rb').read()
    tmp = os.path.join(tempfile.gettempdir(), 'krabsy_creature_noanim' + ('.glb' if raw[:4] == b'glTF' else '.gltf'))
    if raw[:4] == b'glTF':
        n = struct.unpack_from('<I', raw, 12)[0]
        js = json.loads(raw[20:20 + n]); js.pop('animations', None)
        jb = json.dumps(js).encode(); jb += b' ' * (-len(jb) % 4)
        rest = raw[20 + n:]
        open(tmp, 'wb').write(b'glTF' + struct.pack('<II', 2, 20 + len(jb) + len(rest)) + struct.pack('<I', len(jb)) + b'JSON' + jb + rest)
    else:
        js = json.loads(raw.decode('utf8')); js.pop('animations', None)
        if any('uri' in x and not x['uri'].startswith('data:') for x in js.get('buffers', []) + js.get('images', [])): return {}
        open(tmp, 'w', encoding='utf8').write(json.dumps(js))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=tmp)
    os.remove(tmp)
    out = {}
    for o in bpy.data.objects:
        if o.type == 'ARMATURE':
            for pb in o.pose.bones:
                out[pb.name] = {'location': tuple(pb.location), 'rotation_quaternion': tuple(pb.rotation_quaternion), 'scale': tuple(pb.scale)}
    return out

def fill_clips(arm, clips, base):
    """Every clip gets a key for every bone value it does not animate (the default pose)."""
    added = 0
    for a in clips.values():
        have = {(fc.data_path, fc.array_index) for fc in a.fcurves}
        f0 = a.frame_range[0]
        for pb in arm.pose.bones:
            b = base.get(pb.name)
            if not b: continue
            for prop, vals in b.items():
                path = 'pose.bones["%s"].%s' % (pb.name, prop)
                for i, v in enumerate(vals):
                    if (path, i) in have: continue
                    a.fcurves.new(path, index=i, action_group=pb.name).keyframe_points.insert(f0, v); added += 1
    return added

def run(job):
    src = job['src']
    base = {} if src.lower().endswith('.fbx') else default_pose(src)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src)
    else: bpy.ops.import_scene.gltf(filepath=src)
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o)
    # the glTF importer adds a little sphere as the bones' display shape: not part of the model
    for o in list(bpy.data.objects):
        if o.type == 'ARMATURE':
            for pb in o.pose.bones: pb.custom_shape = None
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and (o.name.startswith('Icosphere') or not o.users_scene): bpy.data.objects.remove(o)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for n in job.get('drop_meshes', []):
        for o in [m for m in meshes if n in m.name]: meshes.remove(o); bpy.data.objects.remove(o)
    animated = [o for o in bpy.data.objects if o.type == 'ARMATURE'] or meshes[:1]
    arm = animated[0]
    src_tris = tri_count(meshes)

    # clips
    clips = pick_clips(job.get('clips', {}))
    if 'idle' not in clips: raise RuntimeError('no idle clip; actions: ' + ', '.join(short(a.name) for a in bpy.data.actions))
    for o in bpy.data.objects:
        if o.animation_data:
            for t in list(o.animation_data.nla_tracks): o.animation_data.nla_tracks.remove(t)
            o.animation_data.action = None
    for a in list(bpy.data.actions):
        if a not in clips.values(): bpy.data.actions.remove(a)
    src_names = {std: short(a.name) for std, a in clips.items()}
    for std, a in clips.items(): a.name = std
    if base and arm.type == 'ARMATURE': print('  default-pose keys added:', fill_clips(arm, clips, base))
    set_action(arm, clips['idle'])
    f0 = int(clips['idle'].frame_range[0]) + int(job.get('icon_frame', 0))
    sc.frame_set(f0)

    # texture given beside the model (FBX packs with a Textures/ folder)
    if job.get('texture'):
        img = bpy.data.images.load(job['texture'])
        for m in {s.material for o in meshes for s in o.material_slots if s.material}:
            m.use_nodes = True
            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b and not b.inputs['Base Color'].is_linked:
                t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img
                m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                for k in ('Metallic',):
                    for l in list(n.inputs[k].links): m.node_tree.links.remove(l)
                    n.inputs[k].default_value = 0.0
                if not n.inputs['Roughness'].is_linked: n.inputs['Roughness'].default_value = max(0.7, n.inputs['Roughness'].default_value)
    tex = int(job.get('tex', 256))
    for img in bpy.data.images:
        if img.size[0] > tex or img.size[1] > tex:
            k = tex / max(img.size); img.scale(max(1, round(img.size[0] * k)), max(1, round(img.size[1] * k)))

    # decimate
    max_tris = int(job.get('max_tris', 3000))
    if src_tris > max_tris:
        ratio = max_tris / src_tris * 0.985
        for o in meshes:
            if o.data.shape_keys: continue
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio; md.use_collapse_triangulate = True
            bpy.ops.object.modifier_move_to_index(modifier=md.name, index=0)
            bpy.ops.object.modifier_apply(modifier=md.name)

    # root: facing, size, feet
    root = bpy.data.objects.new('creature', None); sc.collection.objects.link(root)
    for o in [o for o in bpy.data.objects if o.parent is None and o is not root]:
        o.parent = root          # root is identity now, so world transforms stay
    root.rotation_euler = Euler((math.radians(job.get('pitch', 0)), 0, math.radians(job.get('yaw', 0))))
    bpy.context.view_layer.update()
    # size over the whole idle clip (wings open and close), not only its first frame
    fr = clips['idle'].frame_range; los, his = [], []
    for i in range(7):
        sc.frame_set(int(round(fr[0] + (fr[1] - fr[0]) * i / 7)))
        l, h, _ = world_bbox(meshes); los.append(l); his.append(h)
    sc.frame_set(f0)
    lo, hi = np.min(los, 0), np.max(his, 0)
    s = 1.0 / max(hi - lo)
    c = (lo + hi) / 2
    root.scale = (s, s, s); root.location = (-c[0] * s, -c[1] * s, -lo[2] * s)
    bpy.context.view_layer.update()
    lo, hi = lo * s + np.array(root.location), hi * s + np.array(root.location)
    _, _, pts = world_bbox(meshes)

    # icon
    if job.get('out_icon'):
        big = int(job.get('icon_px', 128)) * 2
        cam, sun = setup_render(big)
        aim_camera(cam, sun, pts, job.get('icon_az', 35), job.get('icon_el', 18))
        tmp = job['out_icon'] + '.tmp.png'
        sc.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        save_icons(tmp, job['out_icon'], job.get('out_sil'), big // 2)
        os.remove(tmp)
        bpy.data.objects.remove(cam); bpy.data.objects.remove(sun)

    # animation: one NLA track per clip, named with the standard name
    set_action(arm, None)
    for std, a in clips.items():
        for o in animated[:1]:
            tr = o.animation_data.nla_tracks.new(); tr.name = std
            st = tr.strips.new(std, int(a.frame_range[0]), a); st.name = std
            if hasattr(st, 'action_slot') and st.action_slot is None and len(a.slots): st.action_slot = a.slots[0]
    opts = dict(filepath=job['out_glb'], export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                export_frame_step=int(job.get('frame_step', 1)), export_force_sampling=True,
                export_optimize_animation_size=False,   # optimize.cjs thins the keys (Blender's option also drops constant poses that differ from the rest pose)
                export_anim_slide_to_zero=True, export_skins=True, export_def_bones=False, export_morph=False,
                export_tangents=False, export_cameras=False, export_lights=False, export_extras=False, export_yup=True,
                export_image_format='WEBP', export_image_quality=82, export_vertex_color='NONE', export_all_vertex_colors=False,
                export_materials='EXPORT', export_apply=False, use_selection=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in props})
    return {'id': job['id'], 'ok': True, 'src_tris': src_tris, 'tris': tri_count(meshes), 'bones': len(arm.data.bones) if arm.type == 'ARMATURE' else 0,
            'size': [round(float(hi[0] - lo[0]), 3), round(float(hi[2] - lo[2]), 3), round(float(hi[1] - lo[1]), 3)],   # width, height, length
            'clips': src_names, 'images': {i.name: list(i.size) for i in bpy.data.images if i.size[0]}}

report = []
for job in CFG['jobs']:
    print('== ', job['id'])
    try: report.append(run(job))
    except Exception as e:
        traceback.print_exc(); report.append({'id': job['id'], 'ok': False, 'error': str(e)})
    json.dump(report, open(CFG['report'], 'w'), indent=1)
print('DONE', sum(r['ok'] for r in report), 'of', len(report))
