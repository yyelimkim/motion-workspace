---
name: motion-workspace
description: Design and export short keyframed motion pieces (video thumbnails, promos, UI/app moments, card animations) in Yelim's Motion Workspace — a browser template with a DialKit timeline dock, speed graph, reference analysis and MP4 export. Use when asked to make, animate, retime or export a motion piece / thumbnail video, to match a reference recording's motion, or to set up a new motion project.
---

# Motion Workspace

The template lives at `~/Projects/motion-workspace` (github.com/yyelimkim/motion-workspace).
It starts blank (empty scene, empty timeline); the dock tweaks (multi-select,
scene bars, speed graph, scroll keeping, playhead) and tools are all in it.
Read its README first. A full real project built this way: the Luck Corner
thumbnail in `~/Projects/Luck Storage/thumbnail/` (thumb.js) — look there for
worked examples of 3D fans, zoom-into-card, phone UI build-in, logo draw-on.

## Starting a piece

1. New piece = a copy of the template (or a new `scene/` in it). Give the scene
   a new `id` (its timeline's save slot). Serve with `python3 -m http.server 8140`.
2. Put the user's references in `references/`. For a recording, run
   `python3 tools/analyze-reference.py references/<file>` and read
   `shots.txt` (cuts, where speed peaks, best-fit bezier per shot) and the
   contact sheets. Look at frames yourself before deciding motion.
3. Storyboard frames (e.g. from Figma) are named in order — follow the
   names, not the order the links were pasted. Repeated placeholder items in
   a sketch stand for *different* items.
4. Use only the user's assets and design-system tokens (fonts, colours). Derive
   new colours with `color-mix()` of tokens, never invent hex values.

## How the motion should feel (what the user has asked for)

- **Slow-mo → whip → slow-mo.** Transitions build speed, peak early, die away
  slowly (`EASE.SNAP`, `EASE.REF`). Holds keep drifting (`EASE.DRIFT`) — nothing
  stops dead, and "breathing room" is slow motion, not stillness.
- **Anticipation goes the OTHER way** from the move it leads into, and overlaps
  it (ends ~40% into it). Measure the direction; don't assume.
- **One fixed layer order** for every piece, the whole video. Never swap
  z-order mid-move.
- **Hand-offs read the previous shot** at the hand-off time (evaluate its pose
  at `at(nextClip)`), so nothing jumps. Watch for clips the user overlapped.
- Small exits (others sinking/leaving) are quick; the hero's own turns are
  eased and a touch slower. Springs (taps/pops) ease in — no jolt.

## What the user has asked for, in detail (from the Luck Corner thumbnail)

- **Anticipation:** measure which way the next move goes (angle and position
  per step) and wind up the opposite way. "Faster the way it was already
  moving" means it was going the wrong way.
- **Fans:** in the reference, each card turns on its OWN centre (~42°
  counter-clockwise, fast then easing out) while its place on the arc, the
  spacing and the size stay exactly the same — no group turn, no opening (that
  reads as a random zoom). Measuring with colour-blob centroids is misleading
  when cards overlap: check against the frames by eye (gridded stills).
- **No lurches:** an added motion that starts at full speed on top of another
  reads as a glitch — check speed per frame, not just position.
- **Picking one card:** the others line up, leave and sink together and
  quickly (sinking ones fade as they drop); the chosen one turns upright
  gently (eased, a bit slower) and goes straight to centre — no detour,
  no sudden height change between shots.
- **Breathing room** before a big move: keep it moving slowly (a slow, eased
  scale-down, not a quick pull-back bounce).
- **Zoom into a card:** frame lines and edges leave as soon as the zoom starts,
  over ~0.4s (not instantly, not late). Background details keep drifting while
  in close (clouds part and drift outwards; stars drift out and churn; the
  front element swells slightly). A subtle sky gradient: a deeper, more
  saturated version of the base colour — not black, barely violet.
- **Zoom out to a UI/phone:** land upright; build the UI in piece by piece
  (side items slide out from behind, header settles down, nav rises, details
  last), never all at once. A tilt/pop "tap" happens as it's already leaving,
  subtly; lifts float (eased), they don't snap.
- **Pacing:** short holds once a screen has landed; trim dead time at the end.

## Working with the user's timeline — important

- The user edits timing in the dock in **their own tab**. DialKit saves the
  *whole* timeline on every change and doesn't sync tabs: any `DialStore`
  write from your tab overwrites their newer edits. So:
  - Prefer **code** changes (shape, how values are used) over timeline writes.
  - Write timeline values only when asked for that change: reload your tab
    first (fresh values), write immediately, then tell them to reload theirs
    before editing.
  - Test read-only: fingerprint `localStorage['dialkit:<id>']` before/after.
- Saved versions (dock's version menu): code defaults don't reach a saved
  version; change it with `DialStore.updateValues` while it's active.

## Verifying (do this before saying it's done)

- Scrub with `window.seek(t)` and sample the piece's matrix per step (position,
  angle, scale, opacity). Look for: single-step jumps, layer (z) changes,
  stalls where motion should continue, things appearing/vanishing on screen.
- Look at frames full-size (`big(true)`) at the moments that changed.
- Report numbers (e.g. angle per step), not just "it's smoother".

## Exporting

`node tools/export.js --out ~/Desktop/<name>.mp4 --fps 60`, then in the
workspace tab run `sendForExport()` (read-only: hands over the saved timeline).
Check the MP4 (frame count, size, a few frames vs renders). For a website,
re-encode: `swift tools/webify.swift in.mp4 out.mp4 1320 720 4500000`, make a
poster from frame 0, and size the card to the video's aspect.
