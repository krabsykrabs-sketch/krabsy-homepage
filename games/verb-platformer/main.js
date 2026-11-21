import { createGame } from './src/game.js';
import { createMenu, markCompleted } from './src/menu.js';
import { createUI } from './src/ui.js';
import level2 from './src/levels/level-2.js';
import level3 from './src/levels/level-3.js';

// Levels are editor-format JSON files in assets/levels/, listed in assets/levels/index.json.
// A new level = one file + one line in that list. Levels 2 and 3 are still the old built-in
// layouts (they use moving platforms, which the JSON format does not have yet).
const LEGACY_LEVELS = [level2, level3];

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
const LEVELS = [...await loadJsonLevels(), ...LEGACY_LEVELS];

const canvas = document.getElementById('game');

function showFatal(msg) {
  console.error(msg);
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

console.log('[krabsy3d] booting… build: v5.0-three-levels');

const game = await createGame(canvas);

const ui = createUI({
  onMenu: () => returnToMenu(),
});

const menu = createMenu({
  levels: LEVELS,
  onPick: (lvl) => startLevel(lvl),
});

function startLevel(lvl) {
  menu.hide();
  ui.hideAnswerReveal();
  ui.showHud();
  ui.setLevel(lvl.name);
  ui.hideLevelComplete();
  game.startLevel(lvl);
}

function returnToMenu() {
  game.stopGame();
  ui.hideHud();
  ui.hideLevelComplete();
  ui.hideAnswerReveal();
  menu.show();
}

game.setHandlers({
  onFall: () => { ui.deathFlash(); },
  onGateCleared: (cleared, total, question) => {
    // currentGate is 1-based (the next gate to attempt).
    ui.setProgress(cleared + 1, total);
    // Teach beat: the full chain, in green.
    if (question) ui.showAnswerReveal(question.chain, null);
  },
  onGateWrong: (question, opt) => {
    // Teach beat: the word the player stepped on (red ✗) and the full chain.
    ui.showAnswerReveal(question.chain, opt?.text ?? null);
  },
  onComplete: (levelId) => {
    markCompleted(levelId);
    ui.showLevelComplete();
    setTimeout(returnToMenu, 2000);
  },
  setHudQuestion: (text) => ui.setHudQuestion(text),
});

// ?level=N&pos=Z URL params skip the menu and (optionally) teleport the player to z=Z.
// Used for headless screenshot capture during dev; harmless in normal use.
// ?level=editor reads the current editor draft from localStorage and starts it directly —
// this is the editor's "Playtest" button target. Set by editor.html before opening this page.
const params = new URLSearchParams(window.location.search);
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
  menu.show();
}
console.log('[krabsy3d] ready');
