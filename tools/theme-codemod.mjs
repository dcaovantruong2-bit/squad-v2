/**
 * One-shot codemod: rewrite raw colour literals in UI files to theme tokens.
 * Maps each literal to the perceptually nearest FLOODLIGHT token (CIE76 in Lab),
 * because floodlight was derived from these very colours — so "nearest" is
 * almost always the shade the author actually meant.
 *
 * Run with --write to apply; default is a dry-run report.
 *   node tools/theme-codemod.mjs          # preview
 *   node tools/theme-codemod.mjs --write  # apply
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const THEME = 'src/lib/theme/themes/floodlight.css';
const UI = [
  ...readdirSync('src/lib/screens').map(f => `src/lib/screens/${f}`),
  ...readdirSync('src/lib/components').map(f => `src/lib/components/${f}`),
  'src/App.svelte',
];

// ── Load token → hex from the default theme.
const tokens = [];
for (const m of readFileSync(THEME, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
  tokens.push({ name: m[1], hex: m[2].toLowerCase() });
}

const expand = h => h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h;
const rgb = h => { h = expand(h); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };

// sRGB → Lab for perceptual nearest-match.
function lab(hex) {
  let [r, g, b] = rgb(hex).map(v => v / 255);
  const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  [r, g, b] = [lin(r), lin(g), lin(b)];
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

const tokenLab = tokens.map(t => ({ ...t, lab: lab(t.hex) }));
function nearest(hex) {
  let best = null;
  for (const t of tokenLab) {
    const d = Math.hypot(...lab(hex).map((v, i) => v - t.lab[i]));
    if (!best || d < best.d) best = { name: t.name, d, hex: t.hex };
  }
  return best;
}

// Hand-pinned mappings where perceptual nearest is ambiguous or semantically
// wrong (e.g. a phase-tag colour must map to its semantic token, not whatever
// shade happens to be closest).
const PINNED = {
  // Semantic state — must map by MEANING, not by nearest shade.
  '#55a7e8': '--info',   '#66bce9': '--info',    '#60a5fa': '--info',   '#3b82f6': '--info',
  '#58c779': '--ok',     '#6cc080': '--ok',      '#70d68b': '--ok-soft', '#10b981': '--ok',
  '#72c886': '--ok',     '#78d08b': '--ok-soft', '#92c79e': '--ok-soft', '#39ff14': '--ok',
  '#69bd7d': '--ok',     '#4b9164': '--ok-strong','#57936a': '--ok-strong','#37764a': '--ok-strong',
  '#39774b': '--ok-strong','#39774d': '--ok-strong','#39784b': '--ok-strong','#39754b': '--ok-strong',
  '#437d52': '--ok-strong','#4d8c5f': '--ok-strong','#4f8c61': '--ok-strong',
  '#ef5d61': '--bad',    '#ef4444': '--bad',     '#d95f57': '--bad',    '#d4534e': '--bad',
  '#ff3344': '--bad',    '#b44a42': '--bad-strong','#b64d42': '--bad-strong',
  '#eea84d': '--warn',   '#e9a85d': '--accent-soft', '#f1bd57': '--warn-soft',
  '#e5aa54': '--warn',   '#f59e0b': '--warn',    '#ffd700': '--warn-soft',
  '#ad83d7': '--rare',   '#b58bdd': '--rare',    '#8b5cf6': '--rare',   '#a78bfa': '--rare',
  '#ec4899': '--rare',
  '#e87c42': '--accent', '#d37a45': '--accent-strong', '#dc894e': '--accent-soft',
  '#ff8c00': '--accent', '#ed7c3e': '--accent',  '#e0783c': '--accent',
  '#ffffff': '--paper-400', '#fff': '--paper-400',
  '#000000': '--on-accent', '#000': '--on-accent',

  // Printed ink on paper — muted brick reds used for kickers/headings. These
  // must NOT become --bad (which means failure) despite being reddish.
  '#8d4139': '--print-red',  '#8e4139': '--print-red',  '#8d3e38': '--print-red',
  '#8a3e37': '--print-red',  '#91433b': '--print-red',  '#9a3c38': '--print-red',
  '#81413b': '--print-red',  '#8b4e40': '--print-red',  '#9d4c40': '--print-red',
  '#a54842': '--print-red',  '#a8443e': '--print-red',  '#b74842': '--print-red',
  '#7a3034': '--print-red-deep', '#793235': '--print-red-deep',
  '#8a5c3f': '--print-brown',    '#7c5148': '--print-brown', '#bd7461': '--print-brown',
  '#9d5d3a': '--print-brown',    '#ad653e': '--print-brown',

  // Playing surface — the lit grass, distinct from dark pitch-themed panels.
  '#28583a': '--pitch-turf', '#234d31': '--pitch-turf-2',
};

const report = [];
let total = 0;

for (const file of UI) {
  let src = readFileSync(file, 'utf8');
  const before = src;
  const hits = new Map();

  src = src.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (raw) => {
    const key = raw.toLowerCase();
    const pin = PINNED[key] || PINNED[expand(key)];
    const tok = pin || nearest(key).name;
    const d = pin ? 0 : nearest(key).d;
    hits.set(`${raw} → var(${tok})${pin ? ' [pinned]' : ` [ΔE ${d.toFixed(1)}]`}`,
             (hits.get(`${raw} → var(${tok})${pin ? ' [pinned]' : ` [ΔE ${d.toFixed(1)}]`}`) || 0) + 1);
    total++;
    return `var(${tok})`;
  });

  // Coloured rgba() → token with alpha is not mechanical; flag for manual review.
  const colouredRgba = [...before.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
    .filter(m => !(m[1] === m[2] && m[2] === m[3]));

  if (hits.size || colouredRgba.length) {
    report.push({ file, hits, rgba: colouredRgba.length });
  }
  if (WRITE && src !== before) writeFileSync(file, src);
}

for (const r of report) {
  console.log(`\n${r.file}`);
  for (const [k, n] of [...r.hits].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)}×  ${k}`);
  }
  if (r.rgba) console.log(`   ⚠ ${r.rgba} coloured rgba() need manual tokenisation`);
}
console.log(`\n${WRITE ? 'REWROTE' : 'WOULD REWRITE'} ${total} literals across ${report.length} files`);
if (!WRITE) console.log('(dry run — pass --write to apply)');
