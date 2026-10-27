# Front-end data files in web/public/data/ (spec §5) and the palette cross-check (spec §7).
# Every writer takes `ad_check` and refuses to run unless the A-D rebuild matched exactly.

PATHWAYS <- data.frame(
  id = 1:8,
  name = c("Emerging Localized Loss", "Isolated Loss", "Persistent Loss",
           "Punctuated Regionalized Loss", "Constant Growth",
           "Localized Recovery and Regional Growth", "Punctuated Growth", "Emerging Growth"),
  group = rep(c("loss", "growth"), each = 4),
  color = c("#6388b4", "#ffae34", "#ef6f6a", "#00a86b", "#8cc2ca", "#e5e522", "#bb7693", "#8cd17d"),
  blurb = c(
    "Decades of shared regional growth, turning to local loss by 2010\u201320, often at the edge of growing regions.",
    "Losing population while neighboring counties grow: islands of loss inside growing regions.",
    "Loss shared with neighbors in most decades since 1950; concentrated in the Great Plains and central Appalachia.",
    "Alternating growth and loss, with loss shared across the region since 2010.",
    "County and neighbors growing in nearly every decade.",
    "Growing regions where the county lost population for a time, then recovered after 1990.",
    "Cycles of growth and loss, ending in recent growth.",
    "Long-run loss turning to growth in the latest decades."),
  stringsAsFactors = FALSE)

EXPECTED_PATHWAY_N <- c(557L, 126L, 442L, 512L, 949L, 141L, 312L, 69L)

AD_STATES <- data.frame(
  code = c("A", "B", "C", "D"),
  label = c("Self population loss, average neighbor population loss",
            "Self population loss, average neighbor population growth",
            "Self population growth, average neighbor population loss",
            "Self population growth, average neighbor population growth"),
  color = c("#f7786b", "#f7cac9", "#92a8d1", "#214471"),
  stringsAsFactors = FALSE)

# Bounds are percent change; `includeMin`/`includeMax` make the exact breaks explicit
# (-10 itself falls in class 5).
CHANGE_CLASSES <- list(
  list(id = 1, label = "Growth 20% or more", min = 20, max = NA, includeMin = TRUE, includeMax = FALSE, color = "#2887a1"),
  list(id = 2, label = "+10% to 19.9%", min = 10, max = 20, includeMin = TRUE, includeMax = FALSE, color = "#79a7ac"),
  list(id = 3, label = "0% to 9.9%", min = 0, max = 10, includeMin = TRUE, includeMax = FALSE, color = "#b5c8b8"),
  list(id = 4, label = "\u22120.1% to \u22129.9%", min = -10, max = 0, includeMin = FALSE, includeMax = FALSE, color = "#d6bd8d"),
  list(id = 5, label = "Decline 10% or more", min = NA, max = -10, includeMin = FALSE, includeMax = TRUE, color = "#a16928"))

CITATION <- list(
  authors = c("Park, G.", "Seymour, E.", "Franklin, R."),
  year = 2026,
  title = "Characterizing the Landscape of Loss: A Spatiotemporal Contextual Approach to Measuring U.S. County-Level Depopulation",
  journal = "Annals of the American Association of Geographers",
  doi = "10.1080/24694452.2026.2691208",
  url = "https://doi.org/10.1080/24694452.2026.2691208",
  text = paste0("Park, G., Seymour, E., and Franklin, R. (2026). Characterizing the Landscape of Loss: ",
                "A Spatiotemporal Contextual Approach to Measuring U.S. County-Level Depopulation. ",
                "Annals of the American Association of Geographers. doi:10.1080/24694452.2026.2691208"))

read_typology <- function(path, universe) {
  t <- readxl::read_excel(path)
  t <- data.frame(geoid = pad_fips(t$GEO_FIPS), name = t$cluster,
                  pathway = as.integer(sub("^Cluster ", "", t$cluster2)))
  t <- restrict_one_to_one(t, universe, "us_seq_typologies")
  stopifnot(!anyNA(t$pathway))
  named <- unique(t[c("pathway", "name")])
  if (nrow(named) != 8 || !all(PATHWAYS$name[named$pathway] == named$name)) {
    stop("pathway names in us_seq_typologies.xlsx do not match the spec")
  }
  t
}

# Pathway and A-D hexes must match the author's data dictionary. The change palette is new
# by design (spec §7) and is not checked against Figure 1.
check_dict_palettes <- function(docx) {
  xml <- paste(readLines(unz(docx, "word/document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  text <- gsub("<[^>]+>", "", gsub("</w:p>", "\n", xml, fixed = TRUE))
  lines <- trimws(strsplit(text, "\n", fixed = TRUE)[[1]])
  pairs <- regmatches(lines, regexec("^(.+?)\\s*=\\s*\"?(#[0-9A-Fa-f]{6})", lines))
  pairs <- do.call(rbind, lapply(Filter(length, pairs), function(m) data.frame(key = trimws(m[2]), hex = tolower(m[3]))))
  pw <- pairs$hex[match(PATHWAYS$name, pairs$key)]
  ad <- vapply(AD_STATES$code, function(code) {
    hit <- pairs$hex[grepl(paste0("^", code, " \\("), pairs$key)]
    if (length(hit) == 1) hit else NA_character_
  }, "")
  bad <- c(PATHWAYS$name[is.na(pw) | pw != PATHWAYS$color], AD_STATES$code[is.na(ad) | ad != AD_STATES$color])
  if (length(bad)) stop("palette differs from data_dict.docx for: ", paste(bad, collapse = ", "))
  list(pathways = nrow(PATHWAYS), ad = nrow(AD_STATES))
}

round_bbox <- function(b) c(floor(b$xmin * 1e3), floor(b$ymin * 1e3), ceiling(b$xmax * 1e3), ceiling(b$ymax * 1e3)) / 1e3

# One row per county with everything counties.json needs; list columns hold the arrays.
build_counties <- function(info, typology, sequences, pop, pct, lgr, lag, rucc, bbox) {
  u <- info$geoid
  stopifnot(identical(u, rownames(pop)), identical(u, typology$geoid), identical(u, rucc$geoid),
            identical(u, bbox$geoid))
  s <- sequences[match(u, sequences$geoid), ]
  rows <- function(m, digits) lapply(seq_len(nrow(m)), function(i) round(unname(m[i, ]), digits))
  data.frame(
    geoid = u, name = info$name, state = info$state, stusps = info$stusps,
    pathway = typology$pathway, group = ifelse(typology$pathway <= 4, "loss", "growth"),
    seq_group = s$group, seq = s$seq,
    # pct keeps 3 decimals so the front end can truncate to 1 without crossing a break;
    # cls is the change class per decade, binned on the unrounded values.
    pop = I(rows(pop, 0)), pct = I(rows(pct, 3)), cls = I(rows(bin_change(pct), 0)),
    lgr = I(rows(lgr, 4)),
    lag = I(lapply(seq_along(u), function(i) if (all(is.na(lag[i, ]))) NA else round(unname(lag[i, ]), 1))),
    pct1020 = pct[, ncol(pct)], cat1020 = bin_change(pct[, ncol(pct)]),
    rucc13 = rucc$rucc13, rucc23 = rucc$rucc23, metro = rucc$metro, rucc_note = rucc$rucc_note,
    label = I(lapply(seq_along(u), function(i) round(c(info$label_lon[i], info$label_lat[i]), 4))),
    bbox = I(lapply(seq_along(u), function(i) round_bbox(bbox[i, ]))),
    stringsAsFactors = FALSE)
}

# Acceptance checks on the assembled table (spec §4 step 5, §8.5).
assert_counties <- function(counties) {
  fail <- function(...) stop("county table: ", ...)
  if (nrow(counties) != 3108) fail("expected 3,108 counties, got ", nrow(counties))
  n <- tabulate(counties$pathway, nbins = 8)
  if (!identical(n, EXPECTED_PATHWAY_N)) fail("pathway counts ", paste(n, collapse = "/"))
  if (any(counties$group != counties$seq_group)) fail("pathway group disagrees with the sequence file")
  loser <- counties$pct1020 < 0
  if (any(loser != (counties$seq_group == "loss"))) fail("sequence-file membership != 2010-20 sign")
  if (sum(loser) != 1637 || sum(!loser) != 1471) fail("expected 1,637 losing / 1,471 gaining")
  by_id <- function(g) counties[counties$geoid == g, ]
  if (!all(by_id("48331")$pct1020 < 0, by_id("51530")$pct1020 < 0)) fail("Milam TX / Buena Vista VA must lose")
  if (by_id("31153")$cat1020 != 2) fail("Sarpy NE must be in the 10-19.9% class")
  cls_ok <- vapply(counties$cls, function(x) length(x) == 7 && all(x %in% 1:5), TRUE)
  if (!all(cls_ok)) fail("cls must hold 7 classes in 1-5 for every county")
  if (any(vapply(counties$cls, `[`, 0, 7) != counties$cat1020)) fail("2010-20 cls disagrees with cat1020")
  no_nb <- vapply(counties$lag, function(x) length(x) == 1 && is.na(x), TRUE)
  if (!setequal(counties$geoid[no_nb], NO_NEIGHBOUR_GEOIDS)) fail("unexpected counties without neighbours")
  if (anyNA(counties$rucc13) || any(is.na(counties$rucc23) & is.na(counties$rucc_note))) fail("RUCC gaps without a note")
  invisible(TRUE)
}

counties_json <- function(counties) {
  keep <- c("geoid", "name", "state", "stusps", "pathway", "group", "seq", "pop", "pct", "cls", "lgr",
            "lag", "cat1020", "rucc13", "rucc23", "metro", "rucc_note", "label", "bbox")
  lapply(seq_len(nrow(counties)), function(i) {
    lapply(setNames(keep, keep), function(k) {
      x <- counties[[k]][i]
      if (is.list(x)) x[[1]] else x
    })
  })
}

build_meta <- function(counties, palette_check, pop_base_diff) {
  stopifnot(palette_check$pathways == 8)
  n <- tabulate(counties$pathway, nbins = 8)
  list(
    years = YEARS,
    decades = lapply(seq_along(DECADE_LABELS), function(i) {
      list(start = YEARS[i], end = YEARS[i + 1], label = DECADE_LABELS[i])
    }),
    pathways = lapply(seq_len(nrow(PATHWAYS)), function(i) {
      c(as.list(PATHWAYS[i, c("id", "name", "group")]), n = n[i],
        as.list(PATHWAYS[i, c("color", "blurb")]))
    }),
    ad = lapply(seq_len(nrow(AD_STATES)), function(i) as.list(AD_STATES[i, ])),
    change = CHANGE_CLASSES,
    citation = CITATION,
    notes = list(
      geography = paste(
        "3,108 conterminous U.S. counties in 2020 boundaries. Shannon County, SD (46113) is recoded",
        "to Oglala Lakota County (46102), and Bedford city, VA (51515) is counted in Bedford County (51019)."),
      base2010 = paste0(
        "The 2010 count is the Schroeder (2016) workbook value used by the paper's sequences. ",
        "It differs slightly from the GeoPackage's 2010 field in ", format(pop_base_diff, big.mark = ","),
        " counties; the workbook value is used everywhere."),
      changeClasses = paste(
        "Decadal change uses five classes with exact breaks: 20% or more; 10% to under 20%;",
        "0% to under 10%; under 0% to above \u221210%; \u221210% or less. These colors differ from the",
        "published Figure 1, whose breaks at ±9.9% and 19.9% misplace some counties.",
        "Change palette: CARTOColors Earth, CARTO, CC BY 4.0."),
      neighbors = paste(
        "Neighbors are queen-contiguous counties. Neighbor change is population-weighted: the sum of",
        "neighbors' change over the sum of their starting populations. Dukes and Nantucket, MA, and",
        "San Juan, WA, have no neighbors and count as neighbor growth."),
      rucc = CT_RUCC_NOTE,
      profile = paste(
        "Race and ethnicity are from the 2020 Census (PL 94-171, table P2); the other profile indicators",
        "are ACS 2016–20 5-year estimates. Language is the share of people aged 5+ who speak a language",
        "other than English at home. Education is bachelor's degree or higher (age 25+), which differs",
        "from Table 1 of the paper (bachelor's degree only)."),
      components = paste(
        "Components of change, April 2010 to July 2020, are from the Census Bureau's Vintage 2020",
        "estimates. Loss counties are grouped by sign, as in Table 2 of the paper, with natural change",
        "of zero counted as natural decrease.")),
    validation = list(adCells = 21756L, adMismatches = 0L))
}

write_json_file <- function(x, path, pretty = FALSE) {
  dir.create(dirname(path), showWarnings = FALSE, recursive = TRUE)
  jsonlite::write_json(x, path, auto_unbox = TRUE, na = "null", null = "null", digits = NA,
                       pretty = pretty)
  path
}

require_ad_pass <- function(ad_check) {
  if (!identical(ad_check$mismatches, 0L)) stop("A-D check has not passed; refusing to write outputs")
}

write_web_json <- function(x, file, ad_check, dir, pretty = FALSE) {
  require_ad_pass(ad_check)
  write_json_file(x, file.path(dir, file), pretty = pretty)
}

write_web_topo <- function(topo, ad_check, dir) {
  require_ad_pass(ad_check)
  dir.create(dir, showWarnings = FALSE, recursive = TRUE)
  dest <- file.path(dir, "counties.topo.json")
  if (!file.copy(topo$path, dest, overwrite = TRUE)) stop("could not copy TopoJSON to ", dest)
  dest
}

# Drivers are only written once the Table 2 check has passed.
components_json <- function(comp, counties, table2) {
  stopifnot(identical(comp$geoid, counties$geoid), identical(table2$mismatches, 0L))
  driver <- driver_by_sign(comp$net, comp$natural)
  out <- lapply(seq_len(nrow(comp)), function(i) {
    r <- list(natural = comp$natural[i], domestic = comp$domestic[i],
              international = comp$international[i], net = comp$net[i], total = comp$total[i])
    if (counties$group[i] == "loss") r$driver <- driver[i]
    r
  })
  names(out) <- comp$geoid
  out
}
