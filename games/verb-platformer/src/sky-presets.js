// Per-level sky. A level JSON may carry an optional block
//
//   "sky": { "preset": "golden" }
//   "sky": { "preset": "noon", "zenith": "#3366cc", "sunDir": [0.3, 0.5, -0.8], "season": "fall" }
//
// Every key of a preset can be overridden one by one. No block = DEFAULT_PRESET.
//
//   zenith / horizon      sky dome gradient
//   cloudLit / cloudShade cloud sea: sunlit tops / creases (keep the shade a MID value: the
//                         pale blue word bubbles and the coral sign must stand out against it)
//   fog, fogNear, fogFar  scene fog (colour defaults to the horizon so everything meets there)
//   sun                   colour of the sun disc and its glow
//   sunDir                direction TOWARDS the sun, [x, y, z] (y = height; −z is "ahead" at the start)
//   light, lightIntensity the directional light on the level
//   hemiSky / hemiGround / hemiIntensity   hemisphere fill (tops get hemiSky, undersides hemiGround)
//   puff                  colour of the decorative cloud puffs
//   stars                 0…1
//   season                texture of the background islands: "summer" (default) | "fall" | "winter"

export const DEFAULT_PRESET = 'noon';

export const SKY_PRESETS = {
  morning: {
    zenith: '#4b93e6', horizon: '#ffe6d6',
    cloudLit: '#fff3e2', cloudShade: '#a9a4d6',
    sun: '#fff0c8', sunDir: [0.55, 0.3, -0.78],
    light: '#ffe6c2', lightIntensity: 0.95,
    hemiSky: '#d5e6ff', hemiGround: '#c9a58f', hemiIntensity: 0.95,
    puff: '#fff6ee', fogNear: 110, fogFar: 400, stars: 0, season: 'summer',
  },
  noon: {
    zenith: '#2f7ae0', horizon: '#d6eafc',
    cloudLit: '#fff8ea', cloudShade: '#9a9fd2',
    sun: '#fffbe6', sunDir: [0.35, 0.72, -0.6],
    light: '#fff0d6', lightIntensity: 1.0,
    hemiSky: '#d9e9ff', hemiGround: '#bfa590', hemiIntensity: 0.95,
    puff: '#ffffff', fogNear: 120, fogFar: 420, stars: 0, season: 'summer',
  },
  afternoon: {
    zenith: '#3a78d2', horizon: '#f7e8c9',
    cloudLit: '#fff1d4', cloudShade: '#9c98cb',
    sun: '#fff2c0', sunDir: [-0.55, 0.42, -0.72],
    light: '#ffe4b0', lightIntensity: 1.0,
    hemiSky: '#d6e4fb', hemiGround: '#c7a37f', hemiIntensity: 0.92,
    puff: '#fff7e6', fogNear: 110, fogFar: 400, stars: 0, season: 'summer',
  },
  golden: {
    zenith: '#4d7fd0', horizon: '#ffd9a3',
    cloudLit: '#ffe8bd', cloudShade: '#a78fc0',
    sun: '#ffd27a', sunDir: [-0.5, 0.2, -0.84],
    light: '#ffd08a', lightIntensity: 1.0,
    hemiSky: '#dbe0f5', hemiGround: '#cf9d72', hemiIntensity: 0.92,
    puff: '#fff0cf', fogNear: 100, fogFar: 380, stars: 0, season: 'summer',
  },
  sunset: {
    zenith: '#5560b8', horizon: '#f9c0a4',   // pale salmon, not orange: the question sign is orange
    cloudLit: '#ffcf9c', cloudShade: '#94689f',
    sun: '#ff9c52', sunDir: [0.45, 0.1, -0.89],
    light: '#ffb884', lightIntensity: 0.95,
    hemiSky: '#e0d4ee', hemiGround: '#c98a6c', hemiIntensity: 0.95,
    puff: '#ffd9b8', fogNear: 95, fogFar: 360, stars: 0, season: 'fall',
  },
  dusk: {
    zenith: '#161d52', horizon: '#d9849a',
    cloudLit: '#b89ad0', cloudShade: '#4a478c',
    sun: '#ffb08a', sunDir: [-0.3, 0.03, -0.95],
    light: '#d9c8ff', lightIntensity: 0.8,
    hemiSky: '#cfd2ff', hemiGround: '#b98aa0', hemiIntensity: 1.0,
    puff: '#c9b3e0', fogNear: 95, fogFar: 360, stars: 0.9, season: 'winter',
  },
};

const COLOR_KEYS = ['zenith', 'horizon', 'cloudLit', 'cloudShade', 'fog', 'sun', 'light', 'hemiSky', 'hemiGround', 'puff'];
const NUMBER_KEYS = ['fogNear', 'fogFar', 'lightIntensity', 'hemiIntensity', 'stars'];
const SEASONS = ['summer', 'fall', 'winter'];

// Level `sky` block → a complete, validated set of values (bad or missing keys fall back).
export function resolveSky(block) {
  const b = (block && typeof block === 'object') ? block : {};
  const base = SKY_PRESETS[b.preset] || SKY_PRESETS[DEFAULT_PRESET];
  const out = { ...base, sunDir: [...base.sunDir] };
  for (const k of COLOR_KEYS) {
    if (typeof b[k] === 'string' && /^#[0-9a-f]{6}$/i.test(b[k])) out[k] = b[k];
  }
  for (const k of NUMBER_KEYS) {
    if (Number.isFinite(b[k])) out[k] = b[k];
  }
  if (Array.isArray(b.sunDir) && b.sunDir.length === 3 && b.sunDir.every(Number.isFinite)
      && Math.hypot(...b.sunDir) > 1e-3) {
    out.sunDir = [...b.sunDir];
  }
  if (SEASONS.includes(b.season)) out.season = b.season;
  if (!out.fog) out.fog = out.horizon;
  return out;
}
