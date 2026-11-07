# References

Drop what you're matching here: screen recordings of motion you like,
storyboard frames, stills, notes.

To study a recording's motion:

```
python3 tools/analyze-reference.py references/your-recording.mov
```

That writes `references/your-recording-analysis/` with contact sheets, a
frame-by-frame speed chart, the detected cuts, and the cubic-bezier that best
fits each shot — paste those into your clips' transitions.
