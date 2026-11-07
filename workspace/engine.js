// Motion Workspace engine. Runs whatever scene is in window.SCENE:
//   - the frame at the scene's size, fitted to the window
//   - a DialKit timeline dock (every keyframe a clip you can drag, stretch
//     and re-curve), with multi-select, collapsible scene bars and an
//     After Effects–style speed graph (timeline-select.js, speed-graph.js)
//   - an optional DialKit panel of live sliders (scene.panel)
//   - window.seek(t) to draw any moment; ?export for frame-by-frame rendering
//
// A scene is plain JS (see scene/scene.js): { id, name, width, height,
// duration, timeline, build(frame), render(t), panel? }. It draws each moment
// from the timeline with MW.ev / MW.progress, never from its own clock.

(() => {
  const S = window.SCENE;
  const { DialStore, createDialTimeline, createDialTimelineRoot, createDialRoot, createDialKit } = window.DialKit;
  const W = S.width || 1920;
  const H = S.height || 1080;
  const ID = S.id;
  const EXPORT = /[?&]export\b/.test(location.search);

  // --- the frame ---
  const fit = document.getElementById('fit');
  const frame = document.getElementById('frame');
  Object.assign(fit.style, { width: `${W}px`, height: `${H}px` });
  let dock = null;
  function resize() {
    if (EXPORT) { fit.style.transform = 'translateX(-50%)'; return; }
    const dockH = dock && dock.style.display !== 'none' ? dock.getBoundingClientRect().height : 0;
    const k = Math.min((innerWidth - 32) / W, (innerHeight - dockH - 32) / H);
    fit.style.transform = `translateX(-50%) translateY(16px) scale(${k})`;
  }
  addEventListener('resize', resize);
  resize();

  // the scene builds its pieces
  S.build(frame, MW);

  // --- the timeline ---
  const config = { duration: S.duration, ...S.timeline };
  let tl = null;
  const draw = (time) => {
    MW.setValues(DialStore.getValues(ID));
    S.render(time, MW);
  };
  window.seek = (t) => { tl.pause(); tl.seek(t); draw(t); };
  // a full-size view of the frame, dock hidden (for checking)
  window.big = (on = true) => {
    if (dock) dock.style.display = on ? 'none' : '';
    fit.style.transform = on ? `translateX(-50%) scale(${innerWidth / W})` : '';
    if (!on) resize();
  };

  // for export: hands the saved timeline (and panel) to tools/export.js,
  // which listens on 127.0.0.1:8131 while it's waiting
  window.sendForExport = async () => {
    const data = {};
    for (const k of [`dialkit:${ID}`, `dialkit:${ID}-panel`]) data[k] = localStorage.getItem(k);
    const res = await fetch('http://127.0.0.1:8131/', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(data) });
    return res.text();
  };

  // wait for every picture and font, so the first loop is smooth
  const imgs = [...frame.querySelectorAll('img')];
  Promise.all([
    document.fonts.ready,
    ...(S.ready ? [S.ready] : []),
    ...imgs.map((i) => i.decode().catch(() => {})),
  ]).then(() => {
    tl = createDialTimeline(S.name || 'Scene', config, { id: ID, persist: true, autoplay: !EXPORT, loop: !EXPORT });

    // an optional panel of live sliders, saved alongside the timeline
    if (S.panel) {
      if (EXPORT) {
        try {
          const saved = JSON.parse(localStorage.getItem(`dialkit:${ID}-panel`) || 'null');
          if (saved && saved.values) S.panel.apply(saved.values, true);
        } catch (e) { /* defaults */ }
      } else {
        createDialRoot({ position: 'top-right', theme: 'dark', defaultOpen: false });
        const kit = createDialKit(S.panel.name || 'Scene', S.panel.config, { id: `${ID}-panel`, persist: true });
        kit.subscribe((vals) => { S.panel.apply(vals, false); if (tl) draw(tl.getValues().time); });
      }
    }

    if (EXPORT) {
      document.body.classList.add('is-export');
      resize();
      window.EXPORT_READY = true;
      return;
    }

    const root = createDialTimelineRoot({ theme: 'dark' });
    dock = root.element;
    // DialKit rebuilds the dock's rows on every edit, which throws the list
    // back to the top: keep your scroll
    let keep = 0;
    let restoring = false;
    dock.addEventListener('scroll', (e) => {
      if (!restoring && e.target.classList && e.target.classList.contains('dialkit-timeline-dock')) keep = e.target.scrollTop;
    }, true);
    new MutationObserver((records) => {
      const rebuilt = records.some((r) => [...r.removedNodes].some((n) => n.nodeType === 1));
      const list = dock.querySelector('.dialkit-timeline-dock');
      if (!rebuilt || !list || Math.abs(list.scrollTop - keep) < 1) return;
      restoring = true;
      list.scrollTop = keep;
      requestAnimationFrame(() => { restoring = false; });
    }).observe(dock, { childList: true, subtree: true });
    new ResizeObserver(resize).observe(dock);
    window.enableTimelineMultiSelect(dock, ID);
    window.enableSpeedGraph(dock, ID);
    window.enableShortcuts(dock, ID);
    resize();
    tl.subscribe((v) => draw(v.time), true);
  });
})();
