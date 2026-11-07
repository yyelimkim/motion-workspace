# Luck Corner thumbnail

Portfolio thumbnail for the Luck Corner app (1980 × 1080, 7.5 s): a card deck
tips, fans out (each card turning on its own centre) and lines up; Teru Teru
Bozu is chosen, zoomed into (clouds and stars drifting, the sky deepening), and
lands in the app's home screen before the Luck Corner logo draws itself on.

- `thumb.js` — the whole scene (its own engine; it predates the shared one)
- `timeline.json` — the saved timeline (versions V1, V2 · anticipation,
  V3 · fan spin, and the Fan 3D panel); loaded the first time the project
  opens in a browser
- `assets/` — card art exported from Figma; `lib/` — the app's design system,
  fonts and the app assets the scene uses
- Exported: `node ../../tools/export.js --url http://localhost:8140/projects/luck-corner/ --out ~/Desktop/luck-corner.mp4`

Cooper Lt BT (used for the tagline and the phone header) is a licensed font
and isn't in the public repo; add `lib/assets/fonts/CooperLtBT-Regular.ttf`
locally (it falls back to a serif without it).
