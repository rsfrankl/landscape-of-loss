# Acceptance check (spec 8.5)

Milestone 5, 28 Oct 2026. Written by hand; `docs/validation.md` is the pipeline's generated report.

| Criterion | Status | Evidence |
| --- | --- | --- |
| Pipeline rebuilds A–D with 0 mismatches out of 21,756 cells | Met | Pipeline gate (`check_ad`); `docs/validation.md` |
| Exactly 3,108 counties, each with pathway, sequence, 8 counts and RUCC (or a note) | Met | `make test` (output contract) |
| Pathway counts on screen: 557, 126, 442, 512, 949, 141, 312, 69 | Met | Vitest; smoke test reads the legend |
| 2010–20 breakdown shows 1,637 losing and 1,471 gaining | Met | Smoke test |
| Milam TX and Buena Vista VA are 2010–20 losers; Sarpy NE is 10–19.9% | Met | Vitest; smoke test reads the profiles and Sarpy's bar colour |
| Table 1 and Table 2 comparisons in `docs/validation.md`, gaps explained | Met | 104 / 104 within ±0.5 (education row intended); Table 2 20 / 20 |
| Similar counties: 5 results (or a note) in under 5 ms; same-pathway default | Met | Vitest (200 selections timed) |
| Every URL state round-trips | Met | Vitest (`parseUrl`/`toSearch`); smoke tests for mode, decade, county, path, hl, sim |
| No Arial in computed styles anywhere | Met | Smoke tests, including with the explainer and intro card open |
| Keyboard-only path: search → select → read profile → close | Met | Smoke test; explainer tabs by keyboard, Esc, focus return |
| Lighthouse accessibility 95 or higher | Met | 100 desktop, 100 mobile |
| Performance budgets (8.1) | Met on desktop | See below |

## Lighthouse (13.5.0, production preview, local)

| Preset | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop | 98 | 100 | 100 | 0.3 s | 1.1 s | 30 ms | 0 |
| Mobile (simulated slow 4G, 4× CPU) | 74 | 100 | 100 | 1.4 s | 5.9 s | 230 ms | 0 |

The first run scored 98 for accessibility and 96 for best practices. The fixes, all in
the same commit:
- The map is now the page's `<main>` landmark.
- An SVG favicon replaces a 404 for `/favicon.ico`.
- On phones, the decade label shortcuts' accessible names did not contain their
  two-digit visible text. They are now hidden from assistive technology, since the
  slider is the keyboard and screen-reader route.

The mobile LCP of 5.9 s is the startup data (0.75 MB gzipped) over simulated slow 4G.
Phones are a later release (spec 8.2), and the 8.1 budget is for a laptop on home
broadband.

## Performance budgets (8.1)

Measured in headless Chromium on the author's Mac (Apple silicon), not a 2020 laptop.

- First map: 274 ms locally to painted fills; Lighthouse desktop LCP 1.1 s (budget 2.5 s).
- Startup data 0.75 MB gzipped (budget 2 MB); JavaScript 65 kB gzipped (budget 150 kB).
- Mode changes: every frame during the 300 ms recolour within 16.8 ms (budget 50 ms).
- Playback: 60 fps over six steps (budget 30 fps).

## axe (WCAG 2.1 A and AA)

`@axe-core/playwright` in the smoke suite finds no violations on the default view, a
profile with every block open, or each explainer tab. axe leaves some colour-contrast
checks "incomplete" (text over the map canvas or translucent layers, which it cannot
compute); those were checked by eye.
