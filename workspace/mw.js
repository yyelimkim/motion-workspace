// Motion Workspace helpers (window.MW): timing, easing, springs and placement,
// shared by the engine and every scene. A scene reads its timeline through
// MW.ev / MW.progress, so any moment can be drawn exactly (scrubbing, export).

(() => {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpLog = (a, b, k) => a * Math.pow(b / a, k);   // zooms: even in perceived scale
  const smooth = (k) => k * k * (3 - 2 * k);

  // cubic-bezier(x1, y1, x2, y2) at x, as CSS draws it
  function bezier([x1, y1, x2, y2], x) {
    const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (f(x1, x2, mid) < x) lo = mid; else hi = mid;
    }
    return f(y1, y2, (lo + hi) / 2);
  }

  // A damped spring across a clip (u 0 → 1): shoots past and settles. Eased
  // in over its first tenth so it never kicks off at full speed.
  function springAt(u, bounce = 0.3) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const z = clamp(1 - bounce, 0.08, 1);
    const w = 7 / z;
    let v;
    if (z >= 1) v = 1 - Math.exp(-w * u) * (1 + w * u);
    else {
      const wd = w * Math.sqrt(1 - z * z);
      v = 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + ((z * w) / wd) * Math.sin(wd * u));
    }
    const r = Math.min(1, u / 0.1);
    return v * smooth(r);
  }

  // Curves that have worked. REF: measured off a reference recording
  // (speed builds ~0.2 s, peaks a quarter in, dies away: slow-mo → whip →
  // slow-mo). SNAP: sharper fast-to-slow. DRIFT: slow holds that never stop
  // dead. WIND: an anticipation's wind-up.
  const EASE = {
    REF: [0.37, 0, 0.1, 1],
    SNAP: [0.19, 0, 0.06, 0.99],
    DRIFT: [0.25, 0.25, 0.6, 1],
    WIND: [0.45, 0, 0.55, 1],
    MOMENTUM: [0.15, 0.45, 0.85, 0.55],
    EASY: [0.333, 0, 0.667, 1],
    LINEAR: [0, 0, 1, 1],
  };

  // Clip definitions for a scene's timeline
  const clip = (at, duration, ease = EASE.REF, from = { p: 0 }, to = { p: 1 }) => ({
    at, duration, from, to, transition: { type: 'easing', ease },
  });
  const spring = (at, duration, bounce = 0.3, from = { p: 0 }, to = { p: 1 }) => ({
    at, duration, from, to, transition: { type: 'spring', bounce, visualDuration: duration },
  });
  const wind = (at, duration) => clip(at, duration, EASE.WIND, { w: 0 }, { w: 1 });

  // Reading the timeline at any moment (values come straight from DialKit's
  // store, so a hand-off can look at where the previous move ends)
  let VALS = {};
  const setValues = (v) => { VALS = v; };
  const at = (key) => VALS[`${key}.at`] ?? 0;
  const dur = (key) => VALS[`${key}.duration`] ?? 0;
  const end = (key) => at(key) + dur(key);
  function progress(key, time) {
    const a = VALS[`${key}.at`];
    if (a === undefined) return 0;
    const d = VALS[`${key}.duration`];
    const tr = VALS[`${key}.transition`];
    const u = d > 0 ? clamp((time - a) / d) : time >= a ? 1 : 0;
    if (tr && tr.type === 'spring') return springAt(u, tr.bounce ?? 0.3);
    return bezier(tr && Array.isArray(tr.ease) ? tr.ease : EASE.REF, u);
  }
  // a clip's value (its from → to) at a time; prop defaults to 'p'
  function ev(key, prop = 'p', time) {
    const from = VALS[`${key}.from.${prop}`];
    const to = VALS[`${key}.to.${prop}`];
    if (from === undefined || to === undefined) return 0;
    return from + (to - from) * progress(key, time);
  }
  // the same clip, played faster: done within `share` of its length
  function quick(key, time, share, prop = 'p') {
    const a = at(key);
    return ev(key, prop, a + (time - a) / share);
  }

  // 2D affine matrices [a, b, c, d, e, f]
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const inv = (m) => {
    const det = m[0] * m[3] - m[1] * m[2];
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
      (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  };
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  // the point (ox, oy) of a piece lands on (cx, cy), turned deg, scaled s
  function pose(cx, cy, deg, s, ox = 0, oy = 0) {
    const r = (deg * Math.PI) / 180;
    const a = s * Math.cos(r);
    const b = s * Math.sin(r);
    return [a, b, -b, a, cx - a * ox + b * oy, cy - b * ox - a * oy];
  }
  const css = (m) => `matrix(${m.map((v) => v.toFixed(5)).join(',')})`;
  // put a piece (transform-origin 0 0) on a matrix; hidden when transparent
  function place(el, m, opacity = 1, z) {
    el.style.visibility = opacity > 0.001 ? '' : 'hidden';
    el.style.transform = typeof m === 'string' ? m : css(m);
    el.style.opacity = opacity >= 0.999 ? '' : opacity.toFixed(3);
    if (z !== undefined) el.style.zIndex = z;
  }
  const hide = (el) => { el.style.visibility = 'hidden'; };
  // a 3D perspective about the frame's centre, for matrix3d placement
  function perspective(w, h, depth) {
    return new DOMMatrix().translate(w / 2, h / 2)
      .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / depth, 0, 0, 0, 1]))
      .translate(-w / 2, -h / 2);
  }

  window.MW = {
    clamp, lerp, lerpLog, smooth, bezier, springAt, EASE,
    clip, spring, wind,
    setValues, at, dur, end, progress, ev, quick,
    mul, inv, apply, pose, css, place, hide, perspective,
  };
})();
