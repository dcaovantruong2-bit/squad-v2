/**
 * Theme registry + switcher.
 *
 * Themes are pure CSS token overrides selected by a [data-theme] attribute on
 * <html>. Adding one is: create themes/<id>.css defining every token in the
 * contract, import it below, add an entry to THEMES. No screen code changes.
 */
import { writable } from 'svelte/store';
import '../theme/tokens.css';
import '../theme/themes/floodlight.css';
import '../theme/themes/sundaymorning.css';

export const THEMES = [
  { id: 'floodlight',    name: 'Floodlight',     desc: 'Night match under the lights.' },
  { id: 'sundaymorning', name: 'Sunday Morning', desc: 'Cold grass, no glamour.' },
];

const STORAGE_KEY = 'squad.theme';
const DEFAULT_THEME = 'floodlight';

function initial() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some(t => t.id === saved)) return saved;
  }
  return DEFAULT_THEME;
}

export const theme = writable(initial());

theme.subscribe((id) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode */ }
});

/** @param {string} id */
export function setTheme(id) {
  if (THEMES.some(t => t.id === id)) theme.set(id);
}

export function cycleTheme() {
  theme.update((cur) => {
    const i = THEMES.findIndex(t => t.id === cur);
    return THEMES[(i + 1) % THEMES.length].id;
  });
}
