# Probe harnesses

Thirty-seven throwaway browser pages in `scripts/`. Each was written during
development to answer **one** question about a skin, and most of them exist
because a screenshot could not answer it: whether a dashed fold cuts a
descender between two letters is invisible at 1×, and "the type looks a bit
heavy" is not a number you can regress against.

They are not a test suite. `npm run verify` is the test suite, and it is
deliberately browser-free so it runs anywhere. These are the opposite: they
need a real layout engine, they print measurements, and reading them is the
point.

```bash
node scripts/probe.mjs                 # list every probe
node scripts/probe.mjs fidelity        # run one
node scripts/probe.mjs skinprobe --page tags   # one that needs a target page
node scripts/probe.mjs sweep --raw     # whole DOM instead of just the output
```

`npm run build` first — the probes measure the built site in `dist/`, so they
need one.

## How they work, and why that shape

Every probe is the same trick: load the built site into a same-origin
`<iframe>`, wait for it to settle, then read `contentDocument` and compute a
number. Same-origin is what makes `frame.contentDocument` readable at all,
which is why the runner copies the probe into `dist/_probe/` and serves it from
the site root — a probe served from `scripts/` would be a different origin and
every measurement would come back as an empty document.

Two things this buys that a screenshot cannot:

- **Text ink, not container boxes.** `Range.getClientRects()` gives the rects of
  actual glyphs. A `<p>` box overlapping a rule means nothing; a glyph
  overlapping it is the bug. Several probes (fold, seal, tab) depend on this.
- **Computed values after the page settles.** Reveal animations, lazy canvases
  and the skin switcher all resolve after load. A probe scrolls the page to
  fire the `IntersectionObserver`s first — measuring a page nobody has scrolled
  measures nothing.

Output is either plain lines in `<pre id="out">` or a `RESULT:` JSON blob. The
runner prints whichever appeared and never parses it; these are read by a
person deciding whether to change a rule.

## The catalogue

### Whole-page checks

| Probe | Answers | Needs a page |
| --- | --- | --- |
| `probe` | The general harness: horizontal overflow, contrast ratios, resolved tokens, canvases, reveals, missing alt text, errors — across several pages and two widths in one pass. | no — takes a JSON array, defaults to 4 pages |
| `sweep` | The same sweep over every page × skin × width. Prints one row per combination so a regression is a diff. | no |
| `fidelity` | Resolved design tokens, grid math, the type ramp as rendered, and which print artifacts are present. This is the "did the skin actually load" check. | yes |
| `errprobe` | Console errors and uncaught exceptions per page. | no |
| `sheetbox` | The `.spread` boxes on every page — top, height, width — so a sheet that grew without anyone noticing shows up as a number. | no |
| `deadprobe` | Ink occupancy per 50px band, and runs of ≥150px with nothing painted. Finds dead space at the bottom of a sheet. | no |
| `fillprobe` | Where the last ink element inside a sheet stops, and how much void is left below it. | no |
| `widthprobe` | Box geometry and overflow for the key containers at one width. | yes |

### Skins

| Probe | Answers | Needs a page |
| --- | --- | --- |
| `skinprobe` | Which skin is active, its `--bg`, and which furniture actually rendered (unseal, HUD, grid overlay, crop marks, switcher). | yes |
| `switchprobe` | Snapshots the page before and after a skin switch and diffs them: what changed, what leaked across. | no |
| `cssprobe` | Which rules match an element, and the resolved transition/opacity/transform. Use it when a rule "should" apply and does not. | yes |
| `mqprobe` | Whether a media query is actually matching inside the iframe, and the resulting column widths. | no |

### Cover and layout

| Probe | Answers | Needs a page |
| --- | --- | --- |
| `coverprobe` | Where content actually stops in the left column of the cover; plate size; ink mass. | no |
| `coverprobe2` | Every descendant of the cover with a real box, plus vertical occupancy per column band. | no |
| `overlap` | Whether the sticker or tape covers the left text column, whether it escapes the sheet, and whether the body collides with the foot. | yes |
| `rectprobe` | The first line box of the `h1` via `Range` — real glyph geometry, not the element's box. | no |
| `kidsprobe` | Child box widths inside the cover at 390px, to catch a child that refuses to shrink (`min-width`, `white-space`). | yes |
| `boxprobe` | Boxes of the tag cloud and `.punch` furniture. | no |
| `punchprobe` | Lone Trail's punch-card block: the box of every part, the dot grid, and whether the matrix scrolls past its column. | no |
| `cvprobe` | The cover at `?skip=1`, per skin — boxes, background, display, and the first text node. The "did the cover build itself" check. | no |
| `tabprobe` | What actually paints at the tab's centre, and whether the tab box overlaps any text. Includes the keyboard case: `S` in the input must not toggle. | no |

### Effects and motion

| Probe | Answers | Needs a page |
| --- | --- | --- |
| `fxprobe` | The scanline layer: does it exist, what is its computed background, does the toggle remove it, does the preference survive a reload. | no |
| `fxprobe2` | The scanline's real cost — samples the composited pixels of a text block with the layer on and off and reports the spread between dark and light rows. | no |
| `fxprobe3` | Whether a pinned `?fx=off` survives navigation and beats storage, and that a skin with no toggle has no layer. | no |
| `motionprobe` | Whether anything is actually moving: two frames of the same element, and a count of elements carrying a CSS animation. | no |
| `clockprobe` | Is the reveal rule applying, or is the animation clock frozen? Forces the end state and reads it back. | yes |
| `revealprobe` | Whether an above-the-fold element becomes visible without scrolling. | yes |
| `ltlaunch` | The launch ceremony: is scroll actually impossible while locked, and what is focusable underneath. | no |
| `ltlaunch2` | What is under the centre of the viewport at each stage of the ceremony. | no |
| `lockprobe` | Whether `body.locked { overflow: hidden }` really stops the viewport. | no |
| `ltlayout` | Lone Trail's layout at each width: tracks, gutters, ticker, punch columns. | no |
| `ltprobe` | Lone Trail's initial state: canvases drawn, morse bar, CRT layer, punch dots. | no |
| `skipprobe` | Whether `?skip=1` avoids painting a ceremony, and whether the top of the page is the page rather than an overlay. | no |
| `sealprobe` | Whether the seal element exists and what its opacity/visibility resolve to. | yes |
| `rhprobe` | The running head's boxes and colours. | no |
| `canvasprobe` | Whether a canvas was actually painted or left at its default size. | yes |
| `clickprobe` | Does clicking the seal dismiss it, and do the cover reveals become visible afterwards. | yes |

`shot.py` is not a probe page — it summarises a PNG and says whether it is
painted or blank. It exists because a headless screenshot that silently failed
looks exactly like a white page.

## Writing a new one

Copy an existing probe that is already shaped like what you need; they are all
under ~150 lines and none of them share a library, on purpose. Two conventions
keep the collection usable:

- **Put the question in a comment at the top.** Not "measure the cover" —
  "where does content actually stop in the left column?". A probe whose
  question is not written down cannot be deleted later, because nobody can tell
  whether it still matters.
- **Print numbers, not verdicts.** `overlap=0.0%` can be re-judged when the
  design changes; `PASS` cannot.

If a probe answers a question that is now settled forever — the feature it
measured is gone, or the rule it checked is enforced by `npm run check` — delete
it. The collection is worth keeping only while every file still answers
something.

## Why these are in the repository at all

`.dockerignore` excludes `scripts/*.html` from the published image, and the
comment there explains why they are excluded by pattern rather than by name.
The reason they are *tracked* is that `SKINS.md` and `DESIGN.md` cite two of
them by path as the evidence behind specific conclusions, and because the
alternative is worse: a design decision defended by "I measured it" with the
measurement thrown away is indistinguishable from a guess.

That said — thirty-seven of them accumulated before any of this was written
down, which is how the README ended up pointing at a probe workflow it never
described. If you add one, add a row above.
