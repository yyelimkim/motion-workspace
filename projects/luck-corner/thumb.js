// Luck Corner thumbnail: 1980 x 1080, drawn by render(v) from a DialKit
// timeline, so every keyframe can be dragged, stretched and re-curved in the
// dock at the bottom (and any moment seeked to for capture).
//
// Shots, in the order the storyboard frames are named (Figma "1" … "8"):
//   1  one card (the deck's top card, Pollock)
//   2  it tips over into the deck behind it
//   3  the deck fans out in 3D, round a wide arc, and slowly turns
//   4  the fan lines up: Teru leads, two cards trailing it
//   5  Teru is chosen and rises; the others drop away
//   6  zoom in: frame and words fly out, the doll dangles
//   7  zoom out to the phone (the app's home, Teru in front)
//   8  the logo draws itself on, as the app's splash
//
// Motion after the reference recording: each move comes in fast and slows
// right down (a long ease-out), and moves off with an ease-in, so there's
// a slow, held middle and nothing ever stops dead between shots.

(() => {
  const W = 1980;
  const H = 1080;
  const CW = 520;   // card, as the Figma frame
  const CH = 743;

  const frame = document.getElementById('frame');

  // ---------- easing ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpLog = (a, b, k) => a * Math.pow(b / a, k);
  const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const outQuint = (x) => 1 - Math.pow(1 - x, 5);
  const inCubic = (x) => x * x * x;
  const inOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
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

  // ---------- 2D affine matrices [a, b, c, d, e, f] ----------
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
  // the point (ox, oy) of the piece lands on (cx, cy), turned deg, scaled s
  function pose(cx, cy, deg, s, ox = CW / 2, oy = CH / 2) {
    const r = (deg * Math.PI) / 180;
    const a = s * Math.cos(r);
    const b = s * Math.sin(r);
    return [a, b, -b, a, cx - a * ox + b * oy, cy - b * ox - a * oy];
  }
  const css = (m) => `matrix(${m.map((v) => v.toFixed(5)).join(',')})`;
  function place(el, m, opacity = 1, z) {
    el.style.visibility = opacity > 0.001 ? '' : 'hidden';
    el.style.transform = css(m);
    el.style.opacity = opacity >= 0.999 ? '' : opacity.toFixed(3);
    if (z !== undefined) el.style.zIndex = z;
  }
  const hide = (el) => { el.style.visibility = 'hidden'; };

  // ---------- building ----------
  const h = (tag, cls, parent, attrs = {}) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    Object.assign(el, attrs);
    if (parent) parent.appendChild(el);
    return el;
  };
  const imgs = [];
  function img(src, parent, x, y, w, ht, cls = '') {
    const el = h('img', cls, parent, { src, alt: '' });
    el.width = w;
    el.height = ht;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${ht}px` });
    imgs.push(el);
    return el;
  }
  function card(name, z = 1) {
    const el = h('div', 'p card', frame);
    const im = h('img', '', el, { src: `assets/${name}.png`, alt: '' });
    imgs.push(im);
    el.style.zIndex = z;
    hide(el);
    return el;
  }

  // World-space blue and paper for shot 3, where the Teru card's sky spreads
  // past its edges to fill the frame (cheaper than painting giant layers)
  const skyBlue = h('div', 'p', frame);
  Object.assign(skyBlue.style, { width: `${W}px`, height: `${H}px`, background: 'var(--v2-blue)', zIndex: 65 });  // over the phone (45) and the cards behind Teru, under Teru (70)
  hide(skyBlue);

  // ---- Teru Teru Bozu, from its layers (Figma 1520:3184) ----
  const T = 'assets/teru/';
  const hero = h('div', 'p hero', frame);
  hero.style.zIndex = 50;
  const heroBlue = h('div', '', hero);
  Object.assign(heroBlue.style, { position: 'absolute', left: 0, top: 0, width: `${CW}px`, height: `${CH}px`, borderRadius: '47px', background: 'var(--v2-blue)' });
  // the artwork, clipped to its 454 x 691 window (rounded 31)
  const artClip = h('div', '', hero);
  Object.assign(artClip.style, { position: 'absolute', overflow: 'hidden' });
  const art = h('div', '', artClip);
  Object.assign(art.style, { position: 'absolute', width: `${CW}px`, height: `${CH}px` });
  img(`${T}dc754.svg`, art, 86, 188, 106, 106);                  // sun
  const cloudL = img(`${T}f83c7.svg`, art, 0, 240, 162.448, 69.177);   // cloud (drifts left in shot 6)
  const doll = h('div', 'doll', art);                            // rain doll
  const strWrap = h('div', '', doll);
  Object.assign(strWrap.style, { position: 'absolute', left: '231.89px', top: '5px', width: '40.778px', height: '295.359px' });
  const strIn = h('div', '', strWrap);
  Object.assign(strIn.style, { position: 'absolute', left: '3.957px', top: '0.389px', width: '32.864px', height: '294.581px', transform: 'rotate(1.54deg)' });
  img(`${T}4868c.svg`, strIn, -0.749, -0.736, 34.362, 296.054);  // string
  img(`${T}afa6a.svg`, doll, 143.246, 450.773, 216.912, 167.482); // body
  for (const y of [252.81, 266.38]) {                            // knot
    const k = h('div', 'knot', doll);
    Object.assign(k.style, { left: '233.5px', top: `${y}px` });
  }
  img(`${T}43852.svg`, doll, 164.24, 282.98, 176.125, 176.125);  // head
  img(`${T}14958.svg`, doll, 190.1, 443.159, 124.406, 34.446);   // neck
  img(`${T}2720d.svg`, doll, 276, 465.5, 42.5, 10);              // shadow
  img(`${T}d854f.svg`, doll, 172.53, 373.39, 87.43, 31.675);     // face
  // stars: they churn slowly in shot 6, each its own way round
  // [element, churn direction, centre x, centre y, is the front (largest) star]
  const stars = [
    [img(`${T}70756.svg`, art, 378, 257, 47, 47), 1, 401.5, 280.5, false],
    [img(`${T}0379c.svg`, art, 341, 540, 65, 65), -1, 373.5, 572.5, true],
    [img(`${T}d6f87.svg`, art, 88, 436, 35, 35), 1, 105.5, 453.5, false],
  ];
  const cloudR = img(`${T}f83c7.svg`, art, 360, 128, 162.448, 69.177); // cloud (drifts right in shot 6)
  // the frame, the name and the category tag: these fly out
  const flyFrame = h('div', 'fly', hero);
  img(`${T}92d82.svg`, flyFrame, 31.5, 29, 458, 686);
  const flyWords = h('div', 'fly', hero);
  const words = h('div', 'words', flyWords, { textContent: 'Teru Teru Bozu' });
  Object.assign(words.style, { left: '33px', top: '693px', width: '454px', lineHeight: '28px' });
  const flyTag = h('div', 'fly', hero);
  const tagBox = h('div', 'tag-box', flyTag);
  Object.assign(tagBox.style, { left: '146px', top: '15px', width: '187px', height: '43px', background: 'var(--neutral-100)' });
  const tagWord = h('div', 'words', flyTag, { textContent: 'Protection' });
  Object.assign(tagWord.style, { left: '189px', top: '15px', width: '142px', lineHeight: '43px' });
  for (const x of [146, 331]) {
    const sq = h('div', 'tag-box', flyTag);
    Object.assign(sq.style, { left: `${x}px`, top: '15px', width: '43px', height: '43px', background: 'var(--hot-pink)' });
  }
  img(`${T}f3c59.svg`, flyTag, 154, 23, 27, 27);
  img(`${T}f3c59.svg`, flyTag, 339, 23, 27, 27);
  // the paper over everything (multiplied), and the card's 1px line
  const heroPaper = h('div', '', hero);
  Object.assign(heroPaper.style, {
    position: 'absolute', left: 0, top: 0, width: `${CW}px`, height: `${CH}px`, borderRadius: '47px', overflow: 'hidden',
    mixBlendMode: 'multiply',
    background: `url("${T}texture-r180.jpg") -18px -18px / 553px 774px no-repeat`,
  });
  const heroEdge = h('div', 'edge', hero);
  hide(hero);

  const skyPaper = h('div', 'p', frame);
  Object.assign(skyPaper.style, {
    width: `${W}px`, height: `${H}px`, zIndex: 150, mixBlendMode: 'multiply',
    backgroundImage: `url("${T}texture-r180.jpg")`, backgroundRepeat: 'repeat',
  });
  hide(skyPaper);

  // ---- Shots 1–5: one pool of cards, each of the 7 used once; Teru (the
  // layered hero) is slot 3. Where the sketches repeat a card (the Pollock
  // ones), it stands in for a different card. Slots run top to bottom of the fan.
  const NAMES = ['pollock', 'dandelion', 'grapes', null, 'worry', 'candles', 'ricecake'];
  const TERU = 3;
  const pool = NAMES.map((n) => (n ? card(n, 10) : null));
  // ONE front-to-back order for the whole video: slot 0 (Pollock) in front,
  // each slot after it one layer further back. The deck, the fan and the line
  // all keep it, so no card ever jumps a layer. The phone sits behind Teru,
  // the sky between them; the logo over all.
  const STACK_ORDER = [0, 1, 2, 3, 4, 5, 6];
  const layer = (i) => 100 - 10 * i;          // Teru: 70
  // the line (shot 4): Teru leads; the two cards right behind it trail it
  const RANK = { 3: 0, 4: 1, 5: 2 };
  const rankOf = (i) => (i in RANK ? RANK[i] : 3 + Math.abs(i - TERU));

  // ---- Shot 7: the phone, the app's home with Teru in front ----
  const phone = h('div', 'p phone', frame);
  phone.style.zIndex = 45;
  const screenBox = h('div', 'screen', phone);
  // everything on the screen but its paper, faded in as one
  const screen = h('div', '', screenBox);
  Object.assign(screen.style, { position: 'absolute', inset: 0 });
  // side cards: the dial's neighbours, 20° out (mobile.js FIGMA_REST)
  const SIDE = 1.18 * 271.675 / CW;
  const sides = [['candles', -1], ['grapes', 1]].map(([n, rel]) => {
    const el = h('div', 'side card', screen);
    imgs.push(h('img', '', el, { src: `assets/${n}.png`, alt: '' }));
    const th = rel * 20;
    const x = 201.68 + 489.7 * 1.18 * Math.sin((th * Math.PI) / 180);
    const y = 396.9 + 33 + 926.1 * 1.18 * (1 - Math.cos((th * Math.PI) / 180));
    el.style.transform = css(pose(x, y, th, SIDE));
    el.style.opacity = 0.8;
    el._rest = { x, y, th };
    return el;
  });
  // the dial's lines round the top of the dial, Teru's upright and darker
  const ticks = h('div', '', screen);
  Object.assign(ticks.style, { position: 'absolute', inset: 0 });
  for (let rel = -7; rel <= 7; rel++) {
    const tk = h('span', `tick${rel === 0 ? ' is-current' : ''}`, ticks);
    const len = rel === 0 ? 24 : 19.2;
    Object.assign(tk.style, {
      left: `${200.5 - 0.9}px`, top: `${859.5 + 104 * 1.2}px`, width: '1.8px', height: `${len}px`,
      transform: `rotate(${rel * 3.7}deg) translateY(${-240 - len}px)`,
      opacity: clamp((8 - Math.abs(rel)) / 2),
    });
  }
  screen.insertAdjacentHTML('beforeend', `
    <span class="status--time">1:22</span>
    <span class="status--island"></span>
    <img class="status--right" src="lib/assets/mobile/status-right.svg" width="77.6" height="13.2" alt="">
    <div class="head">
      <div class="head--title"><h1>All Cards</h1><img src="lib/assets/mobile/chevron.svg" width="13.3333" height="7.33333" alt=""></div>
      <div class="head--count"><img src="lib/assets/mobile/clover-outline.svg" width="22" height="22" alt=""><span>3</span></div>
    </div>
    <div class="m-nav">
      <span class="m-nav--tab"><img src="lib/assets/nav/tree-off.svg" width="26" height="26" style="margin:-13px 0 0 -13px" alt=""></span>
      <span class="m-nav--tab is-current"><img src="lib/assets/nav/home-on.svg" width="19.0586" height="20.3634" style="margin:-10.5px 0 0 -9px" alt=""></span>
      <span class="m-nav--tab"><img src="lib/assets/nav/profile-off.svg" width="17.0829" height="18.5" style="margin:-8.75px 0 0 -8.54px" alt=""></span>
    </div>
    <span class="homebar"></span>`);
  screen.querySelectorAll('img').forEach((i) => imgs.push(i));
  // the phone's UI, built in piece by piece as the camera lands (not all at once)
  const uiStatus = [...screen.querySelectorAll('.status--time, .status--island, .status--right')];
  const uiHead = screen.querySelector('.head');
  const uiNav = [screen.querySelector('.m-nav'), screen.querySelector('.homebar')];
  hide(phone);
  // Teru on the phone: the centre card of the fan at rest, 1.12 x bigger
  const FRONT_LOCAL = pose(201.68, 396.9 + 33, 0, (1.18 * 1.12 * 271.675) / CW);
  const PHONE_C = [201, 437];
  const phonePose = (x, y, deg, s) => pose(x, y, deg, s, PHONE_C[0], PHONE_C[1]);

  // ---- Shot 8: the logo, drawn on as the app's splash draws it ----
  const logo = h('div', 'p logo', frame);
  logo.style.zIndex = 300;
  const tagline = h('p', 'p tagline', frame, { innerHTML: 'A little luck, every day.' });
  tagline.style.zIndex = 300;
  hide(logo);
  hide(tagline);
  const NS = 'http://www.w3.org/2000/svg';
  let strokes = [];
  let letters = null;
  let sticker = null;
  let clover = null;
  const logoReady = Promise.all([
    fetch('lib/assets/splash/clover-shape.txt?v=1').then((r) => r.text()),
    fetch('lib/assets/splash/trace.json?v=6').then((r) => r.json()),
  ]).then(([shape, lines]) => {
    const V = '0 0 364.995 164.805';
    logo.innerHTML = `<svg width="364.995" height="164.805" viewBox="${V}" xmlns="${NS}">
      <defs><path id="clover-shape" d="${shape.trim()}"/></defs>
      <g id="sticker"><image href="lib/assets/splash/sticker.png?v=1" width="364.995" height="164.805"/></g>
      <g id="letters" mask="url(#trim)"><image href="lib/assets/splash/letters.png?v=1" width="364.995" height="164.805"/></g>
    </svg>`;
    const svg = logo.querySelector('svg');
    letters = svg.querySelector('#letters');
    sticker = svg.querySelector('#sticker');
    const mask = document.createElementNS(NS, 'mask');
    mask.id = 'trim';
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    svg.querySelector('defs').appendChild(mask);
    strokes = lines.map(({ d, w, s, e }) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'white');
      p.setAttribute('stroke-width', w + 1);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      mask.appendChild(p);
      const len = p.getTotalLength();
      p.setAttribute('stroke-dasharray', `${len} ${len + 1}`);
      return { p, len, from: s, to: e, k: -1 };
    });
    // the clover by "Corner" on a layer of its own, to flap (as splash.js)
    const area = (paint) => `<use href="#clover-shape" fill="${paint}" stroke="${paint}" stroke-width="7" stroke-linejoin="round"/>`;
    svg.querySelector('defs').insertAdjacentHTML('beforeend',
      `<mask id="clover-in" maskUnits="userSpaceOnUse" x="-20" y="-20" width="420" height="220">${area('white')}</mask>`
      + `<mask id="clover-out" maskUnits="userSpaceOnUse" x="-20" y="-20" width="420" height="220">`
      + `<rect x="-20" y="-20" width="420" height="220" fill="white"/>${area('black')}</mask>`);
    const wrap = document.createElementNS(NS, 'g');
    wrap.setAttribute('mask', 'url(#clover-out)');
    sticker.before(wrap);
    wrap.append(sticker, letters);
    clover = document.createElementNS(NS, 'g');
    clover.setAttribute('class', 'splash--clover');
    const inner = document.createElementNS(NS, 'g');
    inner.setAttribute('mask', 'url(#clover-in)');
    for (const id of ['#sticker', '#letters']) {
      const u = document.createElementNS(NS, 'use');
      u.setAttribute('href', id);
      inner.appendChild(u);
    }
    clover.appendChild(inner);
    wrap.after(clover);
  });

  // the clover's flaps (mobile.css clover-flap), u from 0 to 1
  const IO = [0.42, 0, 0.58, 1];
  function flap(u) {
    let s = 1;
    let x = 1;
    let o = 1;
    if (u <= 0) { s = 0.4; o = 0; } else if (u < 0.27) {
      const k = bezier([0.3, 1.5, 0.5, 1], u / 0.27);
      s = lerp(0.4, 1, k);
      o = clamp(k);
    } else if (u < 0.45) x = lerp(1, 0.25, bezier(IO, (u - 0.27) / 0.18));
    else if (u < 0.64) x = lerp(0.25, 1, bezier(IO, (u - 0.45) / 0.19));
    else if (u < 0.82) x = lerp(1, 0.25, bezier(IO, (u - 0.64) / 0.18));
    else if (u < 1) x = lerp(0.25, 1, bezier(IO, (u - 0.82) / 0.18));
    return { o, tf: `scale(${s}) rotate(56deg) scaleX(${x}) rotate(-56deg)` };
  }


  // ---------- the timeline (DialKit): every keyframe a clip ----------
  // Grouped by storyboard frame, so the dock reads 1 … 8. These are the
  // version 2 defaults (saved as "V2 · anticipation"; your V1 is kept).
  const E = (ease) => ({ type: 'easing', ease });
  const clip = (at, duration, ease, from = { p: 0 }, to = { p: 1 }) => ({ at, duration, from, to, transition: E(ease) });
  const LINEAR = [0, 0, 1, 1];
  // The reference's transition, measured frame by frame: speed builds over
  // ~0.2 s, peaks a quarter of the way in, then dies away exponentially.
  // As a curve: slow-mo → whip → slow-mo.
  const REF = [0.37, 0, 0.1, 1];
  // V2's transitions: your own sharper fast-to-slow curves from V1 (Spread's,
  // and Tip's for the tip); the anticipations now give the slow wind-in
  const SNAP = [0.19, 0, 0.06, 0.99];
  const TIP = [0, 0.01, 0, 0.98];
  // the fan's turn: quick off the spread, slow through the middle, then
  // picking up speed again as it hands over to the line
  const MOMENTUM = [0.15, 0.45, 0.85, 0.55];
  // the holds in between: a slow, steady drift, so nothing ever stops dead
  const DRIFT = [0.25, 0.25, 0.6, 1];
  // anticipation: a small wind-up the other way, eased in and held, which
  // the next transition releases as it starts
  const WIND = [0.45, 0, 0.55, 1];
  const wind = (at, duration) => clip(at, duration, WIND, { w: 0 }, { w: 1 });
  const CONFIG = {
    duration: 7.5,  // the whole video: 7.5 s (shared by every version)
    '1 card': {
      push: clip(0, 0.7, DRIFT),                                   // the top card, a slow push in
    },
    '2 stack': {
      anticipate: wind(0.19, 0.31),                                // leans back the other way…
      tip: clip(0.27, 0.3, TIP),                                    // quick: it's a hand-off into the fan                                  // …then tips over, the deck fans behind
    },
    '3 fan': {
      anticipate: wind(0.6, 0.25),                                 // the front card rights itself, the cards behind fan back the other way…
      spread: clip(0.75, 0.87, SNAP),                                // …then whips out to the 3D arc
      turn: clip(0.456, 1.27, MOMENTUM, { deg: 16 }, { deg: -10 }),      // the arc's slow turn
      spin: clip(0.75, 0.85, [0.15, 0.55, 0.3, 1], { deg: 0 }, { deg: 0 }), // each card turns on its own centre (counter-clockwise: negative); 0 = off
    },
    '4 line': {
      anticipate: wind(2.18, 0.31),                                // the cards turn back the other way and pull left…
      line: clip(2.37, 0.7, SNAP),                                  // …then snaps into the line, Teru leading
      drift: clip(2.66, 0.7, DRIFT, { x: 0 }, { x: -30 }),
    },
    '5 rise': {
      anticipate: wind(2.94, 0.28),                                 // the line dips…
      rise: clip(3.11, 0.63, SNAP),                                 // …and Teru springs up to centre
      creep: clip(3.36, 0.46, DRIFT, { s: 1 }, { s: 1 }),          // off, as you set it in V1
      sink: clip(1.58, 1.02, [0.4, 0, 0.6, 1]),                    // the two others drift down and fade as Teru rises
    },
    '6 zoom in': {
      anticipate: wind(3.65, 0.28),                                 // Teru draws back…
      zoom: clip(3.82, 0.98, SNAP),                                  // …then the camera rushes in on the doll
      flyOut: clip(3.85, 0.45, [0.6, 0, 0.85, 0.45]),              // frame, words, tag fly off
      sky: clip(3.89, 0.7, REF),                                   // the blue spreads to the edges
      clouds: clip(3.82, 1.12, REF, { x: 0 }, { x: 1 }),            // the clouds part, out to either side
      stars: clip(3.82, 3.71, LINEAR, { deg: 0 }, { deg: 90 }),    // the stars churn (a quarter turn: as drawn again)
      dangle: clip(3.99, 2, [0.25, 0.35, 0.35, 1], { amp: 10 }, { amp: 4 }), // the swing settles…
      push: clip(4.76, 1.72, DRIFT, { s: 1 }, { s: 1.1 }),           // your V1 push
      windup: clip(6.1, 0.63, WIND, { w: 0 }, { w: 1 }),          // …then swings big, and its momentum carries the phone
    },
    '7 phone': {
      zoomOut: clip(6.48, 1.05, SNAP),                               // back out to the phone
      skyBack: clip(6.48, 0.56, [0.6, 0, 0.4, 1]),
      flyBack: clip(6.55, 0.63, [0.15, 0.85, 0.3, 1]),
      ui: clip(6.83, 0.63, [0.3, 0, 0.2, 1]),                      // the app's screen fades up
      tilt: { at: 6.78, duration: 0.65, from: { deg: 0 }, to: { deg: 4 }, transition: { type: 'spring', bounce: 0.45, visualDuration: 0.65 } }, // tapped into its tilt
      anticipate: wind(7.65, 0.39),                                // the phone dips…
      out: clip(7.88, 0.45, [0.6, 0, 0.9, 0.5]),                    // …and flies up and away, clear before the logo
    },
    '8 logo': {
      draw: clip(8.31, 1.19, [0.38, 0, 0.31, 0.99]),               // the app's splash trim
      tagline: clip(9.28, 0.77, [0.16, 1, 0.3, 1]),
      sticker: clip(9.42, 0.63, [0.25, 0.1, 0.25, 1]),
      clover: clip(9.56, 1.12, LINEAR),                              // two flaps (keyframed in flap())
    },
  };
  // the clips V1 never had: in V1 they're set to do nothing, so it stays as you left it
  const NEW_IN_V2 = {
    '2 stack.anticipate.to.w': 0, '3 fan.anticipate.to.w': 0, '4 line.anticipate.to.w': 0,
    '5 rise.anticipate.to.w': 0, '6 zoom in.anticipate.to.w': 0, '6 zoom in.windup.to.w': 0,
    '7 phone.anticipate.to.w': 0, '6 zoom in.clouds.to.x': 0, '6 zoom in.stars.to.deg': 0,
  };
  // every clip as the dock's flat paths, for saving V2
  function flatConfig() {
    const out = {};
    for (const [g, clips] of Object.entries(CONFIG)) {
      if (typeof clips !== 'object') continue;
      for (const [k, cl] of Object.entries(clips)) {
        const base = `${g}.${k}`;
        out[`${base}.at`] = cl.at;
        out[`${base}.duration`] = cl.duration;
        out[`${base}.transition`] = { ...cl.transition, duration: cl.duration };
        for (const [n, val] of Object.entries(cl.from)) out[`${base}.from.${n}`] = val;
        for (const [n, val] of Object.entries(cl.to)) out[`${base}.to.${n}`] = val;
      }
    }
    return out;
  }

  // ---------- reading a clip at any moment ----------
  // (straight from the dock's values, so a hand-off can look at where the
  // previous shot ends and pick up from exactly there: no jumps)
  const TL_ID = 'thumb-v3';
  const { DialStore } = window.DialKit;
  let VALS = {};
  function ev(key, prop = 'p', time) {
    const at = VALS[`${key}.at`];
    if (at === undefined) return 0;
    const d = VALS[`${key}.duration`];
    const tr = VALS[`${key}.transition`];
    const from = VALS[`${key}.from.${prop}`];
    const to = VALS[`${key}.to.${prop}`];
    const u = d > 0 ? clamp((time - at) / d) : time >= at ? 1 : 0;
    const k = tr && tr.type === 'spring' ? springAt(u, tr.bounce ?? 0.3)
      : tr && Array.isArray(tr.ease) ? bezier(tr.ease, u) : bezier(REF, u);
    return from + (to - from) * k;
  }
  // a damped spring across a clip (u 0 → 1): it shoots past and settles,
  // like something tapped. More bounce, more overshoot; done by the clip's end
  function springAt(u, bounce) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    // eased in over its first tenth: quick, but without a jolt
    const ramp = Math.min(1, u / 0.1);
    return springRaw(u, bounce) * ramp * ramp * (3 - 2 * ramp);
  }
  function springRaw(u, bounce) {
    const z = clamp(1 - bounce, 0.08, 1);       // damping ratio
    const w = 7 / z;                            // a quick, snappy swing
    if (z >= 1) return 1 - Math.exp(-w * u) * (1 + w * u);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + ((z * w) / wd) * Math.sin(wd * u));
  }
  // a clip's eased progress on its own (0 → 1; springs overshoot)
  function progress(key, time) {
    const a = VALS[`${key}.at`];
    if (a === undefined) return 0;
    const d = VALS[`${key}.duration`];
    const tr = VALS[`${key}.transition`];
    const u = d > 0 ? clamp((time - a) / d) : time >= a ? 1 : 0;
    return tr && tr.type === 'spring' ? springAt(u, tr.bounce ?? 0.3)
      : tr && Array.isArray(tr.ease) ? bezier(tr.ease, u) : bezier(REF, u);
  }
  const at = (key) => VALS[`${key}.at`] ?? 0;
  const end = (key) => at(key) + (VALS[`${key}.duration`] ?? 0);

  // ---------- poses ----------
  // A card's pose: centre x, y; turn rz; scale s; 3D tilt rx, ry; opacity o
  const D = 2200;   // perspective distance
  const PERSP = new DOMMatrix().translate(W / 2, H / 2)
    .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / D, 0, 0, 0, 1]))
    .translate(-W / 2, -H / 2);
  // the card turns in its own plane (rz), then on its own long (ry) and
  // short (rx) axes, seen through the perspective
  const m3 = (q) => {
    let m = persp.translate(q.x, q.y).rotate(q.rz);
    if (q.ry) m = m.rotateAxisAngle(0, 1, 0, q.ry);
    if (q.rx) m = m.rotateAxisAngle(1, 0, 0, q.rx);
    return m.scale(q.s, q.s, 1).translate(-CW / 2, -CH / 2).toString();
  };
  // ko: how the opacity follows (k for most; k³ holds it solid till late)
  const lp = (a, b, k, ko = k) => ({
    x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rz: lerp(a.rz, b.rz, k), s: lerp(a.s, b.s, k),
    rx: lerp(a.rx, b.rx, k), ry: lerp(a.ry, b.ry, k), o: lerp(a.o, b.o, ko),
  });
  const Q = (x, y, rz, s, o = 1, rx = 0, ry = 0) => ({ x, y, rz, s, rx, ry, o });

  // 1: one card, centred (storyboard 1), pushing in a touch; w: leaning back
  // before it tips (the tip goes clockwise, so it leans the other way)
  const cardPose = (i, p, w) => Q(990 + 8 * w, 550, -4 * w, (615 / CH) * lerp(0.94, 1, p) * (1 - 0.025 * w), 1);
  // 2: the deck: every card on one centre, each one behind turned a little
  // less than the one in front, so their edges peek out (reference 0.9 s).
  // w, the lead-in to the fan (reference 1.25 s): the front card swings
  // back near upright while the cards behind it fan out the other way,
  // each a step further round than the one in front
  function stackPose(i, p, w) {
    const k = Math.min(STACK_ORDER.indexOf(i), 6);
    const R = 22 * p * (1 - 0.92 * w);          // front: tipped, then nearly upright again
    const back = k * (2.8 * p + 7.5 * w);       // the cards behind turn back the other way
    return Q(983 - k * 5 * p - k * 4 * w, 548 + k * 3 * p + k * 2 * w, R - back, (600 / CH) * lerp(1.025, 1, p), 1);
  }
  // 3: the fan (reference 1.3 s): a hand of cards round a centre off to the
  // right, titles out to the left; each card is also turned on its long axis,
  // so it's seen at a slant, like the cards of a rolodex. Tunable live in the
  // "Fan 3D" panel. w: the arc pulls back before the line
  const FAN = { cx: 2100, cy: 430, r: 1400, step: 13, offset: 15, size: 850, turnY: 40, turnX: 0, depth: 2200 };
  let persp = PERSP;
  // w, the wind-up before the line: the line move turns the cards clockwise
  // to upright and carries them right, so first they turn the other way
  // (counter-clockwise) and pull back left, on the spot, not along the arc
  // the whole fan scene, scaled up a touch about the frame's centre
  const FAN_ZOOM = 1.08;
  // The spin (the reference, frame by frame): each card turns on its own
  // centre, counter-clockwise (the Spin clip's angle, e.g. −42°), while its
  // place on the arc, the spacing and the size stay exactly as they are
  function fanPose(i, turn, w, spin = 0) {
    const th = 180 + (TERU - i) * FAN.step + turn;
    const r = (th * Math.PI) / 180;
    let x = FAN.cx + FAN.r * Math.cos(r);
    const y = FAN.cy + FAN.r * Math.sin(r);
    x -= 45 * w;
    return Q(W / 2 + (x - W / 2) * FAN_ZOOM, H / 2 + (y - H / 2) * FAN_ZOOM, th - 270 + FAN.offset - 7 * w + spin,
      (FAN.size / CH) * FAN_ZOOM, 1, FAN.turnX, FAN.turnY);
  }
  // 4: the line (storyboard 4): Teru at the front, two see-through behind;
  // w: the line dips before Teru rises
  const LINE_S = 907 / CH;
  function linePose(i, w) {
    const k = rankOf(i);
    // the rest carry on off to the left, solid, out of sight
    // the cards above Teru carry on off to the right, in a straight line one
    // behind the other; the rest off to the left; all solid, out of sight
    // Teru goes straight to the centre (where it rises), no detour to the right
    const x = i === TERU ? 990
      : i < TERU ? 2450 + (TERU - 1 - i) * 640
      : k < 3 ? 1082 - k * 363 : 1082 - 2 * 363 - 760 * (k - 2);
    // Teru at the height it rises at (no drop between the two); its dip
    // before the rise a gentle one
    // Teru: straight to where it rises, at its rise size, and it stays put
    // there (no dip): the only motion left is the slow shrink before the zoom
    if (k === 0) return Q(990, 576, 0, RISE_S, 1);
    const y = 545 + 22 * w;
    return Q(x, y, 0, LINE_S, k < 3 ? 0.55 : 1);
  }
  // 5: Teru up and centred, the two others drop away (storyboard 5)
  const RISE_S = 938 / CH;
  const RISE = { 3: Q(990, 576, 0, RISE_S), 4: Q(1542, 1276, 0, LINE_S), 5: Q(488, 1093, 0, LINE_S) };
  // where those two sink to (below storyboard 5's spots), faded right out
  const SINK = { 4: Q(1542, 1276, 0, LINE_S, 0), 5: Q(488, 1093, 0, LINE_S, 0) };  // storyboard 5's spots, a slow sink

  // The cards other than Teru line up, leave and sink all at once, and
  // quicker than Teru: within this share of the Line clip's time, on its curve
  const OTHERS_QUICK = 0.38;
  // Teru's own turn to upright: eased in and out, over this share of the clip
  const TERU_TURN = [0.45, 0, 0.25, 1];
  const TERU_TURN_SHARE = OTHERS_QUICK;   // turns upright as fast as the others leave
  // the breathing room before the zoom: from the end of Teru's turn to the
  // zoom's start, Teru subtly shrinks (eased in and out); the zoom takes it from there
  const BREATH_SHRINK = 0.04;
  // Teru's travel in to the centre: the same share as its turn (arrives upright)
  const TERU_MOVE_SHARE = TERU_TURN_SHARE;
  function quickLine(time, share = OTHERS_QUICK) {
    const a = at('4 line.line');
    return ev('4 line.line', 'p', a + (time - a) / share);
  }
  // the two dropping beside Teru go faster still
  const SINK_QUICK = 0.25;

  // The fan's spin: each card turns on its own centre for the WHOLE fan —
  // from the moment it spreads until 0.2 s into the line's anticipation —
  // starting gently (no bump), turning most early, easing through the rest.
  // The Spin clip's angle sets how far (e.g. −42°); its position doesn't matter.
  const SPIN_CURVE = [0.3, 0.2, 0.3, 1];
  const SPIN_INTO_NEXT = 0.2;
  function spinAt(time) {
    const deg = VALS['3 fan.spin.to.deg'] || 0;
    if (!deg) return 0;
    const a = at('3 fan.spread');
    const b = at('4 line.anticipate') + SPIN_INTO_NEXT;
    if (b <= a) return 0;
    return deg * bezier(SPIN_CURVE, clamp((time - a) / (b - a)));
  }

  // shots 1–5 at any moment: each card's pose, transition by transition
  function poolPose(i, time, withDrawBack = true) {
    const pTip = ev('2 stack.tip', 'p', time);
    const pSpread = ev('3 fan.spread', 'p', time);
    // Teru on the Line clip; the others together, quicker
    const pLine = i === TERU ? ev('4 line.line', 'p', time) : quickLine(time);
    const pRise = ev('5 rise.rise', 'p', time);
    let q = cardPose(i, ev('1 card.push', 'p', time), ev('2 stack.anticipate', 'w', time));
    q = lp(q, stackPose(i, pTip, ev('3 fan.anticipate', 'w', time)), pTip);
    q = lp(q, fanPose(i, ev('3 fan.turn', 'deg', time), ev('4 line.anticipate', 'w', time), spinAt(time)), pSpread);
    const fanQ = q;
    const lineQ = linePose(i, ev('5 rise.anticipate', 'w', time));
    q = lp(fanQ, lineQ, pLine, pLine ** 3);
    if (i === TERU) {
      // Teru turns upright as the others leave, but gently: an ease-in-out
      // over most of the Line clip, while it travels in on the clip itself
      const a = at('4 line.line');
      const d = VALS['4 line.line.duration'] || 1;
      const pTurn = bezier(TERU_TURN, clamp((time - a) / (d * TERU_TURN_SHARE)));
      // and travels in to the centre on the very same timing and curve, so it
      // arrives just as it comes upright
      const pMove = pTurn;
      q.x = lerp(fanQ.x, lineQ.x, pMove);
      q.y = lerp(fanQ.y, lineQ.y, pMove);
      q.s = lerp(fanQ.s, lineQ.s, pMove);
      q.rz = lerp(fanQ.rz, lineQ.rz, pTurn);
      q.rx = lerp(fanQ.rx, lineQ.rx, pTurn);
      q.ry = lerp(fanQ.ry, lineQ.ry, pTurn);
    }
    if (SINK[i]) {
      // the two cards behind Teru: sinking and fading while they line up
      // (or on the Sink clip, if that's dragged earlier)
      const pSink = Math.max(quickLine(time, SINK_QUICK), ev('5 rise.sink', 'p', time));
      q = lp(q, SINK[i], pSink);
    } else {
      q = lp(q, RISE[i] || linePose(i, 0), pRise);
    }
    if (i !== TERU) q.x += ev('4 line.drift', 'x', time) * (1 - pRise);  // Teru holds still in the centre
    if (i === TERU) {
      // its slow creep
      q.s *= ev('5 rise.creep', 's', time);
      // before the zoom: one slow, steady shrink (no quick pull-back), from
      // when Teru arrives in the centre right up to the zoom
      const b0 = at('4 line.line') + (VALS['4 line.line.duration'] || 1) * TERU_MOVE_SHARE;
      const b1 = at('6 zoom in.zoom');
      if (b1 > b0) {
        const k = clamp((time - b0) / (b1 - b0));
        q.s *= 1 - BREATH_SHRINK * (0.5 - 0.5 * Math.cos(Math.PI * k));
      }
    }
    return q;
  }

  // Teru in close (storyboard 6): its head's centre (252, 371) at (1005, 482)
  const DOLL = { ax: 252.3, ay: 371, x: 1005, y: 482, s: 2.29 };
  // shot 6: from wherever Teru is when the zoom starts, in on the doll
  function zoomMatrix(time) {
    const S = poolPose(TERU, at('6 zoom in.zoom'), false);
    const start = pose(S.x, S.y, S.rz, S.s);
    const a0 = apply(start, DOLL.ax, DOLL.ay);
    const z = ev('6 zoom in.zoom', 'p', time);
    // the draw-back, still easing out under the first of the zoom
    const back = 1;  // (no quick pull-back: the slow shrink before the zoom replaces it)
    const cam = (b) => pose(lerp(a0[0], DOLL.x, z), lerp(a0[1], DOLL.y, z), lerp(S.rz, 0, z),
      lerpLog(S.s, DOLL.s, z) * b * ev('6 zoom in.push', 's', time), DOLL.ax, DOLL.ay);
    // m: Teru (with its draw-back); camera: what the cards behind it follow
    return { start, m: cam(back), camera: cam(1) };
  }
  // the doll's swing, from the top of its string; the wind-up swings it big
  // just before the zoom out
  function swing(time) {
    const t0 = at('6 zoom in.dangle');
    if (time < t0) return 0;
    const amp = ev('6 zoom in.dangle', 'amp', time) * (1 + 0.9 * ev('6 zoom in.windup', 'w', time));
    return amp * Math.sin((2 * Math.PI * (time - t0)) / 1.47);  // a slow, heavy swing
  }
  // the phone (storyboard 7), and Teru as its front card
  const PH1 = { x: 1050, y: 745, s: 1.49 };
  // the clouds' steady outward drift while zoomed in (card px per second)
  const CLOUD_DRIFT = 22;
  // how long the frame takes to fly off on the zoom-in (× the Fly Out clip)
  const FRAME_OFF_TIME = 1.6;
  // the top of the sky when zoomed in: turned towards violet (share of Hot
  // Pink, mixed in OKLCH) and a little deeper (share of System Black)
  const SKY_VIOLET = 0.06;
  const SKY_DEEPEN = 0.2;
  const SKY_SATURATE = 1.35;   // the top's colour, this much richer (OKLCH chroma)
  // the stars: how far they drift out (× the clouds'), and the front star's swell
  const STAR_OUT = 0.5;
  const STAR_SWELL = 0.25;
  // the tap on the phone: a size pop on the tilt's spring, and a soft rise
  const TAP_POP = 0.025;       // 2.5% bigger at the tap (springy, subtle)
  const TAP_LIFT = 15;         // px it floats up (the fly-off does the rest)…
  const TAP_LIFT_TIME = 0.8;   // …over this long, eased out (not snapped)
  const TAP_LEAD = -0.05;      // the tap starts once it's already moving off (negative: after the Out clip starts)
  const PHONE_DIP = 18;        // px the phone dips before it flies off (small: the rise wins)
  // the logo (storyboard 8)
  logo.style.transform = css(pose(990, 509, 0, 2.266, 364.995 / 2, 164.805 / 2));
  tagline.style.fontSize = '49px';

  // ---------- drawing a moment ----------
  function heroRest() {
    heroBlue.style.visibility = '';
    heroPaper.style.visibility = '';
    heroEdge.style.opacity = '';
    Object.assign(artClip.style, { left: '32px', top: '29px', width: '454px', height: '691px', borderRadius: '31px' });
    art.style.left = '-32px';
    art.style.top = '-29px';
    doll.style.transform = '';
    for (const f of [flyFrame, flyWords, flyTag]) { f.style.transform = ''; f.style.opacity = ''; }
    hide(skyBlue);
    hide(skyPaper);
  }
  function show3(el, q, z) {
    el.style.visibility = q.o > 0.001 ? '' : 'hidden';
    el.style.transform = m3(q);
    el.style.opacity = q.o >= 0.999 ? '' : q.o.toFixed(3);
    el.style.zIndex = z;
  }
  // The hero opening up on matrix m (any turn): the sky spreads e (0–1) from
  // the card's edge to past the frame's; the frame and words fly f (0–1).
  // The spread blue and paper are drawn in the card's own space, so they turn
  // with it (the phone tilts as it comes back).
  // early: how far the frame, words and the card's black edge have gone (the
  // zoom-in sends them off straight away; on the way back they follow f)
  function openHero(m, e, f, early = f) {
    const im = inv(m);
    const pts = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => apply(im, x, y));
    const vx0 = Math.min(...pts.map((p) => p[0])) - 4;
    const vy0 = Math.min(...pts.map((p) => p[1])) - 4;
    const vx1 = Math.max(...pts.map((p) => p[0])) + 4;
    const vy1 = Math.max(...pts.map((p) => p[1])) + 4;
    const ax0 = lerp(32, vx0, e);
    const ay0 = lerp(29, vy0, e);
    const ax1 = lerp(486, vx1, e);
    const ay1 = lerp(720, vy1, e);
    Object.assign(artClip.style, {
      left: `${ax0}px`, top: `${ay0}px`, width: `${ax1 - ax0}px`, height: `${ay1 - ay0}px`, borderRadius: `${31 * (1 - e)}px`,
    });
    art.style.left = `${-ax0}px`;
    art.style.top = `${-ay0}px`;
    if (e > 0.0005) {
      heroBlue.style.visibility = 'hidden';
      heroPaper.style.visibility = 'hidden';
      const cx0 = lerp(0, vx0, e);
      const cy0 = lerp(0, vy0, e);
      const cx1 = lerp(CW, vx1, e);
      const cy1 = lerp(CH, vy1, e);
      const tf = css(mul(m, pose(cx0, cy0, 0, 1, 0, 0)));
      for (const el of [skyBlue, skyPaper]) {
        Object.assign(el.style, {
          visibility: '', transform: tf, width: `${cx1 - cx0}px`, height: `${cy1 - cy0}px`, borderRadius: `${47 * (1 - e)}px`,
        });
      }
      // zoomed in, the sky deepens to a gentle gradient: a deeper, purpler
      // blue at the top (the card's blue turned towards Hot Pink in OKLCH,
      // so it passes through violet, and a touch of System Black) down to the
      // card's own blue; it fades with the spread, gone again as the sky closes
      const pink = (SKY_VIOLET * e * 100).toFixed(1);
      const dark = (SKY_DEEPEN * e * 100).toFixed(1);
      // (and its colour is pushed richer, so the darkening doesn't dull it)
      const sat = (1 + (SKY_SATURATE - 1) * e).toFixed(3);
      skyBlue.style.background = `linear-gradient(to bottom, oklch(from color-mix(in oklch, color-mix(in oklch, var(--v2-blue), var(--hot-pink) ${pink}%), var(--system-black) ${dark}%) l calc(c * ${sat}) h), var(--v2-blue))`;
      skyPaper.style.backgroundSize = '553px 774px';
      skyPaper.style.backgroundPosition = `${-18 - cx0}px ${-18 - cy0}px`;
    }
    heroEdge.style.opacity = (1 - Math.max(e, early)).toFixed(3);
    flyFrame.style.transform = `scale(${1 + 0.45 * early})`;
    flyWords.style.transform = `translateY(${170 * early}px)`;
    flyTag.style.transform = `translateY(${-170 * early}px)`;
    for (const el of [flyFrame, flyWords, flyTag]) el.style.opacity = (1 - early).toFixed(3);
  }

  function render(v) {
    const t = v.time;
    VALS = DialStore.getValues(TL_ID);
    [...pool.filter(Boolean), phone, logo, tagline].forEach(hide);
    hide(hero);
    heroRest();

    const tZoom = at('6 zoom in.zoom');
    const tOut = at('7 phone.zoomOut');
    const tDraw = at('8 logo.draw');

    // shot 6's sky details, carried through shot 7: the clouds part as the
    // camera rushes in and close again on the way out; the stars churn
    const outP = ev('7 phone.zoomOut', 'p', t);
    // …and keep drifting outwards, steadily, the whole time we're in close
    const cloudsAt = at('6 zoom in.clouds');
    const drift = (VALS['6 zoom in.clouds.to.x'] ? 1 : 0) * CLOUD_DRIFT * Math.max(0, t - cloudsAt);
    const part = (45 * ev('6 zoom in.clouds', 'x', t) + drift) * (1 - outP);
    cloudL.style.transform = `translateX(${-part}px)`;
    cloudR.style.transform = `translateX(${part}px)`;
    // the stars churn, and drift out too: away from the doll's head, half as
    // far as the clouds; the front star swells a little
    const churn = ev('6 zoom in.stars', 'deg', t);
    const swell = ev('6 zoom in.clouds', 'x', t) * (1 - outP);
    for (const [el, dir, sx0, sy0, front] of stars) {
      const dx = sx0 - DOLL.ax;
      const dy = sy0 - DOLL.ay;
      const len = Math.hypot(dx, dy) || 1;
      const out = STAR_OUT * part;
      el.style.transform = `translate(${(dx / len) * out}px, ${(dy / len) * out}px) rotate(${dir * churn}deg) scale(${front ? 1 + STAR_SWELL * swell : 1})`;
    }

    if (t < tZoom) {
      // 1–5: the card pool, pose by pose, every card on its own fixed layer
      NAMES.forEach((n, i) => show3(i === TERU ? hero : pool[i], poolPose(i, t), layer(i)));
    } else if (t < tOut) {
      // 6: in close; the cards behind fall away under the camera
      const { start, m, camera } = zoomMatrix(t);
      place(hero, m, 1, layer(TERU));
      const cam = mul(camera, inv(start));
      for (const i of [4, 5]) {
        const q = poolPose(i, t);
        place(pool[i], mul(cam, pose(q.x, q.y, q.rz, q.s)), q.o, layer(i));
      }
      // the frame and its black lines start going as soon as the zoom starts,
      // softly eased out over a little longer than the Fly Out clip
      const fo = clamp((t - at('6 zoom in.zoom')) / ((VALS['6 zoom in.flyOut.duration'] || 0.3) * FRAME_OFF_TIME));
      const frameOff = 1 - Math.pow(1 - fo, 2);
      openHero(m, ev('6 zoom in.sky', 'p', t), ev('6 zoom in.flyOut', 'p', t), frameOff);
      doll.style.transform = `rotate(${swing(t)}deg)`;
    } else if (ev('7 phone.out', 'p', t) < 1) {
      // 7: back out to the phone, from exactly where shot 6 left off. The
      // doll's swing hands its momentum to the phone, which rocks with it
      // and settles; the phone dips, then flies up as the logo draws on.
      const z = outP;
      const PH0 = mul(zoomMatrix(tOut).m, inv(FRONT_LOCAL));
      const c0 = apply(PH0, PHONE_C[0], PHONE_C[1]);
      const s0 = Math.hypot(PH0[0], PH0[1]);
      const r0 = (Math.atan2(PH0[1], PH0[0]) * 180) / Math.PI;
      const tau = t - tOut;
      const hand = (k) => k * k * (3 - 2 * k);
      const h = hand(clamp(tau / 0.49));
      const sw = swing(t);
      const dip = ev('7 phone.anticipate', 'w', t);
      const out = ev('7 phone.out', 'p', t);
      // The phone lands upright and holds. As it leaves, it's tapped: just
      // before the Out clip it springs into its tilt and pops bigger (the
      // Tilt clip's length, angle and bounce), floats up, and flies off tilted
      const tapAt = at('7 phone.out') - TAP_LEAD;
      const tiltLen = VALS['7 phone.tilt.duration'] || 0.6;
      const tiltTr = VALS['7 phone.tilt.transition'];
      const tu = clamp((t - tapAt) / tiltLen);
      const tap = tiltTr && tiltTr.type === 'spring' ? springAt(tu, tiltTr.bounce ?? 0.3)
        : bezier(tiltTr && Array.isArray(tiltTr.ease) ? tiltTr.ease : REF, tu);
      const tiltDeg = (VALS['7 phone.tilt.to.deg'] ?? 4) * tap;
      // …and floats up: its own soft ease-out from the tap, not snapped on the spring
      const lift = 1 - Math.pow(1 - clamp((t - tapAt) / TAP_LIFT_TIME), 3);
      const m = phonePose(
        lerp(c0[0], PH1.x, z),
        lerp(c0[1], PH1.y, z) - TAP_LIFT * lift + PHONE_DIP * dip * (1 - out) - 2200 * out,  // clear of the top well before it ends
        lerp(r0, 0, z) + tiltDeg,  // upright, then tapped into its tilt as it goes
        lerpLog(s0, PH1.s, z) * (1 + TAP_POP * tap) * (1 - 0.03 * dip * (1 - out)),
      );
      const o = 1 - clamp((out - 0.45) / 0.4);
      place(phone, m, o, 45);
      place(hero, mul(m, FRONT_LOCAL), o, layer(TERU));
      const ui = ev('7 phone.ui', 'p', t);
      // the UI builds in piece by piece across the UI clip: the frame and
      // the cards either side first (sliding out from behind Teru), then
      // the status bar and header settling down, the nav rising, the dial
      // (on the UI clip's own time, evenly, each piece eased in and out)
      const uiT = d => clamp((t - at('7 phone.ui')) / (VALS['7 phone.ui.duration'] || 0.4));
      const uiLin = uiT();
      const part = (a, b) => { const k = clamp((uiLin - a) / (b - a)); return k * k * (3 - 2 * k); };
      const kFrame = part(0, 0.55);
      const kSides = part(0, 0.7);
      const kHead = part(0.2, 0.85);
      const kNav = part(0.3, 0.95);
      const kDial = part(0.45, 1);
      screen.style.opacity = '';
      screenBox.style.boxShadow = `0 0 0 10px rgba(17, 17, 17, ${kFrame})`;
      for (const el of sides) {
        const r0 = el._rest;
        el.style.transform = css(pose(lerp(201.68, r0.x, kSides), lerp(429.9, r0.y, kSides), lerp(0, r0.th, kSides), SIDE));
        el.style.opacity = (0.8 * kSides).toFixed(3);
      }
      for (const el of [...uiStatus, uiHead]) {
        el.style.opacity = kHead.toFixed(3);
        el.style.translate = `0 ${-10 * (1 - kHead)}px`;
      }
      for (const el of uiNav) {
        el.style.opacity = kNav.toFixed(3);
        el.style.translate = `0 ${12 * (1 - kNav)}px`;
      }
      ticks.style.opacity = kDial.toFixed(3);
      openHero(mul(m, FRONT_LOCAL), 1 - ev('7 phone.skyBack', 'p', t), 1 - ev('7 phone.flyBack', 'p', t));
      doll.style.transform = `rotate(${sw * (1 - h)}deg)`;
    }

    // 8: the logo draws itself on, the sticker comes down, the clover flaps
    if (t >= tDraw && letters) {
      logo.style.visibility = '';
      const k = ev('8 logo.draw', 'p', t);
      strokes.forEach((st) => {
        const q = clamp((k - st.from) / (st.to - st.from));
        if (q === st.k) return;
        st.k = q;
        st.p.style.visibility = q > 0 ? '' : 'hidden';
        st.p.setAttribute('stroke-dashoffset', (st.len * (1 - q)).toFixed(2));
      });
      if (t >= end('8 logo.draw')) letters.removeAttribute('mask'); else letters.setAttribute('mask', 'url(#trim)');
      sticker.setAttribute('opacity', ev('8 logo.sticker', 'p', t).toFixed(3));
      const tc = at('8 logo.clover');
      const fl = flap(ev('8 logo.clover', 'p', t));
      clover.style.opacity = t >= tc ? fl.o : 0;
      clover.style.transform = fl.tf;
      const g = ev('8 logo.tagline', 'p', t);
      tagline.style.visibility = g > 0 ? '' : 'hidden';
      tagline.style.opacity = g.toFixed(3);
      tagline.style.transform = `translate(0, ${729 + 16 * (1 - g)}px)`;
    }
  }

  // ---------- playback: DialKit's timeline dock ----------
  const fit = document.getElementById('fit');
  // ?export: for rendering frames: the frame at full size, top-left, no dock
  // or panels, nothing playing; window.seek(t) draws each moment
  const EXPORT = /[?&]export\b/.test(location.search);
  let dock = null;
  function resize() {
    if (EXPORT) { fit.style.transform = 'translateX(-50%)'; return; }
    const dockH = dock ? dock.getBoundingClientRect().height : 0;
    const k = Math.min((innerWidth - 32) / W, (innerHeight - dockH - 32) / H);
    fit.style.transform = `translateX(-50%) translateY(16px) scale(${k})`;
  }
  addEventListener('resize', resize);
  resize();

  let tl = null;
  window.seek = (t) => { tl.pause(); tl.seek(t); render(tl.getValues()); };
  window.big = (on = true) => { if (dock) dock.style.display = on ? 'none' : ''; fit.style.transform = on ? `translateX(-50%) scale(${innerWidth / W})` : ''; if (!on) resize(); };
  window.THUMB = { render, get timeline() { return tl; }, CONFIG, FAN };

  // start once every picture and font is ready, so the first loop is smooth
  Promise.all([
    logoReady,
    document.fonts.ready,
    ...imgs.map((i) => i.decode().catch(() => {})),
  ]).then(() => (
    // Saved in the library: the first time this project opens in a browser
    // (nothing saved yet), start from the timeline saved with it (V1, V2, V3
    // and the fan panel), then edits save in the browser as usual
    localStorage.getItem(`dialkit:${TL_ID}`) ? null
      : fetch('timeline.json').then((r) => (r.ok ? r.json() : null)).then((saved) => {
        if (saved) for (const [k, val] of Object.entries(saved)) if (val != null) localStorage.setItem(k, val);
      }).catch(() => {})
  )).then(() => {
    const { createDialTimeline, createDialTimelineRoot } = window.DialKit;
    // edits are kept in this browser (localStorage 'dialkit:thumb-v3'); Copy in the dock exports them
    const KEY = `dialkit:${TL_ID}`;
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* none yet */ }
    tl = createDialTimeline('Luck Corner thumbnail', CONFIG, { id: TL_ID, persist: true, autoplay: !EXPORT, loop: !EXPORT });
    if (EXPORT) {
      // the fan's tuned shape, as saved by its panel
      try {
        const fan = JSON.parse(localStorage.getItem('dialkit:thumb-fan-v1') || 'null');
        const f = fan && fan.values;
        if (f) {
          Object.assign(FAN, {
            r: f['arc.radius'] ?? FAN.r, step: f['arc.spacing'] ?? FAN.step, cx: f['arc.centre x'] ?? FAN.cx, cy: f['arc.centre y'] ?? FAN.cy,
            size: f['cards.size'] ?? FAN.size, offset: f['cards.lean (°)'] ?? FAN.offset,
            turnY: f['3D.turn on long axis'] ?? FAN.turnY, turnX: f['3D.turn on short axis'] ?? FAN.turnX, depth: f['3D.perspective'] ?? FAN.depth,
          });
          persp = new DOMMatrix().translate(W / 2, H / 2)
            .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / FAN.depth, 0, 0, 0, 1]))
            .translate(-W / 2, -H / 2);
        }
      } catch (e) { /* defaults */ }
      document.body.style.background = 'none';
      resize();
      window.EXPORT_READY = true;
      return;
    }
    // Version 2 sits beside your V1 in the dock's version menu. Made once:
    // back V1 up, keep it as it was (the clips it never had do nothing in it),
    // then save V2 and give it these defaults.
    const V2 = 'V2 · anticipation';
    if (!DialStore.getPresets(TL_ID).some((p) => p.name === V2)) {
      try { if (stored) localStorage.setItem(`${KEY}:backup-v1`, JSON.stringify(stored)); } catch (e) { /* no room: carry on */ }
      if (stored && stored.values) {
        const neutral = {};
        for (const [path, val] of Object.entries(NEW_IN_V2)) if (!(path in stored.values)) neutral[path] = val;
        if (Object.keys(neutral).length) DialStore.updateValues(TL_ID, neutral);
      }
      const id = DialStore.saveNewPreset(TL_ID);
      DialStore.renamePreset(TL_ID, id, V2);
      DialStore.updateValues(TL_ID, flatConfig());
    }
    const root = createDialTimelineRoot({ theme: 'dark' });
    // the fan's shape, live
    const { createDialRoot, createDialKit } = window.DialKit;
    createDialRoot({ position: 'top-right', theme: 'dark', defaultOpen: false });
    const fanKit = createDialKit('Fan 3D', {
      arc: { radius: [FAN.r, 400, 3000, 10], spacing: [FAN.step, 2, 20, 0.5], 'centre x': [FAN.cx, 1000, 3500, 10], 'centre y': [FAN.cy, 0, 1080, 5] },
      cards: { size: [FAN.size, 400, 1200, 10], 'lean (°)': [FAN.offset, -45, 45, 1] },
      '3D': { 'turn on long axis': [FAN.turnY, -80, 80, 1], 'turn on short axis': [FAN.turnX, -80, 80, 1], perspective: [FAN.depth, 600, 6000, 50] },
    }, { id: 'thumb-fan-v1', persist: true });
    fanKit.subscribe((f) => {
      Object.assign(FAN, {
        r: f.arc.radius, step: f.arc.spacing, cx: f.arc['centre x'], cy: f.arc['centre y'],
        size: f.cards.size, offset: f.cards['lean (°)'],
        turnY: f['3D']['turn on long axis'], turnX: f['3D']['turn on short axis'], depth: f['3D'].perspective,
      });
      persp = new DOMMatrix().translate(W / 2, H / 2)
        .multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / FAN.depth, 0, 0, 0, 1]))
        .translate(-W / 2, -H / 2);
      if (tl) render(tl.getValues());
    });
    dock = root.element;
    // DialKit's dock rebuilds its rows whenever a clip is edited, and the
    // rebuild throws its list back to the top. Keep it where you left it:
    // remember your scroll, and put it back straight after a rebuild.
    let keep = 0;
    let restoring = false;
    root.element.addEventListener('scroll', (e) => {
      if (!restoring && e.target.classList && e.target.classList.contains('dialkit-timeline-dock')) keep = e.target.scrollTop;
    }, true);
    new MutationObserver((records) => {
      const rebuilt = records.some((r) => [...r.removedNodes].some((n) => n.nodeType === 1));
      const list = root.element.querySelector('.dialkit-timeline-dock');
      if (!rebuilt || !list || Math.abs(list.scrollTop - keep) < 1) return;
      restoring = true;
      list.scrollTop = keep;
      requestAnimationFrame(() => { restoring = false; });
    }).observe(root.element, { childList: true, subtree: true });
    new ResizeObserver(resize).observe(dock);
    // drag a box (or shift-click) to select several clips and move them together
    window.enableTimelineMultiSelect(root.element, TL_ID);
    // click a clip: edit its curve in an After Effects–style speed graph
    window.enableSpeedGraph(root.element, TL_ID);
    // Space plays/pauses; a click outside an open editor closes it
    window.enableShortcuts(root.element, TL_ID);
    resize();
    tl.subscribe(render, true);
  });
})();
