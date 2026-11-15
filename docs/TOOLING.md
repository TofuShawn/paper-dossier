# Formatting and linting

Two tools, two jobs, no overlap. This file records the decisions that are not
obvious from the config, because each of them will otherwise be "fixed" by
somebody who has not hit the reason yet.

## Prettier is not allowed to touch `.css` or `*.md`

`.prettierignore` carries the long version. The short one: Prettier turns a
hand-set one-line CSS rule into four lines. Five skin stylesheets plus
`base.css` is around 3000 lines of typography written deliberately in that
shape, so adopting Prettier for CSS would produce a diff of a few thousand
lines that changes no rendered pixel — and every future rule would then be
formatted by a tool with no opinion about typography.

Markdown is the same argument with less at stake: Prettier re-aligns tables to
the widest cell, so a one-word edit becomes a whole-table diff.

## `trailingComma: "es5"`, not `"all"`

This is the one setting that is not a preference.

`src/skins/*/Chrome.astro` contain `<script is:inline>` blocks. Astro copies
those into the HTML **verbatim** — they are not bundled, not transpiled, and
not touched by any build step. Prettier's default (`"all"`) adds a trailing
comma to function calls of more than one line:

```js
// "all" — emitted into the HTML exactly like this
svg.setAttribute(
  'viewBox',
  '0 0 ' + w + ' ' + h,
);
```

Trailing commas in function calls are ES2017. Every browser that matters
supports them, so this is not a live bug — but it is a syntax error in anything
older, in the middle of an inline script with no source map and no error
message, in a template whose whole premise is that it degrades gracefully. The
cost of `"es5"` is zero: it still allows trailing commas in array and object
literals, which is where they actually help readability.

If a future Astro version starts bundling inline scripts, this setting can be
relaxed. Until then, it is load-bearing.

## `no-var` is off for one file

`src/skins/terminal/Chrome.astro` carries a ~250-line inline canvas scene
written in ES5 style. Its output is pixels: the wireframe bodies, the leader
lines, the two densities of one ink. There is no test that can assert the
picture is unchanged, so converting 100+ `var`s to `let` — in code where
several of those variables are captured across function scope — would be a
change with real risk and no verifiable benefit.

The exemption is scoped to that file, not to `**/*.astro`. The three other
skins' Chrome components each had a single `var` and were converted.

The rule stays on everywhere else, including all of `src/lib/` and `scripts/`.

## `no-explicit-any` is a warning, not an error

There are ~21 of them, almost all in skin `client.ts` files, and they are of one
kind: `(x as any).someProperty` where the value comes from the DOM or from a
`getComputedStyle` string and its shape genuinely is not known statically.
Turning them into proper types would mean writing type guards for values the
code already reads defensively.

They are left visible rather than suppressed — `npm run lint` exits 0, so they
do not gate CI, but they show up in the output. If one of them ever hides a real
bug, it is in the list.

## What runs where

| Command | Needs | In CI |
| --- | --- | --- |
| `npm run lint` | Node | yes |
| `npm run format:check` | Node | yes |
| `npm run check` | Node | yes |
| `npm run verify` | Node | yes |
| `npm run verify:docker` | Docker | yes |
| `npm run probe` | Chrome + a build | no — see [PROBES.md](PROBES.md) |

The probes are deliberately absent from CI. They measure geometry: overflow,
glyph collisions, contrast of a composited layer. A probe "failing" means a
design changed, which is a decision a person makes, not a defect a robot should
block a merge on.
