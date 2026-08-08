import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    // Bind to the Tailscale interface ONLY. Previously this was started with
    // `--host 0.0.0.0`, which also listened on the VPS's public IP — the dev
    // server has no authentication, so only the firewall was keeping it
    // private. Binding here means the public interface never accepts a
    // connection even if a firewall rule changes.
    host: '100.82.27.85',
    port: 5173,
    strictPort: true,
  },
})
