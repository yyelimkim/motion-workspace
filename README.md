# Motion Workspace

A browser workspace for designing short motion pieces — thumbnails, promos,
UI moments — keyframe by keyframe, then exporting them as MP4.

- **Every moment is drawn from a timeline.** A scene's `render(t)` draws the
  moment `t`, so scrubbing is exact and export is frame-perfect.
- **A DialKit timeline dock** (every keyframe a clip): drag to retime, stretch
  to change length, click to edit values and curves.
  - **Multi-select:** drag a box over clips, or shift-click; drag any selected
    clip to move them all.
  - **Scene bars:** collapse a scene and it becomes one bar you can drag.
  - **Speed graph:** in a clip's editor, press *Speed graph* for an After
    Effects–style speed/value graph with influence handles and presets.
- **Reference analysis:** measure a recording's speed curves and fit them to
  cubic-beziers.
- **Export:** a hidden Chrome renders every frame at full size; macOS's own
  encoder makes the MP4. No ffmpeg.

## Start

```
python3 -m http.server 8140
```

Open http://localhost:8140/ — a blank scene with an empty timeline, ready
for a new piece.
Your edits save in the browser (localStorage `dialkit:<scene id>`); the dock's
version menu keeps versions side by side; **Copy** exports the values.

## Make a new piece

1. Put references in `references/` and study them:
   `python3 tools/analyze-reference.py references/ref.mov`
2. Fill in `scene/scene.js` and `scene/scene.css` (assets in `assets/`).
   Give the scene its own `id` so it gets its own save slot.
3. Shape the timing in the dock; tune the shape in code.
4. Export: `node tools/export.js --out ~/Desktop/piece.mp4 --fps 60`, then in
   the workspace tab's console run `sendForExport()` so the export uses your
   timeline.
5. For the web: `swift tools/webify.swift in.mp4 out.mp4 1320 720 4500000`.

## A scene

```js
window.SCENE = {
  id: 'my-piece-v1', name: 'My piece', width: 1920, height: 1080, duration: 6,
  timeline: {                                   // clips, grouped by shot
    '1 intro': { push: MW.clip(0, 0.8, MW.EASE.DRIFT) },
    '2 fan':   { anticipate: MW.wind(0.55, 0.3), spread: MW.clip(0.73, 0.7, MW.EASE.SNAP) },
  },
  build(frame) { /* create the pieces once */ },
  render(t)    { /* MW.ev('2 fan.spread', 'p', t) … MW.place(el, MW.pose(x, y, deg, s)) */ },
  panel: { name, config, apply(values) },       // optional live sliders
};
```

`workspace/mw.js` has the helpers: `ev`, `progress`, `quick`, `bezier`,
`springAt`, the `EASE` curves, and matrix placement (`pose`, `place`, `mul`,
`inv`, `perspective`).

## What makes it feel right

- **Slow-mo → whip → slow-mo.** Transitions build speed, peak early and die
  away slowly (`EASE.REF`, `EASE.SNAP`); holds drift (`EASE.DRIFT`) so nothing
  stops dead.
- **Anticipation overlaps.** A wind-up the *other* way, ending ~40% into the
  move it leads into.
- **One layer order** for the whole piece: no piece ever jumps in front of
  another mid-move.
- **Hand-offs read the previous shot** at the hand-off time, so nothing jumps.

## The skill

`skill/SKILL.md` is the Claude Code skill that goes with this workspace: how to
start a piece, study references, and the motion rules learned so far. To use
it on a new machine:

```
mkdir -p ~/.claude/skills/motion-workspace && cp skill/SKILL.md ~/.claude/skills/motion-workspace/
```

## Credits

[DialKit](https://github.com/joshpuckett/dialkit) (MIT) is vendored in
`vendor/dialkit`.
