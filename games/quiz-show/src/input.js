// Input: who answered what. Turns keys, clicks and taps into show actions, so a
// network input (phase 4: children on their own devices) can replace this file later.
// Keys use `e.key` (the printed letter), so team 4's Z works on German QWERTZ keyboards too.

export const PICK_KEYS = [['1', '2', '3', '4'], ['q', 'w', 'e', 'r'], ['a', 's', 'd', 'f'], ['z', 'x', 'c', 'v']];
export const BUZZ_KEYS = ['a', 'l', 'v', 'p'];
export const ANSWER_KEYS = ['1', '2', '3', '4'];

export class Input {
  constructor(show, { onSelect = () => {}, onAdvance = null } = {}) {
    this.show = show;
    this.onAdvance = onAdvance || (() => show.advance());
    this.selected = null;           // team chosen with a click on its podium (mouse flow)
    this.onSelect = onSelect;
    this._key = (e) => this.key(e);
    window.addEventListener('keydown', this._key);
  }

  detach() { window.removeEventListener('keydown', this._key); }

  select(team) {
    this.selected = this.selected === team ? null : team;
    this.onSelect(this.selected);
  }

  // Podium click / tap: in round 2 it is that team's buzzer, otherwise it selects the team.
  podium(team) {
    const s = this.show.state, kind = this.show.round?.kind;
    if (kind === 'buzz') { if (s.phase === 'ask') this.show.buzz(team); return; }
    if (s.phase === 'ask') this.select(team);
  }

  // Answer box click / tap.
  box(option) {
    const s = this.show.state, kind = this.show.round?.kind;
    if (kind === 'buzz') { this.show.answer(option); return; }
    if (s.phase !== 'ask') return;
    let team = this.selected;
    if (team == null) {
      // Nobody selected: the next team without an answer (fast for the card variant).
      team = s.teams.findIndex((t) => !(t.i in s.picks));
      if (team < 0) return;
    }
    this.selected = null; this.onSelect(null);
    this.show.pick(team, option);
  }

  key(e) {
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type === 'text')) return; // team name fields
    if (e.repeat) return;
    const k = e.key.toLowerCase(), s = this.show.state, kind = this.show.round?.kind;
    if (k === 'enter' || k === ' ') {
      e.preventDefault(); // also stops a focused answer box from being clicked again
      this.onAdvance(); return;
    }
    if (kind === 'buzz') {
      if (s.phase === 'ask') {
        const t = BUZZ_KEYS.indexOf(k);
        if (t >= 0 && t < s.teams.length) { e.preventDefault(); this.show.buzz(t); }
      } else if (s.phase === 'answering') {
        const o = ANSWER_KEYS.indexOf(k);
        if (o >= 0) { e.preventDefault(); this.show.answer(o); }
      }
      return;
    }
    if (s.phase !== 'ask') return;
    for (let t = 0; t < s.teams.length; t++) {
      const o = PICK_KEYS[t].indexOf(k);
      if (o >= 0) { e.preventDefault(); this.show.pick(t, o); return; }
    }
  }
}
