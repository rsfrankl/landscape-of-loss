# Landscape of Loss dashboard

Static web dashboard of U.S. county population-change pathways, 1950–2020, from
Park, Seymour and Franklin (2026), *Annals of the AAG*, doi:10.1080/24694452.2026.2691208.

**The spec is the source of truth: `docs/SPEC.md`.** Read the relevant section before
starting any task. If the spec and an instruction here disagree, stop and ask.

## How we work

- Build one milestone at a time (spec section 8.4). Start each milestone in plan mode:
  propose the plan, wait for approval, then build.
- Any change to behaviour, data or design updates docs/SPEC.md in the same commit. At
  the start of each milestone plan, check the spec against what is built and list any
  gaps.
- Stop for my review after milestones 1, 3 and 5. Do not start the next milestone
  until I say so.
- Visualize the paper's findings only. No new analysis, no re-clustering. The one
  derived feature is "similar counties" (spec 6.7).
- Ask before adding any dependency not named in spec section 2.
- Run the tests before every commit. Commit at the end of each working step with a
  clear message; never push without asking.

## Data rules (verified against the data; do not "fix" them)

- 2010 base everywhere = the workbook's `pop2010`, NOT `POP_201` in the GeoPackage.
- Recode `46113` → `46102`; sum `51515` (Bedford city) into `51019`. 3,108 counties.
- Neighbour change is population-weighted: sum of neighbours' change / sum of
  neighbours' base population. Queen contiguity on UNSIMPLIFIED geometry.
  Counties with no neighbours (25007, 25019, 53055) count as neighbours-growth.
- The rebuilt A–D codes must match `sequence_loss.csv` + `sequence_growth.csv` in all
  21,756 cells. A mismatch is a build failure, never something to work around.
- Change classes use exact breaks: ≥20, 10 to <20, 0 to <10, −10 to <0, ≤−10.
- Never modify files in `pipeline/raw/`. Never commit `pipeline/raw/` or any file
  over 50 MB (the GeoPackage is 411 MB; GitHub rejects files over 100 MB).

## Design rules

- Colours come from `web/public/data/meta.json` (spec section 7); never hard-code hexes
  in components.
- Never use Arial, including as a CSS fallback. Self-host Jost and IBM Plex Mono.
- Hover only previews; everything in a tooltip must also be reachable by click.

## Layout

- `pipeline/` R (`targets`); `pipeline/raw/` inputs (gitignored); outputs to
  `web/public/data/`, committed.
- `web/` Svelte 5 + Vite + TypeScript + D3.
- `docs/` SPEC.md, validation.md.

## Commands

- `make data` runs the `targets` pipeline (from `pipeline/`); writes `web/public/data/` and
  `docs/validation.md`. Needs `CENSUS_API_KEY` and `npm install` in `pipeline/` (mapshaper).
- `make test` runs the pipeline's `testthat` suite (unit + output contract + A–D gate).

<!-- Fill in as they are created: make data, npm run dev, npm test, etc. -->
