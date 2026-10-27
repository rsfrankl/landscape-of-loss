# Landscape of Loss data pipeline (spec §4). Run from the repo root with `make data`.
#
# Gate: every target that writes to web/public/data/ or docs/ takes `ad_check` as an argument,
# so nothing is written unless the A-D rebuild matches the author's sequences in all 21,756 cells.

library(targets)
tar_source("R")
tar_option_set(error = "stop")

WEB_DATA <- "../web/public/data"
VALIDATION_MD <- "../docs/validation.md"

list(
  # Inputs ---------------------------------------------------------------------
  tar_target(gpkg_file, "raw/depopulation_data.gpkg", format = "file"),
  tar_target(workbook_file, "raw/County population 1790 to 2010.xlsx", format = "file"),
  tar_target(seq_loss_file, "raw/sequence_loss.csv", format = "file"),
  tar_target(seq_growth_file, "raw/sequence_growth.csv", format = "file"),
  tar_target(typology_file, "raw/us_seq_typologies.xlsx", format = "file"),
  tar_target(dict_file, "raw/data_dict.docx", format = "file"),
  tar_target(table1_file, "checks/paper_table1.csv", format = "file"),
  tar_target(table2_file, "checks/paper_table2.csv", format = "file"),
  tar_target(vintage_files, fetch_download("vintage2020"), format = "file"),
  tar_target(rucc13_files, fetch_download("rucc2013"), format = "file"),
  tar_target(rucc23_files, fetch_download("rucc2023"), format = "file"),
  tar_target(raw_hashes, file_hashes(c(gpkg_file, workbook_file, seq_loss_file, seq_growth_file,
                                       typology_file, dict_file, table1_file, table2_file))),
  tar_target(provenance, lapply(list(vintage_files, rucc13_files, rucc23_files), read_provenance)),

  # Step 1: identifiers ---------------------------------------------------------
  tar_target(county_attrs, read_county_attrs(gpkg_file)),
  tar_target(universe, sort(pad_fips(county_attrs$GEOID))),
  tar_target(county_info, county_names(county_attrs, universe)),
  tar_target(typology, read_typology(typology_file, universe)),
  tar_target(sequences, read_sequences(seq_loss_file, seq_growth_file)),

  # Steps 3-4: population and change --------------------------------------------
  tar_target(gpkg_pop, read_gpkg_pop(gpkg_file)),
  tar_target(workbook, read_workbook(workbook_file)),
  tar_target(pop, build_population(workbook, gpkg_pop, universe)),
  tar_target(base2010, compare_2010_bases(gpkg_pop, pop)),
  tar_target(pct, pct_change(pop)),
  tar_target(lgr, log_growth(pop)),
  tar_target(cat_counts, assert_cat1020_counts(bin_change(pct[, ncol(pct)]))),
  tar_target(cat2, compare_cat2(gpkg_pop, bin_change(pct[, ncol(pct)]), universe)),

  # Step 5: A-D rebuild and the gate --------------------------------------------
  tar_target(neighbours, queen_neighbours(read_county_geometry(gpkg_file, universe))),
  tar_target(lag, neighbour_lag(pop, neighbours)),
  tar_target(ad_rebuilt, ad_codes(pct, lag)),
  tar_target(ad_check, check_ad(ad_rebuilt, sequences, "out/ad_mismatches.csv")),

  # Step 2: geometry -------------------------------------------------------------
  tar_target(lonlat, export_lonlat(read_county_geometry(gpkg_file, universe), county_info,
                                   "out/shp/counties_4326.shp")),
  tar_target(topo, {
    t <- build_topojson(lonlat$shp, "out/counties.topo.json")
    assert_topojson(t, universe)
    t
  }),

  # Steps 8-9: components and urban-rural ---------------------------------------
  tar_target(components, read_vintage2020(vintage_files[1], universe)),
  tar_target(table2, check_table2(components, typology$pathway, read_paper_table2(table2_file))),
  tar_target(table2_edges, driver_edge_cases(components, typology$pathway)),
  tar_target(rucc, build_rucc(rucc13_files[1], rucc23_files[1], county_info, universe)),

  # Steps 6-7: profile indicators (2020 Census race, ACS 2016-20 rest) and Table 1 ---
  tar_target(paper_table1, read_paper_table1(table1_file)),
  tar_target(acs_raw, fetch_acs(universe)),
  tar_target(decennial_race, fetch_decennial_race(universe)),
  tar_target(acs_parts, acs_components(acs_raw, decennial_race)),
  tar_target(table1, compare_table1(acs_parts, typology$pathway, paper_table1)),
  tar_target(education_alt, education_bachelor_only(acs_raw, typology$pathway, paper_table1)),
  tar_target(table1_context, compare_table1_context(typology$pathway, pop[, "2020"], rucc, paper_table1)),

  # County table and palette check ----------------------------------------------
  tar_target(counties, {
    x <- build_counties(county_info, typology, sequences, pop, pct, lgr, lag, rucc, lonlat$bbox)
    assert_counties(x)
    x
  }),
  tar_target(palette_check, check_dict_palettes(dict_file)),

  # Step 10: outputs (all gated on ad_check) ------------------------------------
  tar_target(web_topo, write_web_topo(topo, ad_check, WEB_DATA), format = "file"),
  tar_target(web_counties, write_web_json(counties_json(counties), "counties.json", ad_check, WEB_DATA),
             format = "file"),
  tar_target(web_meta, write_web_json(build_meta(counties, palette_check, base2010$n_diff), "meta.json",
                                      ad_check, WEB_DATA, pretty = TRUE),
             format = "file"),
  tar_target(web_acs, write_web_json(acs_payload(acs_parts, table1, universe), "acs.json",
                                     ad_check, WEB_DATA),
             format = "file"),
  tar_target(web_components, write_web_json(components_json(components, counties, table2), "components.json",
                                            ad_check, WEB_DATA),
             format = "file"),
  tar_target(validation_md, render_validation(
    VALIDATION_MD, ad_check, raw_hashes, provenance, base2010, cat_counts, cat2, topo, table1,
    table1_context, education_alt, table2, table2_edges, rucc,
    c(web_topo, web_meta, web_counties, web_acs, web_components)),
    format = "file")
)
