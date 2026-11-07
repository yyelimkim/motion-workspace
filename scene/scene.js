// The scene: what this workspace animates. Replace this file (and
// scene.css, assets/) for a new project; the engine stays as it is.
//
// A scene is { id, name, width, height, duration, timeline, build, render }
// (+ optional panel, ready). The rules that make motion feel right here:
//   - render(t) draws the moment t from the timeline (MW.ev / MW.progress),
//     never from its own clock, so scrubbing and export are exact
//   - every piece keeps ONE layer order for the whole piece (no layer jumps)
//   - an anticipation (a wind-up the other way) overlaps the move it leads
//     into by ~40% of its length, so it never stops dead between them
//   - each shot starts from where the last one is at that moment (evaluate
//     the previous pose at the hand-off time), so nothing can jump
//
// This example: a card, dealt into a fan, one chosen, zoomed into, then
// tapped away.

(() => {
  const { clip, spring, wind, EASE } = MW;
  const W = 1920;
  const H = 1080;
  const CW = 300;   // a card
  const CH = 420;
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
  const CHOSEN = 2;
  let cards = [];
  let title = null;

  window.SCENE = {
    id: 'example-v1',            // the timeline's save slot (localStorage 'dialkit:example-v1')
    name: 'Example',
    width: W,
    height: H,
    duration: 6,

    // Every keyframe a clip, grouped by shot (the dock reads them in order).
    // clip(at, duration, ease, from, to); wind() for an anticipation;
    // spring() for a tap.
    timeline: {
      '1 card': {
        push: clip(0, 0.8, EASE.DRIFT),                  // a slow push in
      },
      '2 fan': {
        anticipate: wind(0.55, 0.3),                     // leans back the other way…
        spread: clip(0.73, 0.7, EASE.SNAP),              // …then fans out
        turn: clip(0.73, 1.5, EASE.MOMENTUM, { deg: 8 }, { deg: -6 }),  // slow turn, picking up speed
      },
      '3 pick': {
        anticipate: wind(1.95, 0.28),                    // the fan pulls back…
        pick: clip(2.12, 0.6, EASE.SNAP),                // …the chosen card comes up; the rest sink
      },
      '4 zoom': {
        zoom: clip(2.9, 0.8, EASE.SNAP),                 // in close
        hold: clip(3.5, 1.0, EASE.DRIFT, { s: 1 }, { s: 1.04 }),
      },
      '5 out': {
        tap: spring(4.55, 0.5, 0.45, { deg: 0 }, { deg: 5 }),  // tapped…
        out: clip(4.62, 0.45, [0.6, 0, 0.9, 0.5]),       // …and away
        title: clip(4.8, 0.8, [0.16, 1, 0.3, 1]),
      },
    },

    build(frame) {
      cards = COLORS.map((c, i) => {
        const el = document.createElement('div');
        el.className = 'p card';
        el.style.background = c;
        el.innerHTML = `<span>${['Luck', 'Calm', 'Protection', 'Success', 'Love'][i]}</span>`;
        el.style.zIndex = 100 - i * 10;                  // one layer order, front to back
        frame.appendChild(el);
        return el;
      });
      title = document.createElement('p');
      title.className = 'p title';
      title.textContent = 'Motion Workspace';
      frame.appendChild(title);
    },

    render(t) {
      const { ev, progress, lerp, lerpLog, pose, place, at, mul, inv } = MW;
      const pTip = ev('2 fan.spread', 'p', t);
      const w1 = ev('2 fan.anticipate', 'w', t);
      const turn = ev('2 fan.turn', 'deg', t);
      const w2 = ev('3 pick.anticipate', 'w', t);
      const pPick = ev('3 pick.pick', 'p', t);
      const sPush = lerp(0.94, 1, ev('1 card.push', 'p', t));

      // a card's pose in shots 1–3: centre, turn, scale, opacity
      const cardAt = (i) => {
        const k = i - CHOSEN;
        // 1: stacked, leaning back before the fan (w1)
        let x = W / 2 + 10 * w1;
        let y = H / 2;
        let r = -5 * w1;
        let s = sPush;
        let o = 1;
        // 2: the fan, round a point below the frame
        const th = (k * 14 + turn - 4 * w2) * (Math.PI / 180);
        const fx = W / 2 + 900 * Math.sin(th);
        const fy = H / 2 + 120 + 900 * (1 - Math.cos(th));
        x = lerp(x, fx, pTip);
        y = lerp(y, fy, pTip);
        r = lerp(r, (th * 180) / Math.PI, pTip);
        // 3: the chosen one comes up and upright; the rest sink and fade
        if (i === CHOSEN) {
          x = lerp(x, W / 2, pPick);
          y = lerp(y, H / 2 - 20, pPick);
          r = lerp(r, 0, pPick);
          s *= lerp(1, 1.25, pPick);
        } else {
          y += 260 * pPick;
          o = 1 - pPick;
        }
        return { x, y, r, s, o };
      };

      const tZoom = at('4 zoom.zoom');
      for (const [i, el] of cards.entries()) {
        let q = cardAt(i);
        let m = pose(q.x, q.y, q.r, q.s, CW / 2, CH / 2);
        if (t >= tZoom && i === CHOSEN) {
          // 4: from exactly where it was when the zoom began, in close
          const q0 = cardAt(i);
          const z = ev('4 zoom.zoom', 'p', t);
          const s = lerpLog(q0.s, 2.6, z) * ev('4 zoom.hold', 's', t);
          // 5: tapped (a spring) and away
          const tilt = ev('5 out.tap', 'deg', t);
          const pop = 1 + 0.03 * progress('5 out.tap', t);
          const out = ev('5 out.out', 'p', t);
          m = pose(W / 2, lerp(q0.y, H / 2, z) - 1600 * out, tilt, s * pop, CW / 2, CH / 2);
          q = { ...q, o: 1 - Math.max(0, (out - 0.6) / 0.4) };
        }
        place(el, m, q.o);
      }
      const g = ev('5 out.title', 'p', t);
      place(title, pose(W / 2, H / 2 + 14 * (1 - g), 0, 1, 0, 0), g, 200);
    },
  };
})();
