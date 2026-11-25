#!/usr/bin/env python3
"""Build homepage/assets/figures/anim/Rig_Medium_Mini.glb: the two clips a page outside
the games needs (Idle_A from Rig_Medium_General.glb, Jump_Full_Short from
Rig_Medium_MovementBasic.glb), without the rig mesh and the other 24 clips.

Why: the landing pages show a live figure to every first-time visitor. The two full files
are 1.5 MB; this one is about 0.1 MB. Loaded with loadClipSet('Mini') in
lib/krabsy-figure.js (krabsy-figure-live.js). Games keep using the full files.

Run again when the source files change:  python3 tools/make_mini_anim.py
"""
import json
import struct
from pathlib import Path

ANIM = Path(__file__).resolve().parent.parent / "homepage/assets/figures/anim"
WANT = [("General", "Idle_A"), ("MovementBasic", "Jump_Full_Short")]
OUT = ANIM / "Rig_Medium_Mini.glb"


def read_glb(path):
    b = path.read_bytes()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n]), b[20 + n + 8:]


def main():
    base, _ = read_glb(ANIM / "Rig_Medium_General.glb")
    # the skeleton only: node names, hierarchy and rest pose; no mesh, no skin
    nodes = [{k: v for k, v in n.items() if k not in ("mesh", "skin")} for n in base["nodes"]]
    index = {n["name"]: i for i, n in enumerate(nodes)}
    out = {"asset": {"version": "2.0", "generator": "krabsy tools/make_mini_anim.py"},
           "scene": 0, "scenes": base["scenes"], "nodes": nodes,
           "animations": [], "accessors": [], "bufferViews": [], "buffers": []}
    blob = bytearray()
    for file, clip in WANT:
        j, bin_ = read_glb(ANIM / f"Rig_Medium_{file}.glb")
        anim = next(a for a in j["animations"] if a["name"] == clip)
        copied = {}

        def accessor(i):
            if i not in copied:
                acc = dict(j["accessors"][i])
                bv = j["bufferViews"][acc["bufferView"]]
                start = bv.get("byteOffset", 0)
                while len(blob) % 4:
                    blob.append(0)
                out["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": bv["byteLength"]})
                blob.extend(bin_[start:start + bv["byteLength"]])
                acc["bufferView"] = len(out["bufferViews"]) - 1
                out["accessors"].append(acc)
                copied[i] = len(out["accessors"]) - 1
            return copied[i]

        samplers = [{**s, "input": accessor(s["input"]), "output": accessor(s["output"])} for s in anim["samplers"]]
        channels = [{"sampler": c["sampler"],
                     "target": {"node": index[j["nodes"][c["target"]["node"]]["name"]], "path": c["target"]["path"]}}
                    for c in anim["channels"]]
        out["animations"].append({"name": clip, "samplers": samplers, "channels": channels})
    while len(blob) % 4:
        blob.append(0)
    out["buffers"] = [{"byteLength": len(blob)}]
    js = json.dumps(out, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    OUT.write_bytes(b"glTF" + struct.pack("<II", 2, total)
                    + struct.pack("<I", len(js)) + b"JSON" + js
                    + struct.pack("<I", len(blob)) + b"BIN\x00" + bytes(blob))
    print(f"{OUT.name}: {total} bytes, clips {[a['name'] for a in out['animations']]}")


if __name__ == "__main__":
    main()
