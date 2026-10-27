# County profile indicators and the Table 1 check (spec §4 steps 6-7). Race and ethnicity
# come from the 2020 Census (PL 94-171 table P2); everything else from the ACS 2016-20 5-year.

ACS_TABLES <- c("B01001", "B05002", "B16004", "B15003", "B17001", "C24050", "B25003")

SOURCE_LABELS <- c(census2020 = "2020 Census (PL 94-171, table P2)",
                   acs = "ACS 2016–20 5-year estimates")

v <- function(table, ...) sprintf("%s_%03d", table, c(...))

# Variables whose labels must contain the given text; guards against table renumbering.
ACS_LABEL_CHECKS <- c(
  B01001_020 = "Male:!!65 and 66", B01001_025 = "Male:!!85 years and over",
  B01001_044 = "Female:!!65 and 66", B01001_049 = "Female:!!85 years and over",
  B05002_013 = "Total:!!Foreign born:", B16004_003 = "5 to 17 years:!!Speak only English",
  B16004_025 = "18 to 64 years:!!Speak only English", B16004_047 = "65 years and over:!!Speak only English",
  B15003_022 = "Bachelor's degree", B15003_025 = "Doctorate degree",
  B17001_002 = "below poverty level", C24050_002 = "Total:!!Agriculture, forestry, fishing and hunting, and mining",
  C24050_004 = "Total:!!Manufacturing", C24050_010 = "Total:!!Professional, scientific, and management",
  B25003_002 = "Owner occupied", B25003_003 = "Renter occupied")

ENGLISH_ONLY_VARS <- v("B16004", c(3, 25, 47))

# The 14 profile indicators in Table 1 order. `table1` is the row key in
# pipeline/checks/paper_table1.csv; `intended` marks a deliberate definitional difference.
# Census rows name columns of the P2 extract; ACS rows name variables. The language row is
# built from B16004 in acs_components().
PROFILE_INDICATORS <- list(
  list(key = "white_nh", label = "White, non-Hispanic", source = "census2020", num = "white_nh", den = "total"),
  list(key = "black_nh", label = "Black, non-Hispanic", source = "census2020", num = "black_nh", den = "total"),
  list(key = "asian_nh", label = "Asian, non-Hispanic", source = "census2020", num = "asian_nh", den = "total"),
  list(key = "hispanic", label = "Hispanic or Latino", source = "census2020", num = "hispanic", den = "total"),
  list(key = "age_65_plus", label = "Aged 65+", source = "acs", num = v("B01001", 20:25, 44:49), den = v("B01001", 1)),
  list(key = "foreign_born", label = "Foreign-born", source = "acs", num = v("B05002", 13), den = v("B05002", 1)),
  list(key = "language_other_than_english", label = "Speaks a language other than English at home",
       source = "acs", table1 = "english_not_well_or_not_at_all"),
  list(key = "bachelors_plus_age25", label = "Bachelor’s degree or higher (age 25+)", source = "acs",
       num = v("B15003", 22:25), den = v("B15003", 1),
       intended = "Table 1 reports bachelor's degree only; the dashboard uses bachelor's degree or higher."),
  list(key = "below_poverty", label = "Below poverty level", source = "acs", num = v("B17001", 2), den = v("B17001", 1)),
  list(key = "emp_ag_forestry_fishing_hunting_mining",
       label = "Works in agriculture, forestry, fishing, hunting and mining", source = "acs",
       num = v("C24050", 2), den = v("C24050", 1)),
  list(key = "emp_manufacturing", label = "Works in manufacturing", source = "acs",
       num = v("C24050", 4), den = v("C24050", 1)),
  list(key = "emp_prof_sci_mgmt_admin",
       label = "Works in professional, scientific, management and administrative services", source = "acs",
       num = v("C24050", 10), den = v("C24050", 1)),
  list(key = "owner_occupied", label = "Owner-occupied homes", source = "acs", num = v("B25003", 2), den = v("B25003", 1)),
  list(key = "renter_occupied", label = "Renter-occupied homes", source = "acs", num = v("B25003", 3), den = v("B25003", 1))
)

indicator_keys <- function() vapply(PROFILE_INDICATORS, `[[`, "", "key")
table1_row <- function(ind) if (is.null(ind$table1)) ind$key else ind$table1

fetch_acs <- function(universe) {
  vars <- tidycensus::load_variables(2020, "acs5")
  lab <- vars$label[match(names(ACS_LABEL_CHECKS), vars$name)]
  bad <- !mapply(grepl, ACS_LABEL_CHECKS, lab, MoreArgs = list(fixed = TRUE))
  if (any(bad)) stop("ACS labels changed: ", paste(names(ACS_LABEL_CHECKS)[bad], collapse = ", "))
  long <- do.call(rbind, lapply(ACS_TABLES, function(t) {
    as.data.frame(tidycensus::get_acs(geography = "county", table = t, year = 2020, survey = "acs5"))
  }))
  assert_current_codes(unique(long$GEOID), "ACS 2016-20")
  long <- long[long$GEOID %in% universe, ]
  est <- tapply(long$estimate, list(long$GEOID, long$variable), sum)
  moe <- tapply(long$moe, list(long$GEOID, long$variable), sum)
  if (!setequal(rownames(est), universe)) stop("ACS 2016-20: study counties missing")
  list(est = est[universe, ], moe = moe[universe, ])
}

fetch_decennial_race <- function(universe) {
  d <- tidycensus::get_decennial(
    geography = "county", year = 2020, sumfile = "pl", output = "wide",
    variables = c(total = "P2_001N", hispanic = "P2_002N", white_nh = "P2_005N",
                  black_nh = "P2_006N", asian_nh = "P2_008N"))
  d <- as.data.frame(d)
  names(d)[names(d) == "GEOID"] <- "geoid"
  assert_current_codes(d$geoid, "2020 Census PL")
  restrict_one_to_one(d, universe, "2020 Census PL")
}

moe_sum_rows <- function(m) sqrt(rowSums(m^2, na.rm = TRUE))

# County share (percent) with MOE: proportion formula, falling back to the ratio formula
# when the term under the root is negative (ACS handbook). Census counts carry no MOE (NA).
county_share <- function(num, den, moe_num, moe_den) {
  p <- num / den
  under <- moe_num^2 - p^2 * moe_den^2
  ratio <- moe_num^2 + p^2 * moe_den^2
  moe <- ifelse(under < 0, sqrt(ratio), sqrt(pmax(under, 0))) / den
  cbind(est = 100 * p, moe = 100 * moe)
}

# Numerator and denominator counts (with MOEs) for each indicator, rows in universe order.
acs_components <- function(acs, decennial) {
  stopifnot(identical(rownames(acs$est), decennial$geoid))
  acs_part <- function(vars) {
    list(n = rowSums(acs$est[, vars, drop = FALSE]), moe = moe_sum_rows(acs$moe[, vars, drop = FALSE]))
  }
  census_part <- function(col) list(n = decennial[[col]], moe = rep(NA_real_, nrow(decennial)))
  out <- lapply(PROFILE_INDICATORS, function(ind) {
    if (ind$key == "language_other_than_english") {
      total5 <- acs_part(v("B16004", 1))
      only_en <- acs_part(ENGLISH_ONLY_VARS)
      num <- list(n = total5$n - only_en$n, moe = sqrt(total5$moe^2 + only_en$moe^2))
      den <- total5
    } else if (ind$source == "census2020") {
      num <- census_part(ind$num)
      den <- census_part(ind$den)
    } else {
      num <- acs_part(ind$num)
      den <- acs_part(ind$den)
    }
    c(ind[c("key", "label", "source")], list(table1 = table1_row(ind), intended = ind$intended,
                                              num = num, den = den))
  })
  setNames(out, indicator_keys())
}

group_values <- function(ind, groups, method) {
  vals <- if (method == "pooled") {
    tapply(ind$num$n, groups, sum) / tapply(ind$den$n, groups, sum)
  } else {
    tapply(ind$num$n / ind$den$n, groups, mean)
  }
  100 * vals
}

# Values per pathway (columns "1".."8") for one indicator under one method.
pathway_row <- function(ind, pathway, method) group_values(ind, factor(pathway, levels = 1:8), method)

read_paper_table1 <- function(path) {
  t1 <- read.csv(path, comment.char = "#", check.names = FALSE)
  stopifnot(identical(names(t1), c("indicator", as.character(1:8))))
  m <- as.matrix(t1[as.character(1:8)])
  rownames(m) <- t1$indicator
  m
}

TABLE1_TOLERANCE <- 0.5

# Pooled ratios vs county means, chosen on the rows meant to match Table 1. Gaps are reported,
# never fatal; rows with an intended difference are reported separately.
compare_table1 <- function(comp, pathway, paper) {
  keys <- names(comp)
  paper_rows <- paper[vapply(comp, `[[`, "", "table1"), , drop = FALSE]
  rownames(paper_rows) <- keys
  intended <- !vapply(comp, function(i) is.null(i$intended), TRUE)
  rows <- function(method) t(vapply(comp, function(i) pathway_row(i, pathway, method), numeric(8)))
  by_method <- lapply(c(pooled = "pooled", county_mean = "county_mean"), rows)
  mad <- vapply(by_method, function(m) mean(abs(m[!intended, ] - paper_rows[!intended, ])), 0)
  method <- names(which.min(mad))
  ours <- by_method[[method]]
  colnames(ours) <- 1:8
  diff <- ours - paper_rows
  outside <- abs(round(diff, 1)) > TABLE1_TOLERANCE
  list(method = method, method_mad = mad, ours = ours, paper = paper_rows, diff = diff,
       paper_row = unname(vapply(comp, `[[`, "", "table1")), source = unname(vapply(comp, `[[`, "", "source")),
       intended = keys[intended], n_outside = sum(outside[!intended, ]),
       n_cells = length(diff[!intended, ]))
}

# Shows that the education gap is definitional: bachelor's only reproduces Table 1.
education_bachelor_only <- function(acs, pathway, paper) {
  f <- factor(pathway, levels = 1:8)
  e <- acs$est
  vals <- 100 * as.numeric(tapply(e[, "B15003_022"], f, sum) / tapply(e[, "B15003_001"], f, sum))
  list(values = vals, max_abs_diff = round(max(abs(round(vals, 1) - paper["bachelors_plus_age25", ])), 1))
}

# Context rows of Table 1 that come from the county data rather than ACS.
compare_table1_context <- function(pathway, pop2020, rucc, paper) {
  f <- factor(pathway, levels = 1:8)
  n <- as.numeric(table(f))
  pop <- as.numeric(tapply(pop2020, f, sum))
  ours <- rbind(
    count = n,
    share_of_counties_pct = 100 * n / sum(n),
    pop_2020 = pop,
    share_of_us_pop_2020_pct = 100 * pop / sum(pop),
    metro_counties_rucc2013 = 100 * as.numeric(tapply(rucc$rucc13 <= 3, f, mean)),
    metro_counties_rucc2023 = 100 * as.numeric(tapply(rucc$metro, f, mean)),
    nonmetro_counties_rucc2013 = 100 * as.numeric(tapply(rucc$rucc13 > 3, f, mean)),
    nonmetro_counties_rucc2023 = 100 * as.numeric(tapply(!rucc$metro, f, mean)))
  colnames(ours) <- 1:8
  list(ours = ours, paper = paper[rownames(ours), ], diff = ours - paper[rownames(ours), ])
}

# acs.json payload: county estimates with MOEs (null for Census counts), plus pathway and
# U.S. (study area) values computed with the method that best reproduced Table 1.
acs_payload <- function(comp, t1, universe) {
  keys <- names(comp)
  county_vals <- lapply(comp, function(i) {
    m <- round(county_share(i$num$n, i$den$n, i$num$moe, i$den$moe), 1)
    m[!is.finite(m)] <- NA  # zero denominators in the smallest counties
    m
  })
  county <- lapply(seq_along(universe), function(r) lapply(county_vals, function(m) unname(m[r, ])))
  names(county) <- universe
  pw <- lapply(as.character(1:8), function(p) as.list(round(t1$ours[, p], 1)))
  names(pw) <- 1:8
  us <- lapply(comp, function(i) round(as.numeric(group_values(i, rep("us", length(universe)), t1$method)), 1))
  list(
    indicators = lapply(comp, function(i) {
      out <- list(key = i$key, label = i$label, unit = "%", source = i$source)
      if (!is.null(i$intended)) out$note <- i$intended
      out
    }) |> unname(),
    sources = as.list(SOURCE_LABELS),
    method = t1$method,
    county = county, pathway = pw, us = us)
}
