// Multi-select and scene sequences for DialKit's timeline dock (DialKit
// itself has single clips only):
//   - drag a box over empty lane space to select every clip it touches
//   - shift-click a clip to add it to (or take it out of) the selection
//   - drag any selected clip and the others move with it, by the same time
//   - collapse a scene and its row becomes one long sequence bar, from its
//     first clip's start to its last clip's end: drag it to move the whole
//     scene; shift-click or box it to add it to a selection; double-click it
//     to open the scene again
//   - click empty space or press Esc to clear
// A move is DialKit's own store write ("<clip>.at"), so it saves and copies
// like any drag in the dock.

window.enableTimelineMultiSelect = (dockRoot, timelineId) => {
  const { DialStore, TimelineStore } = window.DialKit;
  const selected = new Set();   // clip keys, e.g. "6 zoom in.zoom"

  const meta = () => TimelineStore.getTimeline(timelineId);
  const valuesOf = () => DialStore.getValues(timelineId);
  const atOf = (key) => valuesOf()[`${key}.at`];
  const durOf = (key) => valuesOf()[`${key}.duration`];
  const keysOf = (group) => (meta()?.clips ?? []).filter((c) => c.group === group).map((c) => c.key);
  const labelOf = (row) => (row.querySelector('.dialkit-timeline-label, .dialkit-timeline-identity') || row).textContent.trim();
  const isCollapsed = (row) => row.querySelector('.dialkit-timeline-group-toggle')?.getAttribute('aria-expanded') === 'false';

  // the clip key of each bar in the dock: its row's label under its group row
  function clipNodes() {
    const m = meta();
    if (!m) return [];
    const out = [];
    let group;
    for (const row of dockRoot.querySelectorAll('.dialkit-timeline-row')) {
      const label = labelOf(row);
      if (row.classList.contains('dialkit-timeline-group-row')) { group = label; continue; }
      const node = row.querySelector(':scope .dialkit-timeline-clip');
      if (!node) continue;
      const clip = m.clips.find((c) => (c.group ?? undefined) === group && c.label === label)
        || m.clips.find((c) => c.label === label);
      if (clip) out.push({ keys: [clip.key], node });
    }
    return out;
  }

  // the timeline's scale in the dock: pixels per second, and the time at the
  // lane's left edge (read off any visible clip; else the lane's full width)
  function units() {
    for (const { keys: [key], node } of clipNodes()) {
      const r = node.getBoundingClientRect();
      const d = durOf(key);
      if (r.width > 20 && d > 0) {
        const px = r.width / d;
        const laneLeft = node.parentElement.getBoundingClientRect().left;
        return { px, start: atOf(key) - (r.left - laneLeft) / px };
      }
    }
    const lane = dockRoot.querySelector('.dialkit-timeline-group-row .dialkit-timeline-lane, .dialkit-timeline-lane');
    const m = meta();
    return lane && m ? { px: lane.getBoundingClientRect().width / m.duration, start: 0 } : { px: 0, start: 0 };
  }

  // --- scene sequences: one long bar on each collapsed scene's row ---
  let painting = false;
  function seqNodes() {
    return [...dockRoot.querySelectorAll('.tl-seq')].map((node) => ({ keys: keysOf(node.dataset.group), node }));
  }
  function drawSequences() {
    const { px, start } = units();
    for (const row of dockRoot.querySelectorAll('.dialkit-timeline-group-row')) {
      const lane = row.querySelector('.dialkit-timeline-lane');
      if (!lane) continue;
      let bar = lane.querySelector(':scope > .tl-seq');
      const group = labelOf(row);
      const keys = keysOf(group);
      if (!isCollapsed(row) || !keys.length || !px) { bar?.remove(); continue; }
      const t0 = Math.min(...keys.map(atOf));
      const t1 = Math.max(...keys.map((k) => atOf(k) + (durOf(k) || 0)));
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'tl-seq';
        bar.title = `${group}: drag to move the whole scene · double-click to open it`;
        lane.appendChild(bar);
      }
      bar.dataset.group = group;
      Object.assign(bar.style, { left: `${(t0 - start) * px}px`, width: `${Math.max(14, (t1 - t0) * px)}px` });
      // faint ticks where each of its clips starts, and the scene's name
      const marks = keys.map((k) => `<i style="left:${(atOf(k) - t0) * px}px"></i>`).join('');
      const html = `${marks}<span>${group} · ${(t1 - t0).toFixed(2)}s</span>`;
      if (bar.innerHTML !== html) bar.innerHTML = html;
    }
  }

  function paint() {
    if (painting) return;
    painting = true;
    drawSequences();
    for (const { keys, node } of [...clipNodes(), ...seqNodes()]) {
      node.classList.toggle('is-multi', keys.length > 0 && keys.every((k) => selected.has(k)));
    }
    painting = false;
  }
  // the dock rebuilds its rows on every change (and on collapse/expand): put
  // the sequences and the selection back on
  new MutationObserver((records) => {
    // our own bar's text changing isn't a rebuild
    if (records.every((r) => r.target.closest && r.target.closest('.tl-seq'))) return;
    paint();
  }).observe(dockRoot, { childList: true, subtree: true });
  // and when values change (another clip moved, a playthrough edit)
  DialStore.subscribe(timelineId, () => requestAnimationFrame(paint));
  addEventListener('resize', () => requestAnimationFrame(paint));
  requestAnimationFrame(paint);

  // --- the box ---
  const box = document.createElement('div');
  box.className = 'tl-marquee';
  document.body.appendChild(box);

  dockRoot.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // the playhead (its time flag and line) is DialKit's to drag: leave it be
    if (e.target.closest('.dialkit-timeline-playhead-control')) return;
    const seqEl = e.target.closest('.tl-seq');
    const clipEl = e.target.closest('.dialkit-timeline-clip');

    // a scene's sequence bar
    if (seqEl) {
      e.preventDefault();
      e.stopPropagation();
      const keys = keysOf(seqEl.dataset.group);
      const all = keys.every((k) => selected.has(k));
      if (e.shiftKey) {
        keys.forEach((k) => (all ? selected.delete(k) : selected.add(k)));
        paint();
        return;
      }
      // with other things selected too, it moves them all; on its own, just this scene
      if (!all) { selected.clear(); keys.forEach((k) => selected.add(k)); paint(); }
      groupDrag(e, [...selected]);
      return;
    }

    // shift-click a clip: toggle it (DialKit leaves shift-presses on clips alone)
    if (clipEl && e.shiftKey) {
      const hit = clipNodes().find((c) => c.node === clipEl);
      if (hit) {
        if (!selected.delete(hit.keys[0])) selected.add(hit.keys[0]);
        paint();
      }
      e.preventDefault();
      return;
    }

    // a selected clip, with others selected too: move them all together
    // (its edges still resize just that one clip, as before)
    if (clipEl && !e.target.dataset.edge && e.target.dataset.boundary === undefined) {
      const hit = clipNodes().find((c) => c.node === clipEl);
      if (hit && selected.has(hit.keys[0]) && selected.size > 1) {
        e.stopPropagation();
        e.preventDefault();
        groupDrag(e, [...selected]);
        return;
      }
      // a plain press on an unselected clip: back to DialKit's single editing
      if (hit && !selected.has(hit.keys[0]) && selected.size) { selected.clear(); paint(); }
      return;
    }

    // empty space in the clip area (right of the labels; not the ruler, where
    // it scrubs, nor any button): draw a box
    const lane = dockRoot.querySelector('.dialkit-timeline-lane');
    const laneLeft = lane ? lane.getBoundingClientRect().left : Infinity;
    if (!clipEl && e.target.closest('.dialkit-timeline-grid') && e.clientX >= laneLeft
      && !e.target.closest('.dialkit-timeline-ruler-row, button, [role="button"], input')) {
      e.preventDefault();
      e.stopPropagation();
      marquee(e);
    }
  }, true);  // capture: before DialKit's own clip handler

  // double-click a sequence: open its scene back up
  dockRoot.addEventListener('dblclick', (e) => {
    const seqEl = e.target.closest('.tl-seq');
    if (!seqEl) return;
    e.preventDefault();
    e.stopPropagation();
    seqEl.closest('.dialkit-timeline-group-row')?.querySelector('.dialkit-timeline-group-toggle')?.click();
  }, true);

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected.size) { selected.clear(); paint(); }
  });

  function marquee(start) {
    const additive = start.shiftKey;
    const before = new Set(selected);
    let moved = false;
    const move = (e) => {
      const x0 = Math.min(start.clientX, e.clientX);
      const y0 = Math.min(start.clientY, e.clientY);
      const x1 = Math.max(start.clientX, e.clientX);
      const y1 = Math.max(start.clientY, e.clientY);
      if (!moved && x1 - x0 < 3 && y1 - y0 < 3) return;
      moved = true;
      Object.assign(box.style, { display: 'block', left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
      selected.clear();
      if (additive) before.forEach((k) => selected.add(k));
      for (const { keys, node } of [...clipNodes(), ...seqNodes()]) {
        const r = node.getBoundingClientRect();
        if (r.right >= x0 && r.left <= x1 && r.bottom >= y0 && r.top <= y1) keys.forEach((k) => selected.add(k));
      }
      paint();
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      box.style.display = 'none';
      if (!moved && !additive) { selected.clear(); paint(); }  // a click on empty space clears
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }

  // move clips together by the same time, never past either end of the timeline
  function groupDrag(start, keys) {
    const { px } = units();
    if (!px || !keys.length) return;
    const total = meta().duration;
    const from = {};
    keys.forEach((k) => { from[k] = { at: atOf(k), d: durOf(k) || 0 }; });
    const lo = -Math.min(...Object.values(from).map((f) => f.at));
    const hi = Math.min(...Object.values(from).map((f) => total - f.at - f.d));
    let moved = false;
    const move = (e) => {
      const dx = e.clientX - start.clientX;
      if (!moved && Math.abs(dx) <= 3) return;
      moved = true;
      const dt = Math.min(hi, Math.max(lo, dx / px));
      const next = {};
      for (const k of Object.keys(from)) next[`${k}.at`] = Math.round((from[k].at + dt) * 1000) / 1000;
      DialStore.updateValues(timelineId, next);
    };
    const up = () => {
      removeEventListener('pointermove', move, true);
      removeEventListener('pointerup', up, true);
    };
    addEventListener('pointermove', move, true);
    addEventListener('pointerup', up, true);
  }

  // for the speed graph: which clip a bar in the dock is
  window.TimelineClips = { keyOf: (node) => clipNodes().find((c) => c.node === node)?.keys[0] };

  return { selected, clear: () => { selected.clear(); paint(); } };
};
