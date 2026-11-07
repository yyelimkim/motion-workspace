#!/bin/bash
# Refreshes this library copy from the working Luck Corner thumbnail in
# ~/Projects/Luck Storage/thumbnail (scene code and dock add-ons), repointing
# paths to this folder and adding the saved-timeline loader. The timeline
# itself (timeline.json) is refreshed separately, from the browser.
set -e
SRC="$HOME/Projects/Luck Storage/thumbnail"
cd "$(dirname "$0")"
cp "$SRC/"{index.html,thumb.js,thumb.css,timeline-select.js,speed-graph.js,shortcuts.js} .
sed -i '' 's#\.\./vendor/dialkit/#../../vendor/dialkit/#g; s#\.\./design-system\.css#lib/design-system.css#g' index.html
sed -i '' 's#\.\./assets/#lib/assets/#g' thumb.js thumb.css
python3 - <<'PY'
p='thumb.js'; s=open(p).read()
a="""  ]).then(() => {
    const { createDialTimeline, createDialTimelineRoot } = window.DialKit;"""
assert s.count(a)==1, 'startup block not found'
s=s.replace(a,"""  ]).then(() => (
    // Saved in the library: the first time this project opens in a browser
    // (nothing saved yet), start from the timeline saved with it (V1, V2, V3
    // and the fan panel), then edits save in the browser as usual
    localStorage.getItem(`dialkit:${TL_ID}`) ? null
      : fetch('timeline.json').then((r) => (r.ok ? r.json() : null)).then((saved) => {
        if (saved) for (const [k, val] of Object.entries(saved)) if (val != null) localStorage.setItem(k, val);
      }).catch(() => {})
  )).then(() => {
    const { createDialTimeline, createDialTimelineRoot } = window.DialKit;""")
open(p,'w').write(s)
PY
echo "synced from $SRC"
