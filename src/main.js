import { mount } from 'svelte'
// theme.js imports tokens.css + every theme, and applies the persisted
// [data-theme] to <html> on first subscribe. It replaces the old app.css.
import './lib/theme/theme.js'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
