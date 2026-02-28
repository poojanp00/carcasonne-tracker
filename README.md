# Carcassonne Logbook

A small single-page React app (Vite) for recording two-player Carcassonne games, tracking owned expansions, viewing a logbook, and inspecting player statistics. This README collects the app structure, data shapes, run instructions, known limitations, and suggested improvements.

## Quick start

Prerequisites: Node.js (recommended v18+), npm.

From your shell, change into the project directory and install dependencies, then run the dev server:

```bash
cd carcassonne-tracker
npm install
npm run dev
```

Open the local URL printed by Vite (default http://localhost:5173).

Build for production:

```bash
npm run build
npm run preview
```

## What this app does

- Record a game with: two fixed players (Poojan and Diya), date, scores, expansions used, optional photo, and a "farm win" flag.
- Persist games and expansion ownership to `localStorage`.
- View the logbook, filter by expansions, open photos in a lightbox, and delete entries.
- See per-player statistics (wins, losses, streaks, high score, clutch factor, farm dominance, biggest blowout).
- Toggle owned/unowned expansions in a collection view.

## Project layout

- `index.html` — HTML shell and Google Fonts.
- `package.json` — scripts & dependencies (React, Vite).
- `vite.config.js` — Vite + React plugin.
- `src/main.jsx` — application entry; mounts `App`.
- `src/App.jsx` — top-level UI: navigation, toast, tab routing.
- `src/index.css` — full app styling (medieval/parchment theme).
- `src/components/`
  - `GameLogForm.jsx` — form to record a new game; reads photos as data URLs.
  - `GameHistory.jsx` — table of games; expansion filters; delete; open `Lightbox`.
  - `Lightbox.jsx` — modal for game photo + metadata.
  - `Stats.jsx` — computes and displays player statistics.
  - `Collection.jsx` — view and toggle owned expansions.
- `src/data/`
  - `expansions.js` — `DEFAULT_EXPANSIONS` list with names/types/owned flags.
  - `storage.js` — localStorage read/write, migration helpers, `generateId()`.
- `src/hooks/`
  - `useGameData.js` — custom hook exposing `{ games, expansions, addGame, deleteGame, toggleExpansion }`.
- `images/` — static images used by the UI.

## Data shapes

Games are stored as an array at the `localStorage` key `carcassonne_games`.

Each game (example):

```json
{
  "id": "1670000000000-abc123",
  "date": "2026-02-27",
  "player1": { "name": "Poojan", "score": 80 },
  "player2": { "name": "Diya", "score": 72 },
  "expansions": ["Inns & Cathedrals", "The River"],
  "photo": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "farmWin": false
}
```

Expansions are stored at `carcassonne_expansions` as an array of objects like:

```json
{ "name": "Inns & Cathedrals", "type": "full", "owned": true }
```

## Important implementation notes & limitations

- Players are currently hard-coded: `Poojan` and `Diya` (see `src/components/GameLogForm.jsx`).
- Images attached in the form are read with `FileReader.readAsDataURL()` and saved as data URLs into localStorage. This is simple but can quickly exhaust browser localStorage (typical limit 5–10 MB). If you plan to store many photos or large images, consider one of:
  - Provide an export/import backup feature (recommended) to move data off the device.
  - Resize/compress images client-side before saving.
  - Use IndexedDB for larger binary storage.
  - Or host images externally and save URLs instead.
- `useGameData` writes to localStorage synchronously after state updates. There is no error handling for quota/full storage.
- Name deduplication in `Stats.jsx` is case-insensitive and keeps the first-seen capitalization. Varying capitalization will be merged but capitalization won't be normalized.
- Filtering in `GameHistory.jsx` is an AND filter: selected expansions must all be present in the game to match.

## Storage migration

`src/data/storage.js` includes a small migration step to rename a few legacy expansion names and to merge any stored expansions with the current defaults (this ensures newly-released expansions are appended to stored lists).

## Suggestions & possible improvements (low-risk)

- Add an "Export / Import JSON" backup feature (easy): allow the user to download a JSON file containing `games` and `expansions` and re-import it.
- Add a settings screen to configure player names (instead of hard-coding them in the form).
- Add client-side image resizing/compression (e.g., draw on a canvas and call `toDataURL()` with quality) to reduce localStorage usage.
- Migrate from localStorage to IndexedDB for photos and larger datasets.
- Add unit tests for `calcStats()` and storage migration logic.
- Optionally convert to TypeScript or add `prop-types` to components for clearer runtime validation.

## Example: backup/export guidance

Minimal export: serialize both `carcassonne_games` and `carcassonne_expansions` into a single JSON file. On import, validate shape and optionally prompt to merge or replace.

Example export pseudo-flow:

1. Read `localStorage.getItem('carcassonne_games')` and `localStorage.getItem('carcassonne_expansions')`.
2. Build an object `{ games: [...], expansions: [...] }` and `JSON.stringify()` it.
3. Create a blob and `URL.createObjectURL` to offer a download.

## How I validated things in this repo

I inspected the following files while preparing this README:
- `index.html`, `package.json`, `vite.config.js`
- `src/main.jsx`, `src/App.jsx`, `src/index.css`
- `src/components/*` (GameLogForm, GameHistory, Lightbox, Stats, Collection)
- `src/data/*` (expansions.js, storage.js)
- `src/hooks/useGameData.js`

If you want, I can also:
- Add this README as a new file in the repo (done).
- Add an in-app Export/Import UI. I can implement that next and add a simple test for export format.
- Annotate specific files with inline comments to explain logic line-by-line.

## Next steps I can take for you

- Implement Export/Import JSON backup feature and a small UI control (download/upload). This is a safe, high-value change.
- Add a small `README` section that shows an example `localStorage` payload for easier debugging.
- Add simple unit tests for `calcStats()` and storage migration.

Tell me which of the next steps above you'd like me to implement and I'll proceed.
