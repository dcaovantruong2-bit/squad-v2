/**
 * Pass 2 of the theme codemod: coloured rgba() → translucent overlay tokens.
 * Pass 1 (theme-codemod.mjs) handled opaque hex. Achromatic rgba (pure
 * black/white scrims and shadows) is left alone — theme-lint permits it since
 * a shadow is geometry, not colour.
 *
 *   node tools/theme-codemod-rgba.mjs          # preview
 *   node tools/theme-codemod-rgba.mjs --write  # apply
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const UI = [
  ...readdirSync('src/lib/screens').map(f => `src/lib/screens/${f}`),
  ...readdirSync('src/lib/components').map(f => `src/lib/components/${f}`),
  'src/App.svelte',
];

const hue = (r, g, b) => {
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  if (!d) return -1;
  let h;
  if (M === r) h = ((g - b) / d) % 6; else if (M === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Choose an overlay token from hue + lightness + alpha. */
function pick(r, g, b, a) {
  const H = hue(r, g, b), L = lum(r, g, b);
  const green = H >= 80 && H < 175;
  const warm  = (H >= 0 && H < 45) || H >= 330;

  const S = (() => { const M = Math.max(r, g, b), m = Math.min(r, g, b); return M ? (M - m) / M : 0; })();

  // Near-black overlays → scrims, regardless of faint tint.
  if (L < 0.18) return a >= 0.86 ? '--scrim-darker' : '--scrim-dark';

  // Barely-saturated greys are paper texture, NOT pitch colour. Must be tested
  // before the hue buckets or e.g. rgba(70,73,66,.2) reads as "green".
  if (S < 0.16) {
    if (L > 0.72) return a >= 0.4 ? '--pitch-line-strong' : '--pitch-line';  // cream markings
    return a <= 0.10 ? '--paper-grain' : '--paper-tint';
  }

  if (L > 0.72) return a >= 0.4 ? '--pitch-line-strong' : '--pitch-line';    // cream markings

  if (green) return a <= 0.16 ? '--pitch-glow-soft' : (a <= 0.34 ? '--pitch-glow' : '--ok-tint');

  // Warm hues: the accent family. Only true reds mean failure — an orange wash
  // at any alpha is an accent wash, so alpha must not flip its meaning.
  if (warm) {
    // #e87c42 (the club orange) sits at hue ~21°, so the red/orange boundary
    // must be below that or the accent wash gets mislabelled as failure.
    const red = H < 14 || H >= 330;
    return red ? '--bad-tint' : '--accent-tint';
  }
  return a <= 0.10 ? '--paper-grain' : '--paper-tint';
}

const RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
let total = 0;
const report = [];

for (const file of UI) {
  const before = readFileSync(file, 'utf8');
  const hits = new Map();
  const after = before.replace(RE, (raw, rs, gs, bs, as) => {
    const r = +rs, g = +gs, b = +bs, a = as === undefined ? 1 : +as;
    if (r === g && g === b) return raw;            // achromatic: allowed, skip
    const tok = pick(r, g, b, a);
    hits.set(`${raw} → var(${tok})`, (hits.get(`${raw} → var(${tok})`) || 0) + 1);
    total++;
    return `var(${tok})`;
  });
  if (hits.size) report.push({ file, hits });
  if (WRITE && after !== before) writeFileSync(file, after);
}

for (const r of report) {
  console.log(`\n${r.file}`);
  for (const [k, n] of [...r.hits].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(2)}×  ${k}`);
}
console.log(`\n${WRITE ? 'REWROTE' : 'WOULD REWRITE'} ${total} coloured rgba() across ${report.length} files`);
if (!WRITE) console.log('(dry run — pass --write to apply)');
