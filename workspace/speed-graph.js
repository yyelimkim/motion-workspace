// After Effects–style graph editor for the DialKit timeline's clips.
//
// Open a clip's editor in the dock (click the clip), then press "Speed graph"
// in its header: a separate pop-up shows the clip's curve as After Effects'
// Speed Graph: speed over the clip's time, with a handle at each keyframe.
// Drag a handle sideways to set its influence (how long the ease lasts) and
// up/down to set the speed leaving or reaching that keyframe. The Value tab
// shows the same clip as its value curve (the cubic-bezier, two free handles).
//
// It writes the clip's own easing (DialStore "<clip>.transition"), the same
// value DialKit's editor writes, so edits save, version and copy as usual.
//
// The mapping, for a clip eased by cubic-bezier(x1, y1, x2, y2), with speed
// measured against a steady (linear) move, so 1 = linear speed:
//   out-going handle: influence = x1,      speed = y1 / x1
//   in-coming handle: influence = 1 − x2,  speed = (1 − y2) / (1 − x2)

window.enableSpeedGraph = (dockRoot, timelineId) => {
  const { DialStore } = window.DialKit;
  let key = null;        // the clip being edited, e.g. "4 line.line"
  let mode = 'speed';    // 'speed' or 'value'
  let yMax = 3;          // the speed axis' top, held still while dragging
  let drag = null;

  const PRESETS = {
    'Easy Ease': [0.333, 0, 0.667, 1],          // F9
    'Ease In': [0, 0, 0.667, 1],                // shift-F9: slows as it arrives at the end keyframe
    'Ease Out': [0.333, 0, 1, 1],               // ctrl-shift-F9: slows leaving the start keyframe
    Linear: [0, 0, 1, 1],
    'Whip (ref)': [0.37, 0, 0.1, 1],            // the reference: slow-mo, whip, slow-mo
  };

  // --- the panel ---
  const panel = document.createElement('div');
  panel.className = 'sg';
  panel.innerHTML = `
    <div class="sg-head">
      <span class="sg-title">Graph</span>
      <div class="sg-tabs"><button data-mode="speed" class="is-on">Speed</button><button data-mode="value">Value</button></div>
      <button class="sg-close" aria-label="Close">×</button>
    </div>
    <canvas class="sg-canvas" width="720" height="380"></canvas>
    <div class="sg-readout"></div>
    <div class="sg-presets">${Object.keys(PRESETS).map((n) => `<button data-preset="${n}">${n}</button>`).join('')}</div>
    <p class="sg-hint">Drag a handle: sideways = influence, up/down = speed.</p>`;
  document.body.appendChild(panel);
  const canvas = panel.querySelector('canvas');
  const cx = canvas.getContext('2d');
  const readout = panel.querySelector('.sg-readout');
  const title = panel.querySelector('.sg-title');

  // the panel moves by its header
  panel.querySelector('.sg-head').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    panel.style.right = 'auto';
    const move = (m) => { panel.style.left = `${m.clientX - ox}px`; panel.style.top = `${m.clientY - oy}px`; };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  panel.querySelector('.sg-close').addEventListener('click', () => { key = null; panel.classList.remove('is-open'); });
  panel.querySelectorAll('.sg-tabs button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    panel.querySelectorAll('.sg-tabs button').forEach((x) => x.classList.toggle('is-on', x === b));
    draw();
  }));
  panel.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    if (!key) return;
    write(PRESETS[b.dataset.preset].slice());
    fitScale();
    draw();
  }));

  // --- the clip ---
  const vals = () => DialStore.getValues(timelineId);
  function ease() {
    const tr = vals()[`${key}.transition`];
    return tr && Array.isArray(tr.ease) ? tr.ease.slice() : null;
  }
  function write(e) {
    const v = vals();
    const tr = v[`${key}.transition`] || {};
    const round = (n) => Math.round(n * 1000) / 1000;
    DialStore.updateValue(timelineId, `${key}.transition`, { ...tr, type: 'easing', ease: e.map(round), duration: v[`${key}.duration`] });
  }

  // cubic-bezier pieces
  const B = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const dB = (a, b, t) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  // speed (× linear) along the clip, sampled
  function speedCurve(e, n = 160) {
    const [x1, y1, x2, y2] = e;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const dx = dB(x1, x2, t);
      const dy = dB(y1, y2, t);
      pts.push([B(x1, x2, t), dx > 1e-4 ? dy / dx : (dy > 0 ? 99 : 0)]);
    }
    return pts;
  }
  // the AE handles, from the curve
  // (with no influence, the speed is the curve's own slope at that end)
  const slopeAt = (e, t) => { const dx = dB(e[0], e[2], t); return dx > 1e-6 ? dB(e[1], e[3], t) / dx : 0; };
  function handles(e) {
    const [x1, y1, x2, y2] = e;
    return {
      out: { infl: x1, speed: x1 > 1e-3 ? y1 / x1 : slopeAt(e, 0.001) },
      in: { infl: 1 - x2, speed: 1 - x2 > 1e-3 ? (1 - y2) / (1 - x2) : slopeAt(e, 0.999) },
    };
  }
  function fitScale() {
    const e = ease();
    if (!e) return;
    const peak = Math.max(...speedCurve(e).map((p) => Math.min(p[1], 12)));
    const h = handles(e);
    yMax = Math.max(2, Math.min(14, Math.max(peak, h.out.speed, h.in.speed) * 1.2));
  }

  // --- drawing ---
  const PAD = { l: 52, r: 18, t: 16, b: 30 };
  const W = () => canvas.width - PAD.l - PAD.r;
  const H = () => canvas.height - PAD.t - PAD.b;
  const sx = (x) => PAD.l + x * W();
  const sySpeed = (v) => PAD.t + H() * (1 - v / yMax);
  // value graph: room for overshoot above 1 and below 0
  const VLO = -0.35;
  const VHI = 1.35;
  const syValue = (y) => PAD.t + H() * (1 - (y - VLO) / (VHI - VLO));

  function draw() {
    const c = cx;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#1b1b1b';
    c.fillRect(0, 0, canvas.width, canvas.height);
    const e = key ? ease() : null;
    if (!e) {
      c.fillStyle = '#8a8a8a';
      c.font = '24px Paperlogy, sans-serif';
      c.fillText(key ? 'This clip uses a spring: edit it in DialKit.' : 'Click a clip in the dock.', PAD.l, canvas.height / 2);
      readout.textContent = '';
      return;
    }
    const d = vals()[`${key}.duration`] || 1;
    // grid: time across (in seconds), speed or value up
    c.strokeStyle = '#2c2c2c';
    c.lineWidth = 2;
    c.fillStyle = '#6f6f6f';
    c.font = '18px ui-monospace, monospace';
    for (let i = 0; i <= 4; i++) {
      const x = sx(i / 4);
      c.beginPath(); c.moveTo(x, PAD.t); c.lineTo(x, PAD.t + H()); c.stroke();
      c.fillText(`${(d * i / 4).toFixed(2)}s`, x - 22, canvas.height - 8);
    }
    if (mode === 'speed') {
      const step = yMax > 6 ? 2 : yMax > 3 ? 1 : 0.5;
      for (let v = 0; v <= yMax + 1e-6; v += step) {
        const y = sySpeed(v);
        c.beginPath(); c.moveTo(PAD.l, y); c.lineTo(PAD.l + W(), y); c.stroke();
        c.fillText(`${v.toFixed(v % 1 ? 1 : 0)}×`, 6, y + 6);
      }
      // linear speed, for reference
      c.setLineDash([8, 8]);
      c.strokeStyle = '#4a4a4a';
      c.beginPath(); c.moveTo(PAD.l, sySpeed(1)); c.lineTo(PAD.l + W(), sySpeed(1)); c.stroke();
      c.setLineDash([]);
      // the speed curve, filled under like AE's
      const pts = speedCurve(e);
      c.beginPath();
      c.moveTo(sx(0), sySpeed(0));
      pts.forEach(([x, v]) => c.lineTo(sx(x), sySpeed(Math.min(v, yMax * 1.5))));
      c.lineTo(sx(1), sySpeed(0));
      c.closePath();
      c.fillStyle = 'rgba(17, 178, 228, 0.12)';
      c.fill();
      c.beginPath();
      pts.forEach(([x, v], i) => (i ? c.lineTo : c.moveTo).call(c, sx(x), sySpeed(Math.min(v, yMax * 1.5))));
      c.strokeStyle = '#11b2e4';
      c.lineWidth = 3;
      c.stroke();
      // keyframe handles: a bar from the keyframe out to its influence
      const h = handles(e);
      const bar = (x0, x1, v, hot) => {
        const y = sySpeed(Math.min(v, yMax));
        c.strokeStyle = '#f0f2a1';
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(sx(x0), y); c.lineTo(sx(x1), y); c.stroke();
        c.fillStyle = '#f0f2a1';
        c.beginPath(); c.arc(sx(x1), y, hot ? 11 : 9, 0, Math.PI * 2); c.fill();
        // the keyframe itself
        c.fillStyle = '#fafafa';
        c.fillRect(sx(x0) - 7, y - 7, 14, 14);
      };
      bar(0, h.out.infl, h.out.speed, drag?.which === 'out');
      bar(1, 1 - h.in.infl, h.in.speed, drag?.which === 'in');
      readout.innerHTML = `<span>Out · influence ${(h.out.infl * 100).toFixed(1)}% · speed ${h.out.speed.toFixed(2)}×</span>`
        + `<span>In · influence ${(h.in.infl * 100).toFixed(1)}% · speed ${h.in.speed.toFixed(2)}×</span>`;
    } else {
      for (const y of [0, 0.5, 1]) {
        c.beginPath(); c.moveTo(PAD.l, syValue(y)); c.lineTo(PAD.l + W(), syValue(y)); c.stroke();
        c.fillText(`${Math.round(y * 100)}%`, 6, syValue(y) + 6);
      }
      const [x1, y1, x2, y2] = e;
      c.strokeStyle = '#555';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(sx(0), syValue(0)); c.lineTo(sx(x1), syValue(y1)); c.stroke();
      c.beginPath(); c.moveTo(sx(1), syValue(1)); c.lineTo(sx(x2), syValue(y2)); c.stroke();
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        (i ? c.lineTo : c.moveTo).call(c, sx(B(x1, x2, t)), syValue(B(y1, y2, t)));
      }
      c.strokeStyle = '#11b2e4';
      c.lineWidth = 3;
      c.stroke();
      for (const [x, y, w] of [[x1, y1, 'p1'], [x2, y2, 'p2']]) {
        c.fillStyle = '#f0f2a1';
        c.beginPath(); c.arc(sx(x), syValue(y), drag?.which === w ? 11 : 9, 0, Math.PI * 2); c.fill();
      }
      readout.innerHTML = `<span>cubic-bezier(${e.map((n) => n.toFixed(2)).join(', ')})</span>`;
    }
  }

  // --- dragging the handles ---
  function toCanvas(ev) {
    const r = canvas.getBoundingClientRect();
    return [(ev.clientX - r.left) * (canvas.width / r.width), (ev.clientY - r.top) * (canvas.height / r.height)];
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const e = key && ease();
    if (!e) return;
    const [px, py] = toCanvas(ev);
    let best = null;
    const near = (x, y, which) => {
      const d = Math.hypot(px - x, py - y);
      if (d < 28 && (!best || d < best.d)) best = { d, which };
    };
    if (mode === 'speed') {
      const h = handles(e);
      near(sx(h.out.infl), sySpeed(Math.min(h.out.speed, yMax)), 'out');
      near(sx(1 - h.in.infl), sySpeed(Math.min(h.in.speed, yMax)), 'in');
    } else {
      near(sx(e[0]), syValue(e[1]), 'p1');
      near(sx(e[2]), syValue(e[3]), 'p2');
    }
    if (!best) return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    drag = { which: best.which };
    draw();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const e = ease();
    if (!e) return;
    const [px, py] = toCanvas(ev);
    const fx = Math.min(1, Math.max(0, (px - PAD.l) / W()));
    if (mode === 'speed') {
      const speed = Math.max(0, yMax * (1 - (py - PAD.t) / H()));
      const infl = Math.min(1, Math.max(0.001, drag.which === 'out' ? fx : 1 - fx));
      if (drag.which === 'out') { e[0] = infl; e[1] = speed * infl; } else { e[2] = 1 - infl; e[3] = 1 - speed * infl; }
    } else {
      const fy = VHI - ((py - PAD.t) / H()) * (VHI - VLO);
      if (drag.which === 'p1') { e[0] = fx; e[1] = fy; } else { e[2] = fx; e[3] = fy; }
    }
    write(e);
    draw();
  });
  const end = () => { if (drag) { drag = null; fitScale(); draw(); } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // --- which clip: the one whose DialKit editor is open ---
  // Clicking a clip opens DialKit's own editor; that click is remembered here,
  // and the editor's header gets a "Speed graph" button that opens this
  // pop-up for that clip. Nothing opens on its own.
  let editing = null;
  dockRoot.addEventListener('pointerdown', (ev) => {
    const node = ev.target.closest('.dialkit-timeline-clip');
    if (!node || ev.shiftKey) return;
    editing = window.TimelineClips?.keyOf(node) || null;
  }, true);
  function open(k, beside) {
    key = k;
    const [group, clip] = k.split(/\.(?=[^.]+$)/);
    title.textContent = `${group} · ${clip}`;
    // beside DialKit's editor, kept on screen
    if (beside) {
      const r = beside.getBoundingClientRect();
      const left = Math.min(innerWidth - 436, r.right + 8);
      Object.assign(panel.style, { right: 'auto', left: `${Math.max(8, left)}px`, top: `${Math.max(8, r.top)}px` });
    }
    panel.classList.add('is-open');
    fitScale();
    draw();
  }
  function addButton(pop) {
    const head = pop.querySelector('.dialkit-timeline-popover-header');
    if (!head || head.querySelector('.sg-open')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sg-open';
    b.textContent = 'Speed graph';
    b.title = 'Open this clip in an After Effects–style speed graph';
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const k = editing;
      if (k) open(k, pop);
    });
    head.insertBefore(b, head.querySelector('.dialkit-timeline-popover-close'));
  }
  new MutationObserver(() => {
    document.querySelectorAll('.dialkit-timeline-popover').forEach(addButton);
  }).observe(document.body, { childList: true, subtree: true });
  // other edits to the clip (DialKit's own editor, a preset load) redraw it
  DialStore.subscribe(timelineId, () => { if (key && !drag) requestAnimationFrame(draw); });

  draw();
};
