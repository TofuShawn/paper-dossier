# docs/

Working material that does not belong in the published template, plus (when
there is any) documentation that is too long for the root.

The working material here is not tracked; this file is, because a directory of
untracked output that nobody explains is worse than the clutter it replaced. The
root keeps the published surface — `README.md`, `SKINS.md`, `WRITING.md`,
`DESIGN.md`, `THIRD-PARTY.md`, the licence, and the build entry points.

## What is here

| Path | What | Tracked |
| --- | --- | --- |
| `README.md` | This file | yes |
| `PROBES.md` | Catalogue of the 37 browser harnesses in `scripts/` — what each measures, how to run one, how to write one | yes |
| `TOOLING.md` | Why the linter and formatter are configured the way they are — the settings that look arbitrary and are not | yes |
| `shots/`, `shots2/` … `shots6/` | Screenshot passes taken while developing the skins | no — several hundred PNGs, ~62 MB |
| `ref/` | Reference captures the first skin was built from | no |
| `screenshots/actual/` | Output of the fidelity comparison | no |

## Why they live here rather than in the root

Seven directories of screenshots at the top level made the repository hard to
read: a visitor had to scroll past sixty megabytes of PNGs to find the four
files that describe the template. Moving them here costs nothing — nothing in
the build reads these paths (verified: no reference in `scripts/`, `package.json`,
`Dockerfile` or the Astro config) — and `.dockerignore` already keeps them out
of the published image.

## The rules are anchored

`.gitignore` pins these to `docs/`:

```
docs/shots/
docs/shots*/
docs/ref/
```

Anchoring matters. A bare `shots/` matches only the root, so moving the folder
would silently un-ignore it; a bare `shots*/` matches a directory of that name
at *any* depth, including one a future contributor means to commit. Spelling out
`docs/` says exactly what is excluded and where.

## If you add documentation

Long-form docs that should travel with the repo (design notes, ADRs, a glossary)
go here and are tracked. Add the path explicitly rather than loosening the
patterns above — an ignore rule broad enough to catch everything also catches
what you meant to publish.

Note that the four root guides are referenced thirteen times across the repo and
are the first thing a visitor sees on GitHub. Do not move them here for
tidiness; their location is the point.

## Continuous integration

`.github/` sits at the root because GitHub only reads it there — it is the one
exception to "the published surface only". Its two files are documented in the
root README under "Checks, and what each one defends"; they are not working
material and do not belong in this directory.
