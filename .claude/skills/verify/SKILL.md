# Verify: Carcasscore (Vite + React + Supabase)

Build/launch:
- `npm run build` — catches import/JSX errors (~3s).
- `npm run dev` — Vite dev server; port 5173, falls back to 5174 if busy. Read the URL from stdout.

Drive it (no test framework, no Playwright dep in package.json — but `playwright-core`
is present transitively in node_modules and system Chrome works):

```js
import { chromium } from '<repo>/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
```

Key flows without credentials — **guest + demo mode**:
1. On the auth screen click the "guest" button.
2. Library/old-stats surfaces gate on sign-in; click "See how it works!" to load
   DEMO_REALM/DEMO_GAMES (src/data/demoData.js, 10 games, 2 players).
3. Profile tab shows only the guest empty state — the account hero card needs a real
   signed-in Supabase account with games; cannot be driven without credentials.

Gotchas:
- Lightbox prev/next is keyboard-only: ArrowUp/ArrowDown; Escape or Space closes.
- `/favicon.ico` 404s on every load (pre-existing; ignore in console-error capture).
- Tabs are state-based (`.tab-nav .tab-btn`), no router/URLs.
- To exercise pagination (>25 games) temporarily clone DEMO_GAMES entries at the
  bottom of demoData.js — remember to revert.
