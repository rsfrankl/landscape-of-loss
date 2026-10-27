# County identifiers: FIPS padding, 2010-code recodes, join assertions (spec §3 issue 1, §4 step 1).

pad_fips <- function(x) {
  x <- trimws(as.character(x))
  stopifnot(!anyNA(x), all(grepl("^[0-9]{1,5}$", x)))
  formatC(as.integer(x), width = 5, flag = "0")
}

# Workbook (2010 codes): Shannon SD becomes Oglala Lakota; Bedford city's counts are added
# to Bedford County in every year column.
recode_workbook <- function(wb, pop_cols) {
  wb <- as.data.frame(wb)
  stopifnot(sum(wb$geoid == "46113") == 1, sum(wb$geoid == "46102") == 0,
            sum(wb$geoid == "51515") == 1, sum(wb$geoid == "51019") == 1)
  wb$geoid[wb$geoid == "46113"] <- "46102"
  city <- wb$geoid == "51515"
  county <- wb$geoid == "51019"
  wb[county, pop_cols] <- wb[county, pop_cols] + wb[city, pop_cols]
  wb[!city, , drop = FALSE]
}

# RUCC 2013 (2010 codes): codes are classes, never summed. Bedford city is dropped and
# Bedford County keeps its own code.
recode_rucc2013 <- function(rucc) {
  rucc <- as.data.frame(rucc)
  stopifnot(sum(rucc$geoid == "46113") == 1, sum(rucc$geoid == "46102") == 0,
            sum(rucc$geoid == "51019") == 1)
  rucc$geoid[rucc$geoid == "46113"] <- "46102"
  rucc[rucc$geoid != "51515", , drop = FALSE]
}

# Inputs published on current codes (ACS 2016-20, Vintage 2020, RUCC 2023) must not need
# recoding; fail if they do.
assert_current_codes <- function(geoids, source) {
  if (!"46102" %in% geoids) stop(source, ": expected 46102 (Oglala Lakota) is missing")
  stale <- intersect(c("46113", "51515"), geoids)
  if (length(stale)) stop(source, ": contains retired code(s) ", paste(stale, collapse = ", "))
  invisible(TRUE)
}

# Keep the rows of `df` for the study counties, asserting each study county appears once.
# `allow_missing` lists study counties that may be absent (e.g. Connecticut in RUCC 2023).
restrict_one_to_one <- function(df, universe, source, allow_missing = character()) {
  df <- as.data.frame(df)
  kept <- df[df$geoid %in% universe, , drop = FALSE]
  dups <- unique(kept$geoid[duplicated(kept$geoid)])
  if (length(dups)) stop(source, ": duplicate GEOIDs ", paste(head(dups, 10), collapse = ", "))
  missing <- setdiff(universe, kept$geoid)
  unexpected <- setdiff(missing, allow_missing)
  if (length(unexpected)) {
    stop(source, ": ", length(unexpected), " study counties missing, e.g. ",
         paste(head(unexpected, 10), collapse = ", "))
  }
  kept[match(intersect(universe, kept$geoid), kept$geoid), , drop = FALSE]
}
