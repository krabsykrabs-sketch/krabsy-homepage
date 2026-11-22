/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — smart mix (which words to ask next)
   Concept: docs/classroom-concept.md §4. Pure functions, no DOM, no storage:
   the caller passes the child's stats, so this runs in node tests too.

   A round of N items is mixed from three buckets:
     practice  ~40 %  seen, and mastery ≤ 2 (got it wrong, or it faded)
     fresh     ~40 %  never answered, from the child's current level
     repeat    ~20 %  known (mastery ≥ 3) and due again; the gap grows
                      with mastery (3 → 1 day, 4 → 3 days, 5 → 7 days)
   A bucket that runs short is filled from the others, so a new child gets
   only fresh words and a child who has seen everything gets practice and
   repeats. Known words that are not due yet come last.

   Levels: candidates carry a tier (1–3; prepositions have none = 1). Fresh
   words come from tier 1 first; tier t+1 opens once ≥ 60 % of tier t is
   known (mastery ≥ 3). A teacher's word list (later, phase 2) simply
   narrows the candidates.

   Mastery per item = the lowest mastery over its answered forms (a verb is
   only "known" when both its 2nd and 3rd form are).
   ────────────────────────────────────────────────────────────────────────── */

export const MIX = { practice: 0.4, fresh: 0.4, repeat: 0.2 };
export const KNOWN = 3;                       // mastery from which a word counts as known
export const INTERVAL_DAYS = { 3: 1, 4: 3, 5: 7 };
export const UNLOCK_SHARE = 0.6;              // share of a tier known before the next opens

const DAY = 86400000;

function _shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Summarise one item's per-form records → { seen, mastery, last } */
export function itemState(forms) {
  let seen = false, mastery = Infinity, last = 0;
  for (const rec of Object.values(forms || {})) {
    if (!rec || !rec.attempts) continue;
    seen = true;
    mastery = Math.min(mastery, rec.mastery || 0);
    const t = Date.parse(rec.last_seen);
    if (Number.isFinite(t) && t > last) last = t;
  }
  return seen ? { seen, mastery, last } : { seen: false, mastery: 0, last: 0 };
}

/**
 * Order candidate items for one round.
 *   candidates  [{ id, tier? }]   unique ids (verb base form / use-case id)
 *   stats       { [id]: { [form]: { attempts, mastery, last_seen } } }
 *   count       items wanted in the round
 * Returns ALL candidate ids: the first `count` follow the mix, the rest are
 * the fallback order (callers take from the front until they are full).
 */
export function rankItems({ candidates, stats = {}, count, now = Date.now(), rng = Math.random }) {
  const items = candidates.map((c) => ({ id: c.id, tier: c.tier || 1, ...itemState(stats[c.id]) }));

  // Which tiers are open for fresh words?
  const tiers = [...new Set(items.map((x) => x.tier))].sort((a, b) => a - b);
  let open = tiers[0];
  for (const t of tiers) {
    open = t;
    const inTier = items.filter((x) => x.tier === t);
    const known = inTier.filter((x) => x.seen && x.mastery >= KNOWN).length;
    if (known < UNLOCK_SHARE * inTier.length) break;
  }

  const practice = [], fresh = [], freshLocked = [], repeat = [], rest = [];
  for (const x of items) {
    if (!x.seen) {
      (x.tier <= open ? fresh : freshLocked).push(x);
    } else if (x.mastery < KNOWN) {
      practice.push(x);
    } else {
      const gap = (INTERVAL_DAYS[Math.min(5, x.mastery)] || 7) * DAY;
      x.overdue = (now - x.last) / gap;          // ≥ 1 means due
      (x.overdue >= 1 ? repeat : rest).push(x);
    }
  }
  // practice: weakest first, then most recently missed
  _shuffle(practice, rng).sort((a, b) => a.mastery - b.mastery || b.last - a.last);
  // fresh: lower tiers first, random inside a tier
  _shuffle(fresh, rng).sort((a, b) => a.tier - b.tier);
  _shuffle(freshLocked, rng).sort((a, b) => a.tier - b.tier);
  // repeat: most overdue first; rest: closest to due first
  repeat.sort((a, b) => b.overdue - a.overdue);
  rest.sort((a, b) => b.overdue - a.overdue);

  const want = {
    practice: Math.round(count * MIX.practice),
    fresh: Math.round(count * MIX.fresh),
  };
  want.repeat = Math.max(0, count - want.practice - want.fresh);

  const picked = [];
  const take = (list, n) => { while (n-- > 0 && list.length) picked.push(list.shift()); };
  take(practice, want.practice);
  take(fresh, want.fresh);
  take(repeat, want.repeat);
  // Fill shortfalls, best substitutes first.
  for (const list of [practice, fresh, repeat, rest, freshLocked]) take(list, count - picked.length);

  const head = _shuffle(picked, rng);             // don't serve all practice words first
  const tail = [...practice, ...fresh, ...repeat, ...rest, ...freshLocked];
  return [...head, ...tail].map((x) => x.id);
}
