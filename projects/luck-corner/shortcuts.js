// Shortcuts for the DialKit timeline workspace:
//   - Space: play / pause (not while typing in a field)
//   - Click outside an open clip editor (DialKit's pop-up) or the speed
//     graph: closes it. Clicking another clip still opens that one instead.

window.enableShortcuts = (dockRoot, timelineId) => {
  const { TimelineStore } = window.DialKit;

  const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (typing(e.target) || typing(document.activeElement)) return;
    e.preventDefault();          // (and don't "click" a focused button)
    const tr = TimelineStore.getTransport(timelineId);
    if (tr.playing) TimelineStore.pause(timelineId);
    else TimelineStore.play(timelineId);
  }, true);

  addEventListener('pointerdown', (e) => {
    const t = e.target;
    const inside = (sel) => !!(t.closest && t.closest(sel));
    // DialKit's clip editor: close on a click outside it (a clip opens its own)
    const pop = document.querySelector('.dialkit-timeline-popover');
    if (pop && !inside('.dialkit-timeline-popover') && !inside('.sg') && !inside('.dialkit-timeline-clip')) {
      pop.querySelector('.dialkit-timeline-popover-close')?.click();
    }
    // the speed graph: close on a click outside it and outside the editor
    const sg = document.querySelector('.sg.is-open');
    if (sg && !inside('.sg') && !inside('.dialkit-timeline-popover') && !inside('.dialkit-timeline-clip')) {
      sg.querySelector('.sg-close')?.click();
    }
  }, true);
};
