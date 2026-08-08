/** Cluster every hex literal in the UI so we can design a token palette from
 *  what the screens ACTUALLY use, rather than inventing one. */
import { readFileSync, readdirSync } from 'node:fs';

const files = [
  ...readdirSync('src/lib/screens').map(f => `src/lib/screens/${f}`),
  ...readdirSync('src/lib/components').map(f => `src/lib/components/${f}`),
];

const hex3to6 = h => h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h;
const toRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// Perceived luminance + saturation for role bucketing.
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = ([r, g, b]) => { const M = Math.max(r, g, b), m = Math.min(r, g, b); return M === 0 ? 0 : (M - m) / M; };
const hue = ([r, g, b]) => {
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  if (!d) return -1;
  let h;
  if (M === r) h = ((g - b) / d) % 6; else if (M === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

const counts = new Map();
const perFile = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    const h = hex3to6(m[0].toLowerCase());
    counts.set(h, (counts.get(h) || 0) + 1);
    if (!perFile.has(h)) perFile.set(h, new Set());
    perFile.get(h).add(f.split('/').pop().replace('.svelte', ''));
  }
}

const role = (h) => {
  const rgb = toRgb(h), L = lum(rgb), S = sat(rgb), H = hue(rgb);
  if (S < 0.12) return L < 0.12 ? 'neutral-ink' : L < 0.45 ? 'neutral-mid' : 'neutral-paper';
  if (H >= 80 && H < 170) return L < 0.25 ? 'green-deep' : 'green-bright';   // pitch / success
  if (H >= 170 && H < 260) return 'blue';                                    // info
  if (H >= 260 && H < 330) return 'violet';                                  // rare/legendary
  if (H >= 20 && H < 50) return L < 0.4 ? 'amber-deep' : 'amber-bright';     // warn / accent
  return L < 0.4 ? 'red-deep' : 'red-bright';                                // danger
};

const buckets = new Map();
for (const [h, n] of counts) {
  const r = role(h);
  if (!buckets.has(r)) buckets.set(r, []);
  buckets.get(r).push({ h, n, L: lum(toRgb(h)) });
}

console.log(`total distinct: ${counts.size}   total occurrences: ${[...counts.values()].reduce((a, b) => a + b, 0)}\n`);
for (const [r, list] of [...buckets].sort((a, b) => b[1].length - a[1].length)) {
  list.sort((a, b) => a.L - b.L);
  const occ = list.reduce((a, b) => a + b.n, 0);
  console.log(`${r.padEnd(14)} ${String(list.length).padStart(3)} shades, ${String(occ).padStart(3)} uses`);
  console.log('   ' + list.map(x => `${x.h}(${x.n})`).join(' '));
}
