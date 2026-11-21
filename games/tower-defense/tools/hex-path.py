"""Turn a few anchor cells into a full chain of neighbouring hex cells.

Levels list every road cell ([col, row], odd-r offset layout, see js/level.js).
Writing those by hand is error-prone; this draws straight hex lines between
anchors and prints the chain ready to paste into levels/levelN.js.
usage: python3 hex-path.py "0,1 10,1 12,3 11,6"
"""
import sys

def to_cube(c, r):
    x = c - (r - (r & 1)) // 2
    return x, -x - r, r

def to_offset(x, y, z):
    return x + (z - (z & 1)) // 2, z

def cube_round(x, y, z):
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
    if dx > dy and dx > dz: rx = -ry - rz
    elif dy > dz: ry = -rx - rz
    else: rz = -rx - ry
    return rx, ry, rz

def line(a, b):
    ax, ay, az = to_cube(*a); bx, by, bz = to_cube(*b)
    n = max(abs(ax - bx), abs(ay - by), abs(az - bz))
    out = []
    for i in range(n + 1):
        t = i / n if n else 0
        # tiny nudge keeps ties on one side, so the line never zig-zags
        p = cube_round(ax + (bx - ax) * t + 1e-6, ay + (by - ay) * t + 2e-6, az + (bz - az) * t - 3e-6)
        out.append(to_offset(*p))
    return out

def chain(anchors):
    cells = []
    for a, b in zip(anchors, anchors[1:]):
        seg = line(a, b)
        cells.extend(seg if not cells else seg[1:])
    return cells

if __name__ == '__main__':
    anchors = [tuple(map(int, p.split(','))) for p in sys.argv[1].split()]
    cells = chain(anchors)
    assert len(set(cells)) == len(cells), 'path crosses itself'
    print(', '.join(f'[{c}, {r}]' for c, r in cells))
    print(len(cells), 'cells')
