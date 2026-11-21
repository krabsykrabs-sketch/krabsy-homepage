#!/usr/bin/env python3
"""Write first drafts of level files (assets/levels/<id>.json) from short path scripts.

    python3 tools/make_levels.py            # writes only levels that do not exist yet
    python3 tools/make_levels.py --force zigzag climb   # overwrite these (loses editor changes!)

A level is described as a walk: start(), then pieces placed one after another in the current
heading (N = away from the start camera, E/W = right/left). Each piece also adds a waypoint to
`botPath`, which tools/bot-test.cjs follows to prove the level can be finished.
Once a level has been reshaped in the editor, the JSON file is the truth: do not regenerate it.

Units: a square platform `size` wide and 1 high; `gap` = empty space to jump; `dy` = step up/down.
The player jumps ~2.1 high and ~4.5 far, and WALKS across gaps of about 1 (the capsule bridges
them), so real jumps use gaps of 2 to 3. The checks below keep every jump inside the limits.
"""
import json, os, sys

DIRS = {'N': (0, -1), 'E': (1, 0), 'W': (-1, 0), 'S': (0, 1)}
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'levels')


class Level:
    def __init__(self, id, name, tiers, color='blue', accent=None, sky=None):
        self.id, self.name, self.tiers = id, name, tiers
        self.sky = sky         # sky preset name (src/sky-presets.js); None = the game's default
        self.color, self.accent = color, accent or color
        self.objs, self.path, self.n = [], [], {}
        self.flag = None
        self.h = 'N'
        self.c = None          # centre (x, z) of the piece we stand on
        self.top = 1           # height of its walking surface
        self.half = (3, 3)     # its half size (x, z)
        self._leaving_mover = False
        self._far = None       # far end of the ferry we stand on

    # ---- helpers ----
    def _id(self, prefix):
        self.n[prefix] = self.n.get(prefix, 0) + 1
        return f'{prefix}_{self.n[prefix]}'

    def _along(self, half=None):
        hx, hz = half or self.half
        return hx if self.h in 'EW' else hz

    def _advance(self, dist):
        dx, dz = DIRS[self.h]
        return (self.c[0] + dx * dist, self.c[1] + dz * dist)

    def _check(self, gap, dy):
        assert dy <= 1, f'{self.id}: step up {dy} is too high'
        assert gap <= (2.5 if dy > 0 else 3.2), f'{self.id}: gap {gap} with step {dy} is too far'
        assert gap == 0 or gap >= 2, f'{self.id}: gap {gap} can be walked across; use 0 or at least 2'

    def _wp(self, wp):
        if self._leaving_mover:
            # leaving a moving platform: jump only when the landing spot is close
            self._leaving_mover = False
            wp.setdefault('reach', 3.9)
        self.path.append(wp)

    def _platform(self, type, x, z, ybottom, color=None, **extra):
        id = self._id('platform')
        o = {'id': id, 'type': type, 'position': [x, ybottom, z], 'rotation': 0, 'scale': 1,
             'color': color or self.color, 'correctAnswer': False}
        o.update(extra)
        self.objs.append(o)
        return id

    # ---- pieces ----
    def start(self, size=6):
        self.c, self.half, self.top = (0, 0), (size / 2, size / 2), 1
        self._platform(f'platform_{size}x{size}x1', 0, 0, 0)
        return self

    def turn(self, h):
        """Change heading. On a ferry: step off sideways at its far end."""
        if self._far:
            self.c, size = self._far
            self.half = (size / 2, size / 2)
            self._far = None
        self.h = h
        return self

    def plat(self, size=4, gap=2.5, dy=0, color=None, side=0):
        """Square platform ahead. side = sideways shift (to the right of the heading)."""
        self._check(gap + abs(side) * 0.5, dy)
        self._far = None
        x, z = self._advance(self._along() + gap + size / 2)
        dx, dz = DIRS[self.h]
        x, z = x - dz * side, z + dx * side
        self.top += dy
        self._platform(f'platform_{size}x{size}x1', x, z, self.top - 1, color)
        self.c, self.half = (x, z), (size / 2, size / 2)
        wp = {'p': [x, self.top, z]}
        if self._leaving_mover:
            wp['reach'] = gap + size / 2 + 0.95   # leave a ferry only when the landing is close
        self._wp(wp)
        return self

    def walkway(self, n, size=4, color=None):
        for _ in range(n):
            self.plat(size, gap=0, color=color)
        return self

    def checkpoint(self):
        self.objs.append({'id': self._id('checkpoint'), 'type': 'checkpoint',
                          'position': [self.c[0], self.top + 1, self.c[1]]})
        return self

    def gate(self, gap=2, verb=None):
        """Answer gate ahead (only when heading N, so the words face the camera).
        Puts a checkpoint on the platform before it."""
        assert self.h == 'N', f'{self.id}: gates must be approached heading N'
        assert self.half[0] >= 2, f'{self.id}: the platform before a gate must be at least 4 wide'
        self._check(gap, 0)
        self.checkpoint()
        x, z = self._advance(self._along() + gap + 1)
        id = self._id('gate')
        o = {'id': id, 'type': 'gate', 'position': [x, self.top - 1, z], 'rotation': 0}
        if verb:
            o['verb'] = verb
        self.objs.append(o)
        self.c, self.half = (x, z), (1, 1)
        self._wp({'gate': id})
        self._after_gate = True
        return self

    def mover(self, axis, amp, period, size=4, gap=2, phase=0, color=None):
        """Moving platform. axis 'along' = ferry in the heading (boards at its near end, where
        it stands still for a moment); 'y' = bobs up and down. period and phase in seconds.
        For a sideways ferry: turn, mover('along', …), turn back."""
        dx, dz = DIRS[self.h]
        if axis == 'along':
            world_axis = 'x' if self.h in 'EW' else 'z'
            x, z = self._advance(self._along() + gap + size / 2 + amp)
            ext = size / 2 + amp
            far = ((x + dx * amp, z + dz * amp), size)
        else:
            world_axis = 'y'
            x, z = self._advance(self._along() + gap + size / 2)
            ext = size / 2
            far = None
        id = self._platform(f'platform_{size}x{size}x1', x, z, self.top - 1, color or self.accent,
                            motion={'axis': world_axis, 'amplitude': amp, 'period': period, 'phase': phase})
        self._wp({'ride': id, 'reach': gap + size / 2 + 0.9})
        self.c, self.half, self._far = (x, z), (ext, ext), far
        self._leaving_mover = True
        return self

    def slope(self, color=None):
        """Ramp up 4 units over 6 (walkable), directly attached. Follow with plat(gap=0)."""
        rot = {'N': 0, 'W': 90, 'E': -90}[self.h]
        x, z = self._advance(self._along() + 3)
        self._platform('platform_slope_4x6x4', x, z, self.top, color, rotation=rot)
        self.top += 4
        self.c = (x, z)
        self.half = (3, 2) if self.h in 'EW' else (2, 3)
        return self

    def drop(self, size=4, gap=2.5, dy=-2, color=None):
        """Platform ahead and lower (a jump down)."""
        return self.plat(size, gap, dy, color)

    def hammer(self, period=3.0, amplitude=60, phase=0):
        """Hammer hanging over the piece we stand on, swinging across the path.
        The bot waits for it before walking under."""
        id = self._id('hammer')
        self.objs.append({'id': id, 'type': 'hammer', 'position': [self.c[0], self.top + 7.3, self.c[1]],
                          'rotation': 0 if self.h in 'NS' else 90, 'rotationX': 180, 'scale': 1, 'color': 'red',
                          'period': period, 'amplitude': amplitude, 'phase': phase})
        self.path[-1]['hammer'] = id
        return self

    def conveyor(self, speed=3.0, gap=0):
        """Conveyor belt 2 wide, 4 long (heading N only). speed > 0 carries forward, < 0 pushes back."""
        assert self.h == 'N'
        x, z = self._advance(self._along() + gap + 2)
        id = self._id('conveyor2x4x1')
        self.objs.append({'id': id, 'type': 'conveyor_2x4x1', 'position': [x, self.top - 1, z],
                          'rotation': 180, 'scale': 1, 'color': 'yellow', 'speed': speed})
        self.c, self.half = (x, z), (1, 2)
        self._wp({'p': [x, self.top, z - 1.5]})
        return self

    def extra(self, x, z, size=2, top=None, color=None):
        """A platform off the main path (shortcuts, bonus spots). Does not move the cursor."""
        t = self.top if top is None else top
        self._platform(f'platform_{size}x{size}x1', x, z, t - 1, color or self.accent)
        return self

    def star(self, up=1.2, color='yellow'):
        self.objs.append({'id': self._id('star'), 'type': 'star', 'position': [self.c[0], self.top + up, self.c[1]],
                          'rotation': 0, 'scale': 1, 'color': color})
        return self

    def obj(self, type, dx=0, dy=0, dz=0, **extra):
        """Any catalogue piece, placed relative to the centre top of the piece we stand on."""
        o = {'id': self._id(type.replace('_', '')), 'type': type,
             'position': [self.c[0] + dx, self.top + dy, self.c[1] + dz], 'rotation': 0, 'scale': 1}
        o.update(extra)
        self.objs.append(o)
        return self

    def finish(self, size=6, gap=2.5):
        self.plat(size, gap)
        self.flag = {'id': 'flag_1', 'type': 'flag_C', 'color': self.accent, 'position': [self.c[0], self.top, self.c[1]]}
        return self

    def data(self):
        return {'id': self.id, 'name': self.name, 'topic': 'irregular_verbs', 'tiers': self.tiers,
                **({'sky': {'preset': self.sky}} if self.sky else {}),
                'spawn': {'id': 'spawn_1', 'position': [0, 2, 0]}, 'objects': self.objs,
                'flag': self.flag, 'prefabs': [], 'botPath': self.path}


# =====================================================================================
# Levels
# =====================================================================================

def sandbox():
    """Not a real level: one of each special piece, to check they behave."""
    L = Level('_sandbox', 'Sandbox', [1]).start()
    L.plat().slope().plat(gap=0).checkpoint()
    L.plat(dy=1).plat(dy=-1).drop().checkpoint()
    L.mover('along', 3, 6).plat().checkpoint().turn('E').mover('along', 3, 6).turn('N').plat().checkpoint()
    L.mover('y', 0.8, 3).plat().checkpoint()
    L.walkway(1).hammer(period=4, amplitude=70).walkway(1).checkpoint()
    L.conveyor(3).plat(6, gap=3).checkpoint().conveyor(-2.5).plat(gap=0)
    L.gate().plat(6, gap=2.5)
    L.finish()
    return L


def rest(L):
    """The wide platform after a gate."""
    return L.plat(6, gap=2.5)


def first_steps():
    """Level 1. A straight path, three gates: learn the answer blocks."""
    L = Level('first-steps', 'First Steps', [1], sky='morning').start()
    L.plat().gate().plat().plat().gate().plat().plat().gate()
    L.finish()
    return L


def zigzag():
    """Level 2. New idea: the path turns. Corner platforms are yellow."""
    L = Level('zigzag', 'Zigzag', [1], color='green', accent='yellow', sky='noon').start()
    L.plat().plat().gate(); rest(L)
    L.turn('E').plat().plat(gap=3).plat(color='yellow')
    L.turn('N').plat().plat().gate(); rest(L)
    L.turn('W').plat(2, gap=2).plat(2, gap=2).plat(2, gap=2).plat(4).plat(2, gap=2).plat(2, gap=2).plat(4, color='yellow')
    L.turn('N').plat().plat().gate(); rest(L)
    L.turn('E').plat(gap=3).plat(2, gap=2).plat(gap=3, color='yellow')
    L.turn('N').plat(gap=3).plat().gate(); rest(L)
    L.finish()
    return L


def climb():
    """Level 3. New idea: height. Steps to jump up, two ramps, then jumps back down."""
    L = Level('climb', 'The Climb', [1, 2], color='yellow', accent='green', sky='afternoon').start()
    L.plat().plat(dy=1, gap=2).plat(dy=1, gap=2).plat().gate(); rest(L)
    L.slope(color='green').plat(gap=0).plat().gate(); rest(L)
    L.turn('E').plat(dy=1, gap=2).plat(dy=1, gap=2).plat(2, dy=1, gap=2).plat(color='green')
    L.turn('N').plat().gate(); rest(L)
    L.slope(color='green').plat(gap=0)
    L.turn('W').plat(dy=1, gap=2).plat(2, gap=2).plat(dy=1, gap=2, color='green')
    L.turn('N').plat().gate(); rest(L)
    L.drop(dy=-2).drop(dy=-2, gap=3).drop(2, dy=-2).drop(dy=-2).plat().gate(); rest(L)
    L.finish()
    return L


def ferries():
    """Level 4. New idea: moving platforms (green). Ferries, lifts, a sideways ferry, two in a row."""
    L = Level('ferries', 'Ferries', [2], color='blue', accent='green', sky='golden').start()
    L.plat().mover('along', 3, 7).plat().gate(); rest(L)
    L.mover('y', 1.0, 4).plat().mover('y', 1.0, 4, phase=2).plat().gate(); rest(L)
    L.turn('E').mover('along', 4, 8).turn('N').plat().plat().gate(); rest(L)
    L.mover('along', 3, 7).mover('along', 3, 7, phase=3.5).plat().gate(); rest(L)
    L.turn('W').mover('along', 4, 9).turn('N').mover('y', 1.0, 4).plat().gate(); rest(L)
    L.finish()
    return L


def hammer_works():
    """Level 5. New idea: things that push you. Hammers knock you off, belts carry you."""
    L = Level('hammer-works', 'Hammer Works', [2, 3], color='blue', accent='yellow', sky='sunset').start()
    L.plat().walkway(1).walkway(1).hammer(4, 70).walkway(1).gate(); rest(L)
    L.conveyor(-2.5).conveyor(-2.5).plat(gap=0).gate(); rest(L)
    L.turn('E').plat().walkway(1).hammer(4, 70).walkway(1).plat(color='yellow')
    L.turn('N').plat().gate(); rest(L)
    L.conveyor(3).plat(6, gap=3).walkway(1).hammer(4, 70).walkway(1).walkway(1).hammer(4, 70, phase=180).walkway(1).gate(); rest(L)
    L.turn('W').plat(2, gap=2).plat(2, gap=2).plat(2, gap=2).plat(4, color='yellow')
    L.turn('N').plat().conveyor(-3).plat(gap=0).gate(); rest(L)
    L.walkway(1).hammer(3.5, 70).walkway(1).mover('along', 3, 7).plat().gate(); rest(L)
    L.finish()
    return L


def finale():
    """Level 6. Everything, plus a risky shortcut (one small stone with a star) past a detour."""
    L = Level('finale', 'Sky Finale', [3], color='blue', accent='yellow', sky='dusk').start()
    L.plat().plat(dy=1, gap=2).plat().gate(); rest(L)
    L.turn('E').mover('along', 3, 7, color='green').turn('N').plat().gate(); rest(L)
    L.slope(color='green').plat(gap=0).walkway(1).hammer(4, 70).walkway(1).gate(); rest(L)
    L.turn('W').plat(2, gap=2).plat(2, gap=2).plat(2, gap=2).plat(4, color='yellow')
    L.turn('N').plat().conveyor(-2.5).plat(gap=0).gate(); rest(L)
    L.mover('y', 1.0, 4, color='green').mover('along', 3, 7, color='green').plat().gate(); rest(L)
    # Detour E → N → W back to the same line; the shortcut is one small stone straight ahead.
    x0, z0, top0 = L.c[0], L.c[1], L.top
    L.turn('E').plat().plat(color='yellow').turn('N').plat().plat(color='yellow').turn('W').plat().plat(6)
    assert abs(L.c[0] - x0) < 0.01, 'detour must come back to the same line'
    mid = (z0 - 3 + L.c[1] + 3) / 2
    L.extra(x0, mid, size=2, top=top0, color='yellow')
    L.objs.append({'id': 'star_1', 'type': 'star', 'position': [x0, top0 + 1.3, mid], 'rotation': 0, 'scale': 1, 'color': 'yellow'})
    L.turn('N').drop(dy=-2).drop(dy=-2).plat().gate(); rest(L)
    L.walkway(1).hammer(4, 70).walkway(1).walkway(1).hammer(4, 70, phase=180).walkway(1).mover('along', 3, 7, color='green').plat().gate(); rest(L)
    L.finish()
    return L


LEVELS = [sandbox, first_steps, zigzag, climb, ferries, hammer_works, finale]


def main():
    args = sys.argv[1:]
    force = '--force' in args
    names = [a for a in args if not a.startswith('--')]
    for fn in LEVELS:
        L = fn()
        if names and L.id not in names and L.id.lstrip('_') not in names:
            continue
        path = os.path.join(OUT, f'{L.id}.json')
        if os.path.exists(path) and not force:
            print(f'skip   {L.id}.json (exists; --force {L.id} to overwrite)')
            continue
        with open(path, 'w') as f:
            json.dump(L.data(), f, indent=1)
        print(f'wrote  {L.id}.json  {len(L.objs)} objects, {sum(o["type"] == "gate" for o in L.objs)} gates, {len(L.path)} waypoints')


if __name__ == '__main__':
    main()
