// ─── WebAudio synth SFX — no assets, no network ───────────────────────────────
// Lazily creates an AudioContext on the first sound (browser autoplay policies
// require a user gesture first — every sound is triggered by a click anyway).
// Mute state persists in localStorage. All calls are safe no-ops when the
// AudioContext can't be created or the tab is headless.

let ctx = null;
let _muted = false;
try {
  _muted = typeof localStorage !== 'undefined' && localStorage.getItem('squad.sfx.muted') === '1';
} catch (e) { /* storage unavailable */ }

export function isMuted() { return _muted; }

export function toggleMute() {
  _muted = !_muted;
  try {
    localStorage.setItem('squad.sfx.muted', _muted ? '1' : '0');
  } catch (e) { /* ignore */ }
  return _muted;
}

function ac() {
  if (ctx) return ctx;
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (AC) ctx = new AC();
  } catch (e) { ctx = null; }
  return ctx;
}

function tone(freq, { dur = 0.12, type = 'square', vol = 0.05, when = 0, slide = 0 } = {}) {
  const c = ac();
  if (!c || _muted) return;
  try {
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  } catch (e) { /* ignore — audio is never critical */ }
}

export const sfx = {
  click()    { tone(660, { dur: 0.05, type: 'square', vol: 0.025 }); },
  pick()     { tone(520, { dur: 0.07, type: 'triangle', vol: 0.05 }); tone(780, { dur: 0.09, type: 'triangle', vol: 0.05, when: 0.05 }); },
  unpick()   { tone(520, { dur: 0.09, type: 'triangle', vol: 0.05, slide: -220 }); },
  kickoff()  { // referee whistle — two short blasts then a longer one
    tone(2350, { dur: 0.12, type: 'sine', vol: 0.05 });
    tone(2350, { dur: 0.12, type: 'sine', vol: 0.05, when: 0.16 });
    tone(3136, { dur: 0.2, type: 'sine', vol: 0.045, when: 0.34 });
  },
  phase()    { // score tally — rising thunk
    tone(392, { dur: 0.08, type: 'triangle', vol: 0.06 });
    tone(494, { dur: 0.08, type: 'triangle', vol: 0.06, when: 0.07 });
    tone(659, { dur: 0.16, type: 'triangle', vol: 0.06, when: 0.14 });
  },
  land()     { // impact thud — score lands, low thump + tick
    tone(150, { dur: 0.1, type: 'sine', vol: 0.09, slide: -80 });
    tone(300, { dur: 0.06, type: 'triangle', vol: 0.05, when: 0.01, slide: -120 });
  },
  win()      { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.14, type: 'triangle', vol: 0.055, when: i * 0.09 })); },
  lose()     { [392, 330, 262, 196].forEach((f, i) => tone(f, { dur: 0.16, type: 'sawtooth', vol: 0.04, when: i * 0.12 })); },
  buy()      { tone(880, { dur: 0.06, type: 'square', vol: 0.035 }); tone(1175, { dur: 0.09, type: 'square', vol: 0.035, when: 0.06 }); },
  victory()  { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { dur: 0.2, type: 'triangle', vol: 0.055, when: i * 0.11 })); },
  defeat()   { [311, 262, 220, 175].forEach((f, i) => tone(f, { dur: 0.25, type: 'sawtooth', vol: 0.045, when: i * 0.14 })); },
};
