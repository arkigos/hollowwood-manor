# Hollowwood Manor — Chapter I: The Sisters

A playable digital board game. One human with an NPC teammate, or two humans on one screen.

## Play

Open `dist/index.html` in any modern browser. No install, no server.

`hollowwood-manor.html` is the same game as a single self-contained page (the published version).

## Controls

- Click things on the board (your miniature, furniture, your partner, the front door), or use the action buttons.
- After rolling, click a lit space or drag the miniature to it.
- Keyboard: `M` roll to move, arrows + `Enter` to pick a space, `F` to jump the cursor between floors, `1`–`9` for the numbered actions, `E` end turn, `R` reroll, `Esc` stay put.

- The helper card beside the active hero lists every action and marks one worth trying. The Helper button turns it off.
- `N` (or the Notes button) opens a playtest note. Each note records the time on the clock, the round, the deal and where both heroes were.

## Playtest notes

Notes are saved in the player's own browser. "All notes" has a Copy button so they can be pasted into a message. If `NOTES_REPO` in `src/ui.js` is set to `owner/repo`, a "Send as a GitHub issue" button also appears (the player needs a GitHub account for that one).

## Host it on GitHub Pages

`node build.js` writes a root `index.html`. Push this folder to a GitHub repository, then in the repository's Settings → Pages choose "Deploy from a branch", branch `main`, folder `/ (root)`. The game appears at `https://<user>.github.io/<repo>/`.

## Change it

- `src/engine.js` — all rules, cards, story text and the teammate AI. Tunable numbers are in `CFG` at the top.
- `src/render.js` — the board, furniture, miniatures and lighting.
- `src/ui.js`, `src/style.css`, `src/body.html` — the table UI.
- `node build.js` rebuilds both HTML files from `src/`.

## Test

- `node test/rules.js` — 40 rule checks (Protection's next-turn cost, sabotage and item recovery, early co-op credit, endings).
- `node test/sim.js 150` — AI plays both seats through every objective deal and both blocked-route layouts, and reports win rates.
- Add `#auto` to the page URL to watch the AI play a whole night.
