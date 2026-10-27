# Population counts and decadal change measures (spec §4 steps 3-4).

YEARS <- seq(1950, 2020, by = 10)
DECADE_LABELS <- with(list(end = tail(YEARS, -1)),
                      sprintf("%d–%s", head(YEARS, -1),
                              ifelse(end %% 100 == 0, end, sprintf("%02d", end %% 100))))
WORKBOOK_POP_COLS <- c(sprintf("epop%d", seq(1950, 2000, by = 10)), "pop2010")

# Attributes only (no geometry) from the Fig. 1 layer: the 2020 count, plus the published 2010
# count and class, which are used only for the validation report.
read_gpkg_pop <- function(gpkg) {
  p <- sf::st_read(gpkg, query = "SELECT GEOID, POP_202, POP_201, CAT2 FROM us_pop_change", quiet = TRUE)
  p$geoid <- pad_fips(p$GEOID)
  p
}

# How far the GeoPackage's POP_201 is from the workbook pop2010 we use (spec §3 issue 2).
compare_2010_bases <- function(gpkg_pop, pop) {
  g <- restrict_one_to_one(gpkg_pop, rownames(pop), "us_pop_change")
  rel <- 100 * abs(g$POP_201 - pop[, "2010"]) / pop[, "2010"]
  list(n_diff = sum(g$POP_201 != pop[, "2010"]), median_pct = median(rel),
       p99_pct = unname(quantile(rel, 0.99)), max_pct = max(rel))
}

# Published Fig. 1 CAT2 vs our exact-break 2010-20 class.
compare_cat2 <- function(gpkg_pop, cat1020, universe) {
  g <- restrict_one_to_one(gpkg_pop, universe, "us_pop_change")
  tab <- table(published = g$CAT2, rebuilt = factor(cat1020, levels = 1:5))
  as.data.frame.matrix(tab)
}

read_workbook <- function(path) {
  wb <- readxl::read_excel(path, sheet = "c2010_hist_pops")
  wb <- data.frame(geoid = pad_fips(wb$GEOID10), as.data.frame(wb[WORKBOOK_POP_COLS]),
                   check.names = FALSE)
  recode_workbook(wb, WORKBOOK_POP_COLS)
}

# 8 counts per county, rows in `universe` order: 1950-2000 epop, workbook pop2010
# (never the GeoPackage POP_201), and POP_202 for 2020.
build_population <- function(workbook, gpkg_pop, universe) {
  wb <- restrict_one_to_one(workbook, universe, "workbook")
  gp <- restrict_one_to_one(gpkg_pop, universe, "us_pop_change")
  pop <- cbind(as.matrix(wb[WORKBOOK_POP_COLS]), gp$POP_202)
  storage.mode(pop) <- "double"
  dimnames(pop) <- list(universe, YEARS)
  if (anyNA(pop) || any(pop <= 0)) stop("population counts must be positive and complete")
  pop
}

decade_start <- function(pop) pop[, -ncol(pop), drop = FALSE]
decade_end <- function(pop) pop[, -1, drop = FALSE]

pct_change <- function(pop) {
  out <- 100 * (decade_end(pop) - decade_start(pop)) / decade_start(pop)
  colnames(out) <- head(colnames(pop), -1)
  out
}

log_growth <- function(pop) {
  out <- log(decade_end(pop) / decade_start(pop))
  colnames(out) <- head(colnames(pop), -1)
  out
}

# Five change classes with exact breaks: 1 = >=20, 2 = 10 to <20, 3 = 0 to <10,
# 4 = >-10 to <0, 5 = <=-10. Applied to unrounded percentages.
bin_change <- function(x) {
  out <- ifelse(x >= 20, 1L, ifelse(x >= 10, 2L, ifelse(x >= 0, 3L, ifelse(x > -10, 4L, 5L))))
  if (is.matrix(x)) dim(out) <- dim(x)
  out
}

EXPECTED_CAT1020_COUNTS <- c(118L, 295L, 1058L, 1365L, 272L)

assert_cat1020_counts <- function(cat1020) {
  got <- tabulate(cat1020, nbins = 5)
  if (!identical(got, EXPECTED_CAT1020_COUNTS)) {
    stop("2010-20 class counts ", paste(got, collapse = "/"), " != expected ",
         paste(EXPECTED_CAT1020_COUNTS, collapse = "/"))
  }
  got
}
