// The scene: what this workspace animates. Blank — fill it in for a piece.
//
// A scene is { id, name, width, height, duration, timeline, build, render }
// (+ optional panel, ready). See the README for the shape and the rules
// that make motion feel right (render from the timeline, one layer order,
// anticipation that overlaps, hand-offs that read the previous shot).
//
// timeline: clips grouped by shot, e.g.
//   '1 intro': { push: MW.clip(0, 0.8, MW.EASE.DRIFT) },
//   '2 fan':   { anticipate: MW.wind(0.55, 0.3), spread: MW.clip(0.73, 0.7, MW.EASE.SNAP) },

window.SCENE = {
  id: 'untitled-v1',   // the timeline's save slot: give each piece its own
  name: 'Untitled',
  width: 1920,
  height: 1080,
  duration: 6,

  timeline: {},

  // create the pieces once
  build(frame, MW) {},

  // draw the moment t from the timeline (MW.ev / MW.progress / MW.place)
  render(t, MW) {},
};
