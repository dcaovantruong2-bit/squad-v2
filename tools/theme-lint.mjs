/**
 * Fails if UI code contains raw colour literals instead of theme tokens, or
 * references a token no theme defines. This is what keeps the redesign a
 * one-file job. Run: node tools/theme-lint.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';

const UI_DIRS = ['src/lib/screens', 'src/lib/components'];
const THEME_DIR = 'src/lib/theme/themes';
const TOKENS = 'src/lib/theme/tokens.css';

const uiFiles = UI_DIRS.flatMap(d => readdirSync(d).map(f => `${d}/${f}`))
  .concat(['src/App.svelte']);

// ── 1. No raw colour literals in UI code.
// rgba() is allowed ONLY for shadow/scrim (pure black or white) — a coloured
// rgba() is a themed value in disguise and must be a token.
const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(([^)]*)\)|\bhsla?\(/g;
const violations = [];

for (const f of uiFiles) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (line.includes('theme-lint-allow')) return;
    for (const m of line.matchAll(COLOUR_RE)) {
      const raw = m[0];
      if (raw.startsWith('rgb')) {
        const nums = (m[1] || '').split(',').map(s => parseFloat(s.trim()));
        const [r, g, b] = nums;
        const achromatic = (r === g && g === b);          // black/white/grey scrim
        if (achromatic) continue;
        if (raw.includes('var(')) continue;                // rgba(var(--x)/a)
      }
      violations.push({ f, line: i + 1, raw, text: line.trim().slice(0, 90) });
    }
  });
}

// ── 2. Every var(--token) used in UI must exist in tokens.css or EVERY theme.
const declared = new Set();
const declRe = /^\s*(--[a-z0-9-]+)\s*:/gim;
for (const m of readFileSync(TOKENS, 'utf8').matchAll(declRe)) declared.add(m[1]);

const themeFiles = readdirSync(THEME_DIR).filter(f => f.endsWith('.css'));
const perTheme = new Map();
for (const tf of themeFiles) {
  const set = new Set();
  for (const m of readFileSync(`${THEME_DIR}/${tf}`, 'utf8').matchAll(declRe)) set.add(m[1]);
  perTheme.set(tf, set);
}

// A file may declare its own local custom properties — component-scoped
// aliases (--paper: var(--paper-100)) and per-instance dynamic values
// (--card-color set from JS). Those are legitimate: collect per-file so a
// local definition in file A doesn't excuse an undefined use in file B.
const used = [];
const localDecls = new Map();
for (const f of uiFiles) {
  const src = readFileSync(f, 'utf8');
  const locals = new Set();
  // matches  --x: value  in <style> AND  --x:{expr}  in inline style attrs
  for (const m of src.matchAll(/(--[a-z0-9-]+)\s*:/gi)) locals.add(m[1]);
  localDecls.set(f, locals);
  for (const m of src.matchAll(/var\((--[a-z0-9-]+)/gi)) used.push({ f, token: m[1] });
}

const allThemesHave = t => [...perTheme.values()].every(s => s.has(t));
const undefinedTokens = [...new Set(
  used.filter(({ f, token }) =>
    !declared.has(token) && !allThemesHave(token) && !localDecls.get(f).has(token)
  ).map(u => `${u.token}  (in ${u.f.split('/').pop()})`)
)];

// ── 3. Themes must agree on the token set (no theme missing a colour).
const union = new Set([...perTheme.values()].flatMap(s => [...s]));
const incomplete = [];
for (const [tf, set] of perTheme) {
  const missing = [...union].filter(t => !set.has(t));
  if (missing.length) incomplete.push({ tf, missing });
}

// ── Report
let failed = false;
if (violations.length) {
  failed = true;
  console.log(`\n✗ ${violations.length} raw colour literal(s) in UI code — must be theme tokens:\n`);
  const byFile = {};
  for (const v of violations) (byFile[v.f] ||= []).push(v);
  for (const [f, vs] of Object.entries(byFile)) {
    console.log(`  ${f}  (${vs.length})`);
    for (const v of vs.slice(0, 6)) console.log(`    L${String(v.line).padStart(4)}  ${v.raw.padEnd(24)} ${v.text}`);
    if (vs.length > 6) console.log(`    … and ${vs.length - 6} more`);
  }
}
if (undefinedTokens.length) {
  failed = true;
  console.log(`\n✗ token(s) used in UI but not defined by tokens.css or all themes:`);
  for (const t of undefinedTokens) console.log(`    ${t}`);
}
if (incomplete.length) {
  failed = true;
  console.log(`\n✗ theme(s) missing tokens other themes define:`);
  for (const { tf, missing } of incomplete) console.log(`    ${tf}: ${missing.join(', ')}`);
}

if (!failed) {
  console.log(`✓ theme contract clean — ${new Set(used.map(u=>u.token)).size} tokens used across ${uiFiles.length} UI files, ${themeFiles.length} themes in sync`);
}
process.exit(failed ? 1 : 0);
