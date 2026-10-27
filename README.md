# The Landscape of Loss: US County-Level Depopulation Pathways, 1950–2020

A static web dashboard for exploring the eight county population-change pathways
(1950–2020) published in:

> Park, G., Seymour, E., and Franklin, R. (2026). Characterizing the Landscape of Loss:
> A Spatiotemporal Contextual Approach to Measuring U.S. County-Level Depopulation.
> *Annals of the American Association of Geographers*.
> [doi:10.1080/24694452.2026.2691208](https://doi.org/10.1080/24694452.2026.2691208)

The dashboard shows the paper's findings only. Its one derived feature is a "similar
counties" ranking. It covers 3,108 conterminous U.S. counties in 2020 boundaries.

Historical population data: Schroeder, Jonathan P. (2016). Historical Population Estimates
for 2010 U.S. States, Counties and Metro/Micro Areas, 1790–2010. Data Repository for the
University of Minnesota (DRUM). [doi:10.13020/D6XW2H](https://doi.org/10.13020/D6XW2H).

The full specification is in [docs/SPEC.md](docs/SPEC.md). The data validation report is in
[docs/validation.md](docs/validation.md).

## Layout

- `pipeline/`: R data pipeline (`targets`). It writes `web/public/data/` and `docs/validation.md`.
- `web/`: Svelte 5 + Vite + TypeScript + D3 site.
- `docs/`: spec and validation report.

## Running the site

The pipeline's outputs are committed, so the site builds without R.

```bash
cd web
npm install
npm run dev        # http://localhost:5173/landscape-of-loss/
npm test           # Vitest
npm run smoke      # Playwright smoke test (first run: npx playwright install chromium)
npm run build      # production build in web/dist/
```

Pushing to `main` builds the site and deploys it to GitHub Pages
(`.github/workflows/deploy.yml`).

## Running the pipeline

The pipeline needs R 4.4+, the author's raw inputs in `pipeline/raw/` (never committed),
a Census API key in `CENSUS_API_KEY`, and `npm install` in `pipeline/` for mapshaper.

```bash
make data   # run the targets pipeline
make test   # pipeline tests, including the A–D reproduction gate
```

## Citing

See [CITATION.cff](CITATION.cff).
