# Landscape of Loss dashboard — technical spec

Oct 26, 2026 · @Rachel

## 1. Purpose and scope

Build a static, desktop-first web dashboard that lets people explore the eight county population-change pathways (1950–2020) published in Park, Seymour and Franklin (2026). It visualizes the paper's findings only. No new analysis. The one derived product is a "similar counties" ranking computed from the paper's own decadal change data (section 6.7).

**Source paper.** Park, G., Seymour, E., and Franklin, R. (2026). Characterizing the Landscape of Loss: A Spatiotemporal Contextual Approach to Measuring U.S. County-Level Depopulation. *Annals of the American Association of Geographers*. [doi:10.1080/24694452.2026.2691208](https://doi.org/10.1080/24694452.2026.2691208). Cite and link it in the About panel and footer, not in the title area.

**Audience.** Researchers, planners, journalists and policy staff. Assume map literacy, not familiarity with sequence analysis.

**Geography and time.** 3,108 conterminous U.S. counties in 2020 boundaries (no Alaska, Hawaii, Puerto Rico). Seven decades of change: 1950–60 through 2010–20.

**In scope**

- Three map modes (section 6.2): decadal % population change and the decade-by-decade A–D map, sharing one decade slider, and the typology map (8 pathways)
- A 2010–20 breakdown linking that decade's loss and growth to the 8 pathways (section 6.6)
- County profile panel with the sequence strip, population history, ACS profile, components of change, urban–rural class
- Similar counties (5), search, "use my location", pathway filter, explainer, CSV download

**Not in scope**

- New statistical analysis, re-clustering or recomputing the typology
- Post-2020 data (the data model should allow adding it later; section 5)
- A backend, user accounts or a basemap with streets
- Highlighting neighbouring counties on the map
- Interactive sequence index plots (Figs. 6–7) and the transition-rate matrix (Fig. 5)

**Reference sites** for interaction feel: [Imago UK similarity explorer](https://imago-sdruk.github.io/embeddings-uk-explorer/) and [Imago SPF explorer](https://itsshaonlee.github.io/imago-spf-explorer/app/).

## 2. Stack and repository

An R data pipeline writes static JSON and TopoJSON; a Svelte 5 + Vite + D3 front end reads them; GitHub Pages serves the result.

| Layer | Choice | Reason |
| --- | --- | --- |
| Data prep | R 4.4+: `sf`, `dplyr`, `readxl`, `tidycensus`, `jsonlite`, `targets` | Author can audit it; matches the paper's toolchain |
| Geometry | mapshaper CLI (npm) | Best simplification that keeps shared county borders |
| Front end | Svelte 5 (runes) + Vite + TypeScript, with `@sveltejs/vite-plugin-svelte`, `svelte-check` and `@types/*` packages for D3 and TopoJSON | Reactive shared state with a small bundle |
| Fonts | `@fontsource/jost` (weights 400 and 800) and `@fontsource/ibm-plex-mono` (400), latin subset only, imported in the app's entry file; Futura stays local-only (no file shipped) | Self-hosted woff2 with `font-display: swap` (section 7) |
| Map and charts | D3 v7: `d3-geo` (`geoConicEqualArea`, Albers parameters), `d3-zoom`, `topojson-client` | Equal-area projection matching the paper's figures |
| Rendering | Canvas for county fills; SVG overlay for state lines, hover outline, selection, labels | 3,108 fills recolour per frame without lag |
| Hosting | GitHub Pages via a GitHub Actions workflow | Static, no backend |
| Tests | `testthat` (pipeline), Vitest (logic), Playwright (smoke) |  |

No React, no MapLibre or Leaflet, no basemap tiles, no UI component library.

**Repository layout.** GitHub repository `rsfrankl/landscape-of-loss`.

```
/pipeline        R scripts (_targets.R), raw/ (gitignored), checks/
/pipeline/raw    inputs listed in section 3 (never committed)
/web             Svelte app (src/, public/data/ ← pipeline outputs)
/docs            this spec, data dictionary, validation report
.github/workflows/deploy.yml
```

`make data` runs the pipeline and writes to `/web/public/data`. Pipeline outputs are committed so the site builds without R.

## 3. Source data

Five inputs come from the author and three are public downloads. The author files are in the claude.ai project "depopulation dashboard"; copy them into `pipeline/raw/`.

| Input | Source | Contents | Used for |
| --- | --- | --- | --- |
| `depopulation_data.gpkg` | Author | Layers `us_pop_change` (Fig. 1) and `us_counties_typologies` (Fig. 8): 3,108 county polygons in ESRI:102003 Albers, shoreline-clipped, \~200 MB per layer | Geometry, names, `POP_202` (2020 count) |
| `County_population_1790_to_2010.xlsx` | Author (Schroeder 2016, 2010 boundaries) | Sheet `c2010_hist_pops`: 3,143 counties, `epop1950`–`epop2000`, `pop2010` | Population 1950–2010 |
| `sequence_loss.csv`, `sequence_growth.csv` | Author | 1,637 + 1,471 counties × A–D state for decades `60`…`20` | Sequence strip, A–D map |
| `us_seq_typologies.xlsx` | Author | `GEO_FIPS`, `cluster` (name), `cluster2` ("Cluster 1"–"Cluster 8") | Pathway membership |
| `data_dict.docx` | Author | Hex colours for Fig. 1, A–D and the 8 pathways | Palettes (section 7) |
| ACS 2016–2020 5-year | Census API via `tidycensus` (free API key in `CENSUS_API_KEY`) | Tables listed in section 4 step 6 | County profile, Table 1 |
| Vintage 2020 county estimates | census.gov `co-est2020-alldata.csv` | Annual natural increase and net migration, 2010–2020 | Components of change, Table 2 |
| Rural–Urban Continuum Codes 2013 and 2023 | USDA ERS | RUCC 1–9 per county | Urban–rural class and filter |

**Credit for the historical population data** (cleared for use by the author, 26 Oct 2026; show in the About panel, README and CSV header): Schroeder, Jonathan P. (2016). Historical Population Estimates for 2010 U.S. States, Counties and Metro/Micro Areas, 1790–2010. Data Repository for the University of Minnesota (DRUM). [doi:10.13020/D6XW2H](https://doi.org/10.13020/D6XW2H).

**Known issues, already verified (26 Oct 2026)**

1. **Geography changes.** The workbook uses 2010 codes. Recode Shannon County SD `46113` → `46102` (Oglala Lakota), and add Bedford city VA `51515` into Bedford County `51019`. Drop Alaska, Hawaii and other non-conterminous rows. Result: exactly the 3,108 counties in the GeoPackage.
2. **Two different 2010 counts.** `POP_201` in the GeoPackage differs from the workbook's `pop2010` in 716 counties (median 0, 99th percentile 0.2%). The A–D sequences use the workbook value. **Use the workbook `pop2010` as the 2010 base everywhere.** Ignore `POP_201`, `DIFF`, `PER_CHA`, `CHANGE_` and `CAT2`; recompute them.
3. **Two counties change direction** once item 2 is applied: Milam TX (`48331`) and Buena Vista city VA (`51530`) become 2010–20 losers, consistent with their loss pathways.
4. **Figure 1 bins.** The published `CAT2` uses breaks at ±9.9 and 19.9, which misplaces 20 counties against their labels. Use exact breaks (section 4 step 4).
5. **GeoPackage attribute tables** (`sequence_*`, `us_seq_typologies`) were imported with their header as row 1. Read the CSV/XLSX files instead.
6. **Geometry size.** Simplify to a TopoJSON under 1.2 MB (section 4 step 2).

## 4. Data pipeline

The pipeline reproduces the paper's A–D codes exactly before writing anything; a mismatch fails the build. Run it as a `targets` pipeline in R; each step writes to `pipeline/out/`.

1. **Harmonize IDs.** Zero-pad all FIPS to 5 characters. Apply the two recodes in section 3 issue 1 (sum Bedford city into Bedford County). Keep the 3,108 GEOIDs in `us_counties_typologies`. Assert every input joins 1:1 on GEOID.
2. **Geometry.** Read `us_counties_typologies`; transform to EPSG:4326 (D3 projects lon/lat). With mapshaper: `-simplify weighted 3% keep-shapes`, `-clean`, `-o format=topojson quantization=1e5 id-field=GEOID`. Object `counties` holds properties `name` (e.g. "Autauga County"), `state` ("Alabama"), `stusps` ("AL"). Derive object `states` by dissolving on `STATEFP`. Target size under 1.2 MB; tune the percentage and record the value used.
3. **Population.** Build a table of 8 counts per county: 1950–2000 from `epop*`, 2010 from the workbook `pop2010`, 2020 from `POP_202`.
4. **Change measures.** For each decade d (1950–60 … 2010–20), with P₀ the start count and P₁ the end count:
   - percent change = 100 × (P₁ − P₀) / P₀
   - log growth rate = ln(P₁ / P₀), used only for similarity
   - 2010–20 category (replaces Fig. 1 `CAT2`): ≥ 20 → "Growth 20% or more"; 10 to < 20 → "+10% to 19.9%"; 0 to < 10 → "0% to 9.9%"; > −10 to < 0 → "−0.1% to −9.9%"; ≤ −10 → "Decline 10% or more". Colours in section 7.
5. **Rebuild and verify A–D.** Queen neighbours from the **unsimplified** geometry (`sf::st_intersects`, excluding self). Neighbour change is population-weighted, not a mean of percentages (formula below). A county is "loss" if P₁ < P₀; neighbours are "loss" if the lag is < 0. A = self loss, neighbours loss; B = self loss, neighbours growth; C = self growth, neighbours loss; D = self growth, neighbours growth. Counties with no neighbours (Dukes MA `25007`, Nantucket MA `25019`, San Juan WA `53055`) count as neighbours-growth. **Assert 0 mismatches out of 21,756 cells** against the sequence files (verified 26 Oct 2026). The site displays the author's sequence files; the rebuild is only a check.
6. **ACS 2016–2020 profile.** Fetch with `tidycensus::get_acs(geography = "county", year = 2020, survey = "acs5")`. Indicators match Table 1 rows: race/ethnicity shares from the 2020 Census, not the ACS (PL 94-171 table P2 via tidycensus::get\_decennial; reproduces Table 1 within 0.1); age 65+ (B01001); foreign-born (B05002); speaks a language other than English at home, share of age 5+ (B16004; these are the measure behind Table 1's values, whose row label differs); bachelor's degree or higher, age 25+ (B15003); below poverty (B17001); industry shares of employed civilians 16+ for agriculture/forestry/fishing/hunting/mining, manufacturing, and professional/scientific/management/administrative (C24050); owner- and renter-occupied (B25003). Keep estimates and MOEs. Compute pathway and U.S. values as pooled ratios (sum of numerators / sum of denominators). "U.S." here means the 3,108 conterminous counties of the study, not the whole country; the interface labels it "Conterminous U.S.".
7. **Check Table 1.** Compare pooled pathway values with Table 1. Write differences to `docs/validation.md`. Tolerance ±0.5 points; a larger gap is reported, not fatal. Expected and intended: the education row, because the dashboard uses bachelor's degree or higher while Table 1 uses bachelor's degree only; report it as an intentional difference. If county means reproduce Table 1 better than pooled ratios, report that and use whichever matches.
8. **Components of change.** From Vintage 2020 `co-est2020-alldata.csv` (SUMLEV 050), sum the annual columns April 2010–July 2020: natural increase (`NATURALINC*`), domestic (`DOMESTICMIG*`), international (`INTERNATIONALMIG*`), net migration (`NETMIG*`). For the 1,637 loss counties assign the Table 2 driver by sign, counting natural change ≤ 0 as decrease (verified 26 Oct 2026: reproduces Table 2 in all 20 cells): net out-migration only; net out-migration + natural decrease; natural decrease only; "other" (net migration ≥ 0 and natural change > 0). Check counts against Table 2 (e.g. persistent loss 114 / 299 / 23 / 6); assert a 20/20 match.
9. **Urban–rural.** Join RUCC 2013 and 2023. Metro = codes 1–3; nonmetro = 4–9. Use 2023 as primary. RUCC 2023 codes Connecticut by planning regions, not counties, so its 8 counties have no 2023 code: fall back to 2013 and set a `rucc_note`.
10. **Write outputs** (section 5), then `docs/validation.md` summarising steps 5, 7 and 8.

Neighbour change for county i in decade d, over its queen neighbours N(i):

```latex
\text{lag}_{i,d} = \frac{\sum_{j \in N(i)} \left(P_{j,t_1} - P_{j,t_0}\right)}{\sum_{j \in N(i)} P_{j,t_0}}
```

A plain average of neighbours' percentage changes reproduces only 90% of cells. Do not use it, even though the paper's text says "weighted average" and Appendix B mentions row-standardisation (that note describes the Moran's I weights).

## 5. Output data for the front end

Five files in `web/public/data/`; the first three load at startup (target under 2 MB gzipped together), the rest load on first open of the county profile.

| File | Loaded | Contents |
| --- | --- | --- |
| `counties.topo.json` | Startup | Objects `counties` (id = GEOID) and `states` |
| `meta.json` | Startup | Years, decade labels, pathway definitions, palettes, bins, citation, data notes |
| `counties.json` | Startup | One record per county (below) |
| `acs.json` | On demand | County, pathway and U.S. indicator values with MOEs |
| `components.json` | On demand | 2010–20 components of change per county |

`counties.json` record:

```json
{
  "geoid": "01005", "name": "Barbour County", "state": "Alabama", "stusps": "AL",
  "pathway": 1, "group": "loss",
  "seq": "BBDDDBB",
  "pop": [28892, 24700, 22543, 24756, 25417, 29038, 27457, 25223],
  "pct": [-14.509, -8.733, 9.817, 2.67, 14.246, -5.445, -8.136],
  "cls": [5, 4, 3, 3, 2, 4, 4],
  "lgr": [-0.1568, -0.0914, 0.0936, 0.0264, 0.1332, -0.0560, -0.0849],
  "lag": [1.331, 9.74, 0.097, 0.497, 3.706, 4.974, 1.903],
  "cat1020": 4,
  "rucc13": 6, "rucc23": 6, "metro": false, "rucc_note": null,
  "label": [-85.4, 31.87], "bbox": [-85.75, 31.62, -85.12, 32.15]
}
```

The `pop`, `pct`, `cls`, `lgr` and `seq` values are Barbour County's real values (2010 base from the workbook); RUCC, `label` and `bbox` are placeholders; `lag` is the neighbours' population-weighted % change per decade (section 4 step 5), null for the three counties without neighbours. `cls` is the change class (1–5, section 4 step 4) per decade, binned on unrounded percentages; the last entry equals `cat1020`. `pop` has one entry per year in `meta.years` (1950…2020); `pct`, `cls`, `lgr` and `seq` have one entry per decade. Keep arrays indexed by `meta.years` so post-2020 years can be appended without a schema change. Round `pct` and `lag` to 3 decimals and `lgr` to 4 decimals. The front end colours by `cls` and displays `pct` and `lag` truncated to 1 decimal (section 6.2); it never classifies from `pct`, because a 1-decimal value misplaces 99 county-decades (e.g. Sarpy NE 2010–20 rounds to 20.0 but is in the 10–19.9% class).

`meta.json` pathway entry: `{"id": 1, "name": "Emerging Localized Loss", "group": "loss", "n": 557, "color": "#6388b4", "blurb": "…"}`. `acs.json`: `{"indicators": [{"key": "age65", "label": "Aged 65+", "unit": "%"}…], "county": {"01005": {"age65": [19.6, 1.1]…}}, "pathway": {"1": {…}}, "us": {…}}`. `components.json`: `{"01005": {"natural": -381, "domestic": -2533, "international": 36, "net": -2497, "total": -2865, "driver": "both"}}` (`driver` only for loss counties; `total` is the estimates' total change including the residual, kept for downloads and not shown in the panel).

## 6. Interface and interactions

One screen: a full-height map on the left, a 380 px side panel on the right, a header across the top and a decade control under the map when the mode uses decades.

### 6.1 Layout (desktop, ≥ 1024 px wide)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Title                         [Change|In spatial context|Trajectories]│
│                          [ search county…      ] (◎ my location) (?)│
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │ Side panel           │
│                 MAP (Albers)                  │  • nothing selected: │
│                                               │    legend + filter   │
│                                   [reset view]│  • county selected:  │
│                                               │    county profile    │
├───────────────────────────────────────────────┤                      │
│  ▶  1950–60 ─●─ 1960–70 ─ … ─ 2010–20         │                      │
├───────────────────────────────────────────────┴──────────────────────┤
│ Footer: citation + DOI link · data sources · download all (CSV)      │
└──────────────────────────────────────────────────────────────────────┘
```

Title: **The Landscape of Loss: US County-Level Depopulation Pathways, 1950–2020**. No institutional logo.

### 6.2 Map modes (segmented control in the header)

Three tabs, in this order, in sentence case. Tab names only: "pathway" stays the word everywhere else (legend, blurbs, profile chip, Data notes). The URL `mode` values (6.9) keep their short ids. All three tabs fit on one line at 1024 px wide.

| Tab (URL `mode`) | Map colour | Decade control | Legend |
| --- | --- | --- | --- |
| Decadal population change (`change`, default at 2010–20) | Decadal % change, 5 classes | Shown | 5 classes with counts for that decade; at 2010–20 the pathway breakdown (6.6) follows below the legend |
| Decadal population change in spatial context (`context`) | A–D state for the chosen decade | Shown | The four states with counts for that decade, each as its arrow pair on its colour and its name (↓↓ Regional loss, ↓↑ Localized loss, ↑↓ Localized growth, ↑↑ Regional growth); hint “↑ grew, ↓ lost. First arrow: the county’s population change that decade. Second: its neighbors’ change (population-weighted average).” (arrows drawn inline as SVG, not characters) |
| Population change trajectories (`pathways`) | 8 pathways (Fig. 8) | Hidden | 8 pathways, grouped Loss / Growth, with county counts |

- The site opens in Decadal population change at 2010–20, which is the corrected Fig. 1.
- The two decade modes share one decade state; switching between them keeps the decade.
- The 5 change classes are the same for every decade (≥ 20, 10 to < 20, 0 to < 10, −10 to < 0, ≤ −10), so decades are comparable and 2010–20 matches the corrected Fig. 1.
- State boundaries draw on top of counties in every mode (`states` mesh, 0.9 px).
- Mode changes recolour in place with a 300 ms fill transition; no re-projection. Displayed percentages are truncated toward zero to 1 decimal (19.997 → 19.9), never rounded, so a shown value always matches its class.

### 6.3 Decade control

- Seven stops labelled "1950–60" … "2010–20". Default 2010–20.
- Play button steps forward one decade every 1.5 s and stops at 2010–20. Pause on any manual change.
- Keyboard: ← → step decades when the slider has focus.

### 6.4 Hover (desktop preview)

Hovering a county outlines it (cased: 1.5 px `#2E2420` over a 3.5 px `#FBFBFB` halo; section 7) and shows a tooltip after 80 ms. Rule: hover only previews; everything in the tooltip is also in the profile, reached by clicking.

- Line 1: "Barbour County, AL".
- Then two lines by mode. Exactly one colour swatch, matching the county's fill in the current mode (square for change classes and spatial context, round for pathways); every line starts with its time frame; values in IBM Plex Mono; the decade comes from the slider. No state name (regional loss etc.) in the tooltip.
  - Decadal population change: "■ 1990–2000: grew 9.0%", then "1950–2020 pathway: Constant Growth" (plain text, no dot).
  - Decadal population change in spatial context: "■ 1990–2000: grew 9.0%; neighboring counties together grew 7.7%", then the same pathway line. For the three counties without neighbors (25007, 25019, 53055): "■ 1980–90: grew 30.1%; it has no neighboring counties".
  - Population change trajectories: "● 1950–2020 pathway: Constant Growth", then "2010–20: lost 8.1%".
- Wording follows the profile sentences (6.5 block 4): "grew"/"lost" by sign, unsigned values truncated to 1 decimal, "less than 0.1%" for a value that truncates to zero, and the no-neighbor wording.
- Neighbors' change is truncated to 1 decimal like the county values (−0.66 shows as 0.6, not 0.7), with "grew"/"lost" from the A–D letter.
- The swatch takes the county's data colour even when a pathway filter grays the county out on the map.

To show the neighbour figure, add `lag` (7 values, percent, 3 decimals, from section 4 step 5) to the `counties.json` record.

### 6.5 County profile (side panel)

Clicking a county selects it: thick outline on the map, panel switches to its profile, URL updates. Esc or × closes the profile and returns to the legend.

The panel is grouped by time frame: the 70-year pathway first, then the decade-by-decade strip, then single decades, then the detail. Blocks 1–6 always show; 7–9 are collapsed by default and remember their open/closed state for the session. Block headings are the quoted text below, in sentence case. Example values are Newton County, MS (`28101`) with the map at 1980–90.

1. **Header.** "Newton County, MS"; under it "21,291 people (2020) · Nonmetro" (metro status from 2023 RUCC, 2013 fallback); `rucc_note` in small type when present (the 8 Connecticut counties). × closes.
2. **"70-year trajectory, 1950–2020".** The pathway colour dot and name, then the pathway's one-line `blurb` from `meta.json`. No "Loss pathway" or "Growth pathway" text.
3. **"Each decade: the county and its neighbors".** The sequence strip: seven cells in the A–D colours, each marked with an arrow pair (first the county, second its neighbors combined: A ↓↓, B ↓↑, C ↑↓, D ↑↑), two-digit decade labels under ("80–90", so seven fit in the panel; the explanation gives the full label). In the two decade modes the cell for the map's current decade is outlined. Hovering a cell explains it under the strip: "2000–10 · ↓↑ Localized loss", then the decade's sentence ("Barbour County lost 5.4% while its neighboring counties together grew 4.9%."); for the three counties without neighbors the name is followed by "(no neighboring counties; counted as neighbors grew)". Because hover only previews, focusing or clicking a cell pins the same explanation, and the matching key cell is outlined.
   Below the strip, a compact 2 × 2 key (a table): rows "County lost ↓" / "County grew ↑", columns "Neighbors lost ↓" / "Neighbors grew ↑"; each cell in its state colour with the arrows and name: ↓↓ Regional loss, ↓↑ Localized loss, ↑↓ Localized growth, ↑↑ Regional growth. Then one line, the same as the spatial-context legend hint (6.2): “↑ grew, ↓ lost. First arrow: the county’s population change that decade. Second: its neighbors’ change (population-weighted average).” (arrows drawn inline as SVG, not characters). Arrows are inline SVG, not text glyphs, so no fallback font is ever used for them. Text and arrows on each fill meet WCAG AA (4.5:1): light text on the navy (↑↑), dark text on the other three.
4. **"1980–90 (decade on the map)".** One sentence about the map's current decade: "Newton County grew 1.7% while its neighboring counties together lost 0.6%." "Grew" or "lost" comes from the sign (the county's change class; the neighbors' A–D letter), and both values are shown without a sign, truncated to 1 decimal (6.2): neighbors at −0.660 show as 0.6, not 0.7. A value that truncates to 0.0 reads "less than 0.1%" ("Milam County lost less than 0.1% while …"). For the three counties without neighbors (25007, 25019, 53055): "Dukes County grew 30.1%; it has no neighboring counties." Numbers in IBM Plex Mono.
5. **"Most recent decade, 2010–20".** The county's 2010–20 change as a sentence: "Newton County lost 1.9%." When the map decade is 2010–20, or the mode has no decade (Population change trajectories), blocks 4 and 5 merge into one block headed "Most recent decade, 2010–20 (decade on the map)" (or "Most recent decade, 2010–20" in trajectories mode) holding block 4's sentence for 2010–20.
6. **"Population, 1950–2020".** Line of the 8 counts (y = people from 0, formatted 25k) with, beneath it, seven signed bars for decadal % change around a zero line, coloured with the 5-class palette; years 1950…2020 along the bottom; note under: "Line: people. Bars: % change in each decade." A visually hidden table carries the counts and changes for screen readers. No headline: the 2020 count is in the header and the 2010–20 change in block 4 or 5.
7. **"Who lives here (ACS 2016–20)".** One row per indicator (14 rows from section 4 step 6). Each row: the indicator label across the top; below it the track, with a county dot and MOE whisker (none for the four 2020 Census race and ethnicity rows, which have no MOE), a tick for the pathway value and a tick for the conterminous U.S. value; and a right-hand column holding only the county value. Each row has its own axis from 0 to a rounded value above the largest of county value + MOE, pathway value and U.S. value; the axis labels sit on the axis itself, a small muted "0" at the left end of the track and the maximum (e.g. "40%") at the right end, aligned with the line, so the maximum never reads as a second statistic. A shared 0–100% axis would make rows under 15% unreadable. A single fixed readout line sits at the top of the block, under the key: "Point to or select a row to compare its values." until a row is hovered or focused (rows are focusable; clicking focuses), then "County 60.1% · Pathway 78.5% · Conterminous U.S. 58.0%" for that row, which is shaded. The hovered row wins over the focused one. The line has a fixed height and never wraps, so nothing overlaps and nothing shifts. Axis ends step by 5 below 50 and by 10 above, capped at 100. The pathway tick is in the pathway colour with a thin dark edge; the U.S. tick is muted grey; a key above the rows names all three marks ("County, with margin of error", the pathway name, "Conterminous U.S."). The U.S. values are pooled over the 3,108 conterminous counties, not the whole country (non-Hispanic white 58.0% vs. 57.8% nationally), so they are always labelled "Conterminous U.S." in the block and explained in Data notes (`meta.json` `notes.profile`). Each row's pathway and U.S. values are in visually hidden text. Note under: "Race and ethnicity from the 2020 Census; other indicators from the ACS 2016–20. Education is bachelor's degree or higher, which differs from Table 1 of the paper (bachelor's degree only). Each row has its own scale."
8. **"Why it changed, 2010–20".** Three horizontal bars about zero, in people: natural change, domestic migration, international migration. No net-migration or total bar: the estimates' total can contradict the census change shown in block 4 or 5. Line above the bars: "People, April 2010 to July 2020 (Census Bureau Vintage 2020 estimates)". All three bars are one neutral colour (`#7A6C68`, the muted interface token), not the change palette; the bar's direction shows the sign, and values are signed at right ("−1,043"). For loss counties, the Table 2 driver as a sentence, with the share of that driver among the 1,637 loss counties rounded to a whole percent: "Lost population through net out-migration only, like 35% of loss counties." / "… through both net out-migration and natural decrease, like 50% …" / "… through natural decrease only, like 13% …" / for "other" (net migration ≥ 0 and natural increase): "The census shows a loss, but the 2010–20 estimates show growth (as for 3% of losing counties)."
9. **"Similar counties"** (6.7).

The A–D colours appear in the panel only in the strip and its key (block 3); there is no standalone A–D swatch anywhere in the panel, and no letters A–D anywhere in the panel (cells, key, legend, labels). The letters remain internal codes in the data.

Footer of the panel: "Download this county (CSV)".

### 6.6 The 2010–20 breakdown

This block makes the paper's argument visible: one decade's binary story splits into eight histories. It is not a separate mode. It appears in Decadal population change mode only when the decade is 2010–20, as a block in the side panel below the legend (the map then shows the corrected Fig. 1 classes). It disappears when the slider moves to another decade or another tab is chosen.

- Two horizontal 100% bars, "Lost population 2010–20 (1,637)" split into the 4 loss pathways and "Gained (1,471)" split into the 4 growth pathways, segments in the pathway colours. Under each bar, its four pathways as rows (swatch, name, count), because the smallest segments (Emerging Growth, about 5% of its bar) cannot hold a label. Counts come from each county's `group`, which agrees with its 2010–20 change class in all 3,108 counties.
- Hovering a segment or a row highlights that pathway's counties on the map: every other county fades to 20% of its own colour (unlike the filter and legend isolation, which draw a neutral gray at 25%; a filtered-out county stays gray). Clicking pins the highlight; clicking the pinned pathway again, or Esc with no county open, unpins it. The rows are buttons (`aria-pressed`) and focusing one highlights it like hover, so the keyboard reaches everything; the bars are hidden from screen readers. Pointing at a pathway previews it over the pinned one.
- One sentence above the bars, as the block's heading: "The same 2010–20 loss can follow very different 70-year paths." Under it: "Point to a pathway to highlight its counties; select it to pin."
- Clicking a county still opens its profile, and the pin stays. While closing the profile would return to the breakdown (Decadal population change at 2010–20), the profile starts with a "← Back to breakdown" link that closes it. Moving the slider off 2010–20 or changing tab clears the pin.
- The pin round-trips in the URL as `hl` (pathway id), kept only in Decadal population change at 2010–20 (6.9).

### 6.7 Similar counties

Ranks the 5 counties whose decade-by-decade population change most closely matches the selected county.

- **Measure.** Euclidean distance between the 7-value `lgr` vectors (log growth rates). Unstandardised, so a decade with big swings counts more than a quiet one.
- **Pool.** Toggle "Same pathway" (default) / "Any pathway". Optional checkboxes: "Similar size" (2020 population between 0.5× and 2× the selected county, inclusive) and "Same metro status" (2023 RUCC, 2013 fallback). The settings persist across selections and round-trip in the URL as `sim` (6.9).
- **Result.** Exclude the selected county; sort ascending; break ties by GEOID; keep 5. If fewer than 5 qualify, show those and say so. With both checkboxes on, 47 counties have fewer than 5 matches (Los Angeles has none).
- **Controls.** "Same pathway" / "Any pathway" as a two-part segmented control (radio group, styled like the mode tabs), then the two checkboxes.
- **Display.** A key line: "Population indexed, 1950 = 100. — Gray: Barbour County." Then five compact rows in rank order (an ordered list), one per match, each a button: on the left a mini chart in a fixed 112 px column, so all five share the same x positions and one y-scale, with the match's indexed population line (1950 = 100, `--heading`) over the selected county's line in the muted colour, with a hairline at 100; on the right name and state ("Barton County, MO") over a pathway chip (dot and name). No visible rank numbers, in the list or on the map. Each button is named "Barton County, MO, Emerging Localized Loss pathway, open profile". Click opens that county's profile, which starts with a "← Back to Barbour County" link (it replaces "Back to breakdown"); following several matches keeps a trail, and any other selection (map, search, location, URL, browser Back) clears it. Following a match or the back link does not move the map (6.9).
- **Fewer than 5.** "Only 3 counties match these settings." under the list; with none, "No counties match these settings. Try Any pathway or clear a checkbox." in place of the list.
- **Map.** While block 9 is open, every match shows its thin solid cased outline (section 7) and an unfilled locator ring at its `label` point, 12 px across at every zoom (1.5 px `#2E2420` line over a 4 px `#FBFBFB` halo), drawn above the fills; the selected county keeps its heavier 2 px outline and stays the most prominent mark. Hovering or focusing a match row makes that match active: its ring grows to 20 px with a 2 px line (over a 5 px halo) and draws on top, the other rings fade to 40% opacity, and its county also gets the selected-style cased outline (2 px over 4 px). Hovering a matched county on the map makes it active the same way (its ring and the faded others) and marks its row with a muted border. Rings and outlines take no pointer events. Collapsing the block or closing the profile removes all of these, so the map never marks counties the panel is not showing. (Dashed rings, then numbered badges with a collision pass, were tried and dropped: rings broke up on small and irregular counties and outweighed the selected county; badges added clutter.)
- **Framing.** Opening block 9, and changing its settings (pool or checkboxes), frames the selected county and all its matches: the same fit as "Show all on map", to about 80% of the map, scale 1–12. Following a match to its profile does not reframe, and hover never moves the map. A "Show all on map" button under the list repeats the fit. It shows only while the selected county or any match is not wholly inside the current view (its bounding box checked against the map once a zoom or pan has settled, so it never flickers mid-gesture), and hides again once everything is in view. With no matches nothing moves and there is no button.
- **Explanation** under the list: "Ranked by how closely population change matched, decade by decade, 1950–2020. Not part of the paper's analysis."
- Computed in the browser at selection time (3,108 × 7 values; under 5 ms). No precomputed matrix.

### 6.8 Search, location, filter

- **Search.** Autocomplete over "County name, ST", accent- and case-insensitive ("dona ana" finds Doña Ana County, NM), top 8 matches, ↑↓ Enter. Every query word must start a word of "County name, ST" ("newton ms"); matches on the first word rank first, then larger counties. Esc closes the list; Esc in an empty box closes the profile. Selecting frames the county in its region (6.9) and opens its profile.
- **Use my location.** Browser geolocation (a fresh position each click); find the county with `d3.geoContains`, checking `bbox` first; select it and frame it in its region (6.9). Outside the conterminous U.S. → "Your location is outside the counties in this study." Denied → "Location access was denied, so your county could not be found. Check that location access is allowed for this site in your browser and in your computer’s privacy settings." Messages show on their own line under the header controls (a `role="status"` region), never over the panel, with a × to dismiss; they also clear after 8 s or on the next click or key press (Tab and modifier keys excepted, so the × stays reachable). The location is never stored or sent anywhere.
- **Pathway filter.** Legend items in Population change trajectories mode are toggles (multi-select). The filter persists across modes: non-selected counties draw in a neutral grey at 25% opacity. "Clear filter" link when active.

### 6.9 Zoom, URL state, explainer, downloads

- **Zoom.** `d3-zoom`, scale 1–12, wheel and drag, double-click to zoom in, "Reset view" button. `clickDistance` is 4 px, so a click that drifts slightly still selects. Map outlines (hover, selection, states) take no pointer events, so a press never lands on an element the zoom gesture removes. **Zoom on select.** Map clicks never move the map, and neither do following a similar county, its back link, or browser Back/Forward. Search, use my location and a page load with `county` in the URL frame the county in its regional context: centred, with its bounding box (longer side) spanning about 1/20 of the map width, between 1× and at most 4×. If the view is already closer than that, they keep its zoom and only pan to centre the county; they never zoom out. Opening similar counties (6.7), changing its settings, and its "Show all on map" button instead fit the selected county and all its matches. Code: `web/src/lib/zoom.ts`.
- **URL state.** `?mode=context&decade=1990&county=01005&path=3,4&sim=any,size` — every state above round-trips, so views can be shared and cited. `decade` is the decade's start year. Default values are left out, so the default view has no query string. Opening or closing a county adds a history entry (Back returns to the previous county or the legend); other changes replace the current entry. `mode` is `change` (default), `context` or `pathways`. `hl` is the pathway pinned in the 2010–20 breakdown (6.6), e.g. `?hl=3`; it is written and read only in Decadal population change at 2010–20. `sim` holds the similar-counties settings (6.7) as comma-separated tokens in this order: `any` (Any pathway), `size` (Similar size), `metro` (Same metro status); the default (Same pathway, no checkboxes) is left out. The retired `mode=recent` (the former "2010–20 vs. 70 years" tab) redirects to `mode=change&decade=2010`, keeping any other parameters.
- **Explainer ("?" button, About modal).** Tabs: *How to read this* (A–D diagram redrawn from the paper's Figs. 2 and 4: a county and its neighbors in four quadrants; the eight pathways with one-line blurbs); *About* (full citation with DOI link, authors, data sources and credits); *Data notes* (2010 base, change classes, neighbor rule, Connecticut RUCC, sources and definitions of the profile indicators, the "Conterminous U.S." comparison (the 3,108 study counties, not the whole country), validation summary). A first-visit intro card links to it; dismissal stored in `localStorage` inside try/catch.
- **Downloads.** Client-side CSV: the selected county; the counties in the current filter; all counties. Columns: `geoid, county, state, pathway, seq, pop1950…pop2020, pct1950_60…pct2010_20, rucc2013, rucc2023`. Include a header comment line with the citation.

**Draft pathway blurbs** (author to edit; meta.json `blurb`):

| # | Pathway | n | Blurb |
| --- | --- | --- | --- |
| 1 | Emerging Localized Loss | 557 | Decades of shared regional growth, turning to local loss by 2010–20, often at the edge of growing regions. |
| 2 | Isolated Loss | 126 | Losing population while neighboring counties grow: islands of loss inside growing regions. |
| 3 | Persistent Loss | 442 | Loss shared with neighbors in most decades since 1950; concentrated in the Great Plains and central Appalachia. |
| 4 | Punctuated Regionalized Loss | 512 | Alternating growth and loss, with loss shared across the region since 2010. |
| 5 | Constant Growth | 949 | County and neighbors growing in nearly every decade. |
| 6 | Localized Recovery and Regional Growth | 141 | Growing regions where the county lost population for a time, then recovered after 1990. |
| 7 | Punctuated Growth | 312 | Cycles of growth and loss, ending in recent growth. |
| 8 | Emerging Growth | 69 | Long-run loss turning to growth in the latest decades. |

## 7. Visual design

Pathway and A–D colours come from the paper's data dictionary, unchanged; the change classes use a new diverging palette; everything else (background, type, controls) follows the author's Northumberland v1.0 system. Light theme only in v1.

**Data palettes** (exact hexes; put them in `meta.json`, never hard-code in components)

| Palette | Class | Hex |
| --- | --- | --- |
| Pathways | 1 Emerging Localized Loss | `#6388b4` |
| Pathways | 2 Isolated Loss | `#ffae34` |
| Pathways | 3 Persistent Loss | `#ef6f6a` |
| Pathways | 4 Punctuated Regionalized Loss | `#00a86b` |
| Pathways | 5 Constant Growth | `#8cc2ca` |
| Pathways | 6 Localized Recovery and Regional Growth | `#e5e522` |
| Pathways | 7 Punctuated Growth | `#bb7693` |
| Pathways | 8 Emerging Growth | `#8cd17d` |
| A–D | A ↓↓ Regional loss (county lost, neighbors combined lost) | `#f7786b` |
| A–D | B ↓↑ Localized loss (county lost, neighbors combined grew) | `#f7cac9` |
| A–D | C ↑↓ Localized growth (county grew, neighbors combined lost) | `#92a8d1` |
| A–D | D ↑↑ Regional growth (county grew, neighbors combined grew) | `#214471` |
| Change | Growth 20% or more | `#2887a1` |
| Change | +10% to 19.9% | `#79a7ac` |
| Change | 0% to 9.9% | `#b5c8b8` |
| Change | −0.1% to −9.9% | `#d6bd8d` |
| Change | Decline 10% or more | `#a16928` |

The change palette replaces the published Fig. 1 colours in Decadal population change mode, at every decade including 2010–20. It is CARTOColors Earth, a diverging scheme: blue for growth and brown for loss, through a pale grey-green (0% to 9.9%) and a pale tan (−0.1% to −9.9%) either side of zero. State in Data notes that these colours differ from the published Figure 1, and credit the palette: "Change palette: CARTOColors Earth, CARTO, CC BY 4.0."

**Colour-vision check (run 26 Oct 2026, CIEDE2000, 100% severity).** A–D stays distinct for all three deficiency types (closest pair ΔE 20). Three pathway pairs fall below ΔE 10: Isolated Loss / Localized Recovery (8.8, deuteranomaly), Persistent Loss / Punctuated Regionalized Loss (9.4–9.5, deutan and protan), Constant Growth / Emerging Growth (5.6, tritanomaly). Mitigations in v1: the pathway filter, legend-hover isolation, and names in tooltips. Do not change the palette without the author's approval.

**Change palette re-check (27 Oct 2026, CARTOColors Earth).** Run with R `colorspace` simulation (Machado 2009, severity 1) and `farver` CIEDE2000. This method does not exactly reproduce the 26 Oct figures (it gives A–D 18.3, not 20), so compare palettes only within one method. Closest pair: ΔE 14.4 with normal vision; 13.5 deutan (0% to 9.9% vs. −0.1% to −9.9%); 11.6 protan (the same near-zero pair); 11.6 tritan (≥ 20% vs. +10% to 19.9%). The previous change palette scored 10.7 by the same method, so Earth is at least as distinct. Its weakest pair under protanopia is the two classes either side of zero.

**Interface (Northumberland v1.0)**

- Background `#FBFBFB`; text `#1A1210`; headings `#2E2420`; muted text and axes `#7A6C68`; hairlines `#7A6C68` at 30%.
- Interface accents only, never on the map: forest `#4A7840` for active controls and focus rings.
- Map outlines are cased: a `#FBFBFB` halo underneath and a `#2E2420` line on top, both non-scaling (`vector-effect: non-scaling-stroke`), so they read on light and dark fills alike. Selected county: 2 px line over a 4 px halo. Hover: 1.5 px line over a 3.5 px halo. Similar counties (6.7): a thinner solid casing, 1.25 px line over a 3 px halo; each match also has a 12 px unfilled locator ring (1.5 px line over a 4 px halo) at its label point; the active match's ring grows to 20 px with a 2 px line, the others fade to 40%, and a row-hovered match gets the selected casing. No coloured outlines, to avoid clashing with data fills.
- Map: no fill outside the U.S.; county borders `#FBFBFB` at 0.3 px (drop below zoom 1.5 if they clutter); state borders `#FBFBFB` at 0.9 px over fills.

**Spelling.** US spelling in all visible text, labels, blurbs and Data notes (neighbor, color, gray). The four A–D names above ("Regional loss", "Localized loss", "Localized growth", "Regional growth"), with their arrows, are the exact display text in the spatial-context legend and the profile strip and key (`meta.json` `ad[].label` and `ad[].arrows`); the letters are never displayed. (This spec and code comments may use either spelling.)

**Typography.** Never Arial, including as a fallback.

- Display (title, headings): `Futura, "Jost", sans-serif`, Jost weight 800.
- Body and UI: `"Jost", "Helvetica Neue", Helvetica, sans-serif`, weight 400.
- Numbers in tables and tooltips: `"IBM Plex Mono"`, tabular figures.
- Citation and long-form text in the About modal: `Palatino, "Palatino Linotype", "Book Antiqua", serif`.
- Self-host Jost and IBM Plex Mono as woff2 via the `@fontsource` packages (section 2), bundled by Vite with `font-display: swap`, so a missing web font never falls back to the system sans (Arial on Windows).
- Sizes: title 22 px, panel headings 15 px, body 14 px, tooltip and axis labels 12 px minimum.

**Accessibility**

- Text contrast WCAG AA (4.5:1) against `#FBFBFB`.
- Every control reachable by keyboard; visible focus rings; Esc closes panels and modals.
- An `aria-live` region announces the selected county and its pathway.
- The map canvas has `role="img"` with a label naming the current mode and decade; search is the non-visual route to every county.

## 8. Build, delivery and acceptance

Build in five milestones; stop for author review after milestones 1, 3 and 5.

### 8.1 Performance budgets

- First meaningful map under 2.5 s on a 2020 laptop over a typical home connection.
- Startup data under 2 MB gzipped; JavaScript bundle under 150 kB gzipped.
- Mode or decade change repaints in under 50 ms; playback holds 30 fps or better.
- Hover hit-testing by a hidden picking canvas (one colour per county), not by path search. The pick pixel is only a hint: border pixels are anti-aliased blends that decode to an unrelated county, so the candidates in a 5 × 5 pixel window are confirmed with `isPointInPath`, nearest first. Hit-testing never relies on hover state, which a press clears.

### 8.2 Mobile readiness rules (desktop-first, built so mobile can follow)

- Hover only previews; tapping does everything hover does plus more.
- The side panel is one component that can render as a right panel (≥ 1024 px) or a bottom sheet (< 768 px).
- Layout in CSS grid with named areas; no fixed pixel positions for panels.
- Touch targets at least 40 × 40 px for controls.
- v1 acceptance below 768 px: map, search, profile sections 1–3 work. Polish is a later release.

### 8.3 Deployment

- GitHub Actions on push to `main`: install, run Vitest, build `web/`, deploy to GitHub Pages. The pipeline does not run in CI; its committed outputs do.
- Set Vite `base` to `/landscape-of-loss/` (the repository name). A rough deploy at the end of milestone 2 is welcome, to surface deployment problems early.
- Add a `README.md` (purpose, citation, how to run the pipeline and the site) and a `CITATION.cff` pointing to the Annals article.

### 8.4 Milestones

1. **Pipeline and validation.** Steps 1–10 of section 4; `docs/validation.md` showing 0 A–D mismatches and the Table 1 and Table 2 comparisons.
2. **Map core.** Projection, canvas fills, state mesh, zoom, three modes, decade control, legend, hover.
3. **County profile.** Blocks 1–8 of 6.5, search, location, URL state.
4. **Similar counties and the 2010–20 breakdown.** Sections 6.6 and 6.7.
5. **Explainer, downloads, accessibility, polish.** Section 6.9, section 7 checks, deploy.

### 8.5 Acceptance criteria

- [ ] Pipeline rebuilds A–D with 0 mismatches out of 21,756 cells
- [ ] Exactly 3,108 counties, each with pathway, sequence, 8 population counts and RUCC (or a note)
- [ ] Pathway counts on screen match the paper: 557, 126, 442, 512, 949, 141, 312, 69
- [ ] The 2010–20 breakdown (Decadal population change at 2010–20) shows 1,637 losing and 1,471 gaining counties
- [ ] Milam TX and Buena Vista VA show as 2010–20 losers; Sarpy NE shows as 10–19.9%
- [ ] Table 1 and Table 2 comparisons written to `docs/validation.md`, gaps explained
- [ ] Similar counties returns 5 results (or a note) in under 5 ms; same-pathway default respected
- [ ] Every URL state round-trips
- [ ] No Arial in computed styles anywhere (check in Playwright)
- [ ] Keyboard-only path: search → select → read profile → close
- [ ] Lighthouse accessibility score 95 or higher; performance budgets in 8.1 met

### 8.6 Open items for the author

- Edit the eight pathway blurbs (6.9). (Title confirmed 27 Oct 2026; section 6.1.)
- Decide on the three low-contrast pathway pairs (section 7) after seeing the built map.
- Schroeder (2016) data cleared for use (26 Oct 2026); credit line in section 3.
- Create the GitHub repository `landscape-of-loss` (section 8.3).
