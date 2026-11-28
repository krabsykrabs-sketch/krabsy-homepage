import { createGame } from './src/game.js';
import { Track } from './src/analytics.js';
import { toggleMuted } from './src/sound.js';
import { fontsReady } from './src/shell-bits.js';
import { getHero } from './src/hero.js';
import { createMenu } from './src/menu.js';
import { createUI } from './src/ui.js';
import { applyStatic, t } from './src/i18n.js';
import { getBest, saveResult, starsFor, hintSeen, markHintSeen } from './src/progress.js';
import { IS_TOUCH } from './src/shell-bits.js';

applyStatic();
document.documentElement.classList.toggle('is-touch', IS_TOUCH);
// Levels are editor-format JSON files in assets/levels/, listed in assets/levels/index.json.
// A new level = one file + one line in that list. (src/levels/*.js are the three original
// built-in layouts; they are no longer in the menu.)

async function loadJsonLevels() {
  try {
    const dir = './assets/levels/';
    const files = await (await fetch(`${dir}index.json`, { cache: 'no-cache' })).json();
    const levels = await Promise.all(files.map(async f => {
      const lvl = await (await fetch(dir + f, { cache: 'no-cache' })).json();
      if (!lvl.id) lvl.id = f.replace(/\.json$/, '');
      if (!lvl.name) lvl.name = lvl.id;
      return lvl;
    }));
    return levels;
  } catch (e) {
    console.warn('[krabsy3d] could not load assets/levels/index.json', e);
    return [];
  }
}
const LEVELS = await loadJsonLevels();

const canvas = document.getElementById('game');

function showFatal(msg) {
  console.error(msg);
  const loader = document.getElementById('loader');
  if (loader) loader.hidden = true;
  let el = document.getElementById('fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal';
    Object.assign(el.style, {
      position: 'fixed', inset: '20px', padding: '16px 20px',
      background: 'rgba(0,0,0,0.85)', color: '#ffb4b4', fontFamily: 'monospace',
      fontSize: '13px', whiteSpace: 'pre-wrap', overflow: 'auto', zIndex: 1000,
      border: '2px solid #ff6464', borderRadius: '8px',
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
}
window.addEventListener('error', e => showFatal(`Error: ${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', e => showFatal(`Unhandled rejection: ${e.reason?.stack || e.reason}`));

console.log('[krabsy3d] booting… build: v6.0-shell');

const params = new URLSearchParams(window.location.search);
// ?level=editor: the editor's Playtest (and the play-test bot). Nothing is saved there, the
// first-run hint is skipped and the results only offer Retry.
const editorMode = params.get('level') === 'editor';

const game = await createGame(canvas);

// ---- Shell state ----
// 'boot' → 'menu' → 'loading' → ('hint' →) 'playing' ⇄ 'paused' → 'results' → …
let state = 'boot';
// The state is mirrored on <body data-state> (CSS shows the touch controls only while playing).
function setState(next) { state = next; document.body.dataset.state = next; }
let current = null;        // the level being played
let run = null;            // this attempt's score sheet
let lockLostAt = 0;
let tipNow = null;          // the tutorial hint showing (see "Tutorial hints" below)

const newRun = () => ({ wrong: 0, firstTry: 0, cleared: 0, gates: 0, missFlag: false, missed: new Map() });

const ui = createUI({
  onPause: () => pauseGame(),
  onResume: () => resumeGame(),
  onRestart: () => { if (current) startLevel(current); },
  onLevels: () => returnToMenu(),
  onHintGo: () => dismissHint(),
  onRetry: () => { if (current) startLevel(current); },
  onNext: () => {
    const next = LEVELS[LEVELS.indexOf(current) + 1];
    if (next) startLevel(next); else returnToMenu();
  },
});

// Hero switches run one after the other; each makes the player match the saved choice
// (a no-op when it already does). Started on a pick, awaited at the next level start.
let heroSwitch = Promise.resolve();
function applyHero() {
  heroSwitch = heroSwitch.then(() => game.setHero(getHero())).catch(e => console.warn('[krabsy3d] hero switch failed', e));
  return heroSwitch;
}

const menu = createMenu({
  levels: LEVELS,
  onPick: (lvl) => startLevel(lvl),
  onHero: () => { applyHero(); },
});

// Desktop only: tell the player how to get mouse look when the mouse is not captured.
function updateLookTip() {
  ui.setLookTip(state === 'playing' && !IS_TOUCH && !document.pointerLockElement);
}

// Call from a click / key handler: the mouse is captured right away (except when the
// first-run hint comes up, which needs the cursor).
async function startLevel(lvl) {
  // A level with its own hints (the tutorial) replaces the first-run hint card.
  const hasTips = Array.isArray(lvl.tips) && lvl.tips.length > 0;
  if (hasTips && !editorMode && !hintSeen()) markHintSeen();
  const wantHint = !editorMode && params.get('hint') !== '0' && !hintSeen();
  tipNow = null;
  ui.hideTips();
  Track.abandon();           // a restart mid-level counts as "left" (no event)
  setState('loading');
  current = lvl;
  run = newRun();
  game.setPaused(false);
  menu.hide();
  ui.hideResults();
  ui.hidePause();
  ui.hideHint();
  ui.hideAnswerReveal();
  ui.setLookTip(false);
  ui.setLevel(t(`name.${lvl.id}`) || lvl.name);
  ui.setTime(0);
  ui.showLoader();
  if (!wantHint) game.lockPointer();
  try {
    await fontsReady();      // the signs are drawn with the site font
    if (!editorMode) await applyHero();   // the hero picked on the title screen
    await game.startLevel(lvl);
  } finally {
    ui.hideLoader();
  }
  if (current !== lvl || state !== 'loading') return;
  Track.levelStart(editorMode ? 0 : LEVELS.indexOf(lvl) + 1);
  ui.showHud();
  if (wantHint) {
    setState('hint');
    game.setPaused(true);
    ui.showHint();
  } else {
    setState('playing');
    setTimeout(updateLookTip, 600);
  }
}

function dismissHint() {
  if (state !== 'hint') return;
  markHintSeen();
  ui.hideHint();
  setState('playing');
  game.setPaused(false);
  game.lockPointer();
  setTimeout(updateLookTip, 600);
}

function pauseGame() {
  if (state !== 'playing') return;
  setState('paused');
  game.setPaused(true);
  if (document.pointerLockElement) document.exitPointerLock();
  ui.setLookTip(false);
  ui.showPause(current && (t(`name.${current.id}`) || current.name), { canLeave: !editorMode });
}

function resumeGame() {
  if (state !== 'paused') return;
  setState('playing');
  ui.hidePause();
  game.setPaused(false);
  game.lockPointer();
  setTimeout(updateLookTip, 600);
}

function returnToMenu() {
  Track.abandon();
  ui.hideTips();
  setState('menu');
  current = null;
  game.stopGame();
  ui.hideHud();
  ui.hideResults();
  ui.hidePause();
  ui.hideHint();
  ui.hideAnswerReveal();
  menu.show();
}

// Full chain (`go → went → gone`) of every missed verb. A single question may hide the 3rd
// form (it is the next gate's answer), so the forms are pieced together from all the gates.
function missedChains() {
  const forms = new Map();           // verb → [base, 2nd, 3rd]
  const BLANK = /^_+$/;
  const learn = (q) => {
    if (!q?.verb) return;
    const f = forms.get(q.verb) || [q.verb, null, null];
    const parts = Array.isArray(q.parts) ? q.parts : String(q.chain || '').split(' → ');
    for (const i of [1, 2]) if (parts[i] && !BLANK.test(parts[i])) f[i] = parts[i];
    if (q.form === 'past') f[1] = q.correct;
    else if (q.form === 'participle') f[2] = q.correct;
    forms.set(q.verb, f);
  };
  game.getGateQuestions().forEach(learn);
  run.missed.forEach(learn);
  return [...run.missed.values()].map(q => {
    if (q.full) return q.full;
    const f = forms.get(q.verb);
    return f && f[1] && f[2] ? f.join(' → ') : (q.chain || q.prompt || q.verb);
  });
}

function finishLevel() {
  if (!current || state === 'results') return;
  ui.hideTips();
  setState('results');
  if (document.pointerLockElement) document.exitPointerLock();
  const time = game.getTime();
  // A gate that was never answered (jumped past) counts like a wrong answer.
  const skipped = Math.max(0, run.gates - run.cleared);
  const stars = starsFor(run.wrong + skipped);
  const idx = LEVELS.indexOf(current);
  Track.levelEnd({ stars, seconds: time, gates: run.gates });
  let saved = null;
  let allDone = false;
  if (!editorMode) {
    saved = saveResult(current.id, { stars, time });
    allDone = saved.firstFinish && LEVELS.length > 0 && LEVELS.every(l => getBest(l.id));
  }
  ui.hideHud();
  ui.hideAnswerReveal();
  ui.showResults({
    levelName: t(`name.${current.id}`) || current.name,
    stars,
    time,
    bestTime: saved?.best?.time ?? null,
    newBestTime: !!saved?.newBestTime,
    firstTry: Math.min(run.firstTry, run.gates),
    gates: run.gates,
    missed: missedChains(),
    perfect: run.gates > 0 && run.firstTry >= run.gates,
    hasNext: !editorMode && idx >= 0 && idx < LEVELS.length - 1,
    canLeave: !editorMode,
    allDone,
  });
}

game.setHandlers({
  onFall: (cause) => {
    ui.deathFlash();
    if (cause === 'skip') { tipNow = null; ui.showNote(t('skipBack')); }
    if (run) Track.fell(run.cleared + 1, cause || 'gap');
  },
  onGateCleared: (cleared, total, question) => {
    ui.setProgress(cleared, total);
    if (run) { run.gates = total; run.cleared = cleared; }
    if (!question) return;            // the first call of a level only paints the progress
    if (run) {
      if (!run.missFlag) { run.firstTry++; Track.answer(question, true); }
      Track.gatePassed(cleared, !run.missFlag, game.getTime());
      run.missFlag = false;
    }
    // Teach beat: the full chain, in green.
    if (question.chain) ui.showAnswerReveal(question.chain, null);
  },
  onGateWrong: (question, opt, gateIdx) => {
    if (run) {
      if (!run.missFlag) Track.answer(question, false);   // first answer at this gate only
      Track.wrongAnswer((gateIdx ?? run.cleared) + 1);
      run.wrong++;
      run.missFlag = true;
      // one entry per verb + blank; the full chain is built at the end (missedChains)
      if (question) run.missed.set(`${question.verb}|${question.form}`, question);
    }
    // Teach beat: the word the player stepped on (red ✗) and the full chain.
    if (question?.chain) ui.showAnswerReveal(question.chain, opt?.text ?? null, question.teach || '');
  },
  onComplete: () => finishLevel(),
  setHudQuestion: (text) => ui.setHudQuestion(text),
});

// ---- Clock ----
setInterval(() => { if (state === 'playing') ui.setTime(game.getTime()); }, 200);

// ---- Tutorial hints (level `tips`: [{ id, p: [x, y, z], r }], tools/make_levels.py) ----
// Entering a zone shows its hint until the next zone. The big controls card ('controls')
// fades as soon as the player leaves its zone (and comes back after a respawn there).
setInterval(() => {
  if (state !== 'playing' || !Array.isArray(current?.tips)) return;
  const p = game.getPlayerPos();
  let hit = null;
  for (const tip of current.tips) {
    if (Math.hypot(p.x - tip.p[0], p.z - tip.p[2]) <= tip.r && Math.abs(p.y - tip.p[1]) < 2.5) hit = tip;
  }
  if (hit && hit.id !== tipNow) { tipNow = hit.id; ui.showTip(hit.id); }
  else if (!hit && tipNow === 'controls') { tipNow = null; ui.showTip(null); }
}, 150);

// ---- Pause triggers ----
// Esc while the mouse is captured never reaches the page: the browser releases the mouse,
// and that release is what opens the pause card.
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') {
    lockLostAt = performance.now();
    pauseGame();
  }
  updateLookTip();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') { e.preventDefault(); pauseGame(); }
    else if (state === 'paused' && performance.now() - lockLostAt > 400) { e.preventDefault(); resumeGame(); }
  } else if (e.code === 'KeyM' && state !== 'menu') {
    toggleMuted();
  } else if (e.code === 'Enter') {
    if (state === 'hint') { e.preventDefault(); dismissHint(); }
    else if (state === 'paused') { e.preventDefault(); resumeGame(); }
    else if (state === 'results') { e.preventDefault(); ui.resultsPrimary()?.click(); }
  }
});

// For tests and the console.
window.__krabsyShell = { state: () => state, level: () => current, run: () => run, pause: pauseGame, resume: resumeGame };

// ?level=N&pos=Z URL params skip the menu and (optionally) teleport the player to z=Z.
// Used for headless screenshot capture during dev; harmless in normal use.
// ?level=editor reads the current editor draft from localStorage and starts it directly —
// this is the editor's "Playtest" button target. Set by editor.html before opening this page.
const autoLevelRaw = params.get('level') || '';
const autoLevel = parseInt(autoLevelRaw, 10);
const autoPos   = parseFloat(params.get('pos') || '');
if (autoLevelRaw === 'editor') {
  try {
    const raw = localStorage.getItem('krabsy_3d_editor_level');
    if (!raw) {
      showFatal('Editor playtest: no draft level found in localStorage. Open editor.html and click Playtest from there.');
    } else {
      const draft = JSON.parse(raw);
      if (!draft.id) draft.id = 'editor-draft';
      if (!draft.name) draft.name = 'Editor Draft';
      console.log('[krabsy3d] playtest draft:', {
        objects: draft.objects?.length ?? 0,
        spawn: draft.spawn?.position,
        flag: draft.flag?.position,
        firstObjectTypes: (draft.objects || []).slice(0, 5).map(o => `${o.type}@[${o.position}]`),
      });
      if (!draft.objects || draft.objects.length === 0) {
        showFatal('Editor playtest: this level has no placed objects (just spawn). Place at least one platform in the editor, then click Playtest again.');
      } else {
        // startLevel is async; wrap to surface late rejections as the red overlay too.
        Promise.resolve(startLevel(draft)).catch(e =>
          showFatal(`Editor playtest: level load failed — ${e?.stack || e?.message || e}`),
        );
      }
    }
  } catch (e) {
    showFatal(`Editor playtest: failed to load draft level — ${e?.stack || e?.message || e}`);
  }
} else if (autoLevel >= 1 && autoLevel <= LEVELS.length) {
  startLevel(LEVELS[autoLevel - 1]);
  if (Number.isFinite(autoPos)) {
    // Defer until after game.startLevel finishes loading (player is created on game init).
    setTimeout(() => {
      // Reach into the game internals through a small back-door for dev only.
      const ev = new CustomEvent('krabsy-teleport', { detail: { x: 0, y: 2, z: autoPos } });
      window.dispatchEvent(ev);
    }, 1500);
  }
} else {
  ui.hideLoader();
  returnToMenu();
}
console.log('[krabsy3d] ready');
