# ACS 2016-2020 county profile and the Table 1 check (spec §4 steps 6-7).

ACS_TABLES <- c("B03002", "B01001", "B05002", "B16004", "B15003", "B17001", "C24050", "B25003")

v <- function(table, ...) sprintf("%s_%03d", table, c(...))

# Variables whose labels must contain the given text; guards against table renumbering.
ACS_LABEL_CHECKS <- c(
  B03002_003 = "Not Hispanic or Latino:!!White alone", B03002_004 = "Not Hispanic or Latino:!!Black",
  B03002_006 = "Not Hispanic or Latino:!!Asian alone", B03002_012 = "Total:!!Hispanic or Latino:",
  B01001_020 = "Male:!!65 and 66", B01001_025 = "Male:!!85 years and over",
  B01001_044 = "Female:!!65 and 66", B01001_049 = "Female:!!85 years and over",
  B05002_013 = "Total:!!Foreign born:", B16004_003 = "5 to 17 years:!!Speak only English",
  B16004_025 = "18 to 64 years:!!Speak only English", B16004_047 = "65 years and over:!!Speak only English",
  B15003_022 = "Bachelor's degree", B15003_025 = "Doctorate degree",
  B17001_002 = "below poverty level", C24050_002 = "Total:!!Agriculture, forestry, fishing and hunting, and mining",
  C24050_004 = "Total:!!Manufacturing", C24050_010 = "Total:!!Professional, scientific, and management",
  B25003_002 = "Owner occupied", B25003_003 = "Renter occupied")

# Paper Table 1 rows (keys match pipeline/checks/paper_table1.csv). The English row is built
# separately because it is tested with two denominators.
acs_indicator_defs <- function(english_num) {
  list(
    white_nh = list(label = "White, non-Hispanic", num = v("B03002", 3), den = v("B03002", 1)),
    black_nh = list(label = "Black, non-Hispanic", num = v("B03002", 4), den = v("B03002", 1)),
    asian_nh = list(label = "Asian, non-Hispanic", num = v("B03002", 6), den = v("B03002", 1)),
    hispanic = list(label = "Hispanic or Latino", num = v("B03002", 12), den = v("B03002", 1)),
    age_65_plus = list(label = "Aged 65+", num = v("B01001", 20:25, 44:49), den = v("B01001", 1)),
    foreign_born = list(label = "Foreign-born", num = v("B05002", 13), den = v("B05002", 1)),
    english_not_well_or_not_at_all = list(label = "Speaks English “not well” or “not at all”",
                                          num = english_num, den = NULL),
    bachelors_plus_age25 = list(label = "Bachelor’s degree or higher (age 25+)",
                                num = v("B15003", 22:25), den = v("B15003", 1)),
    below_poverty = list(label = "Below poverty level", num = v("B17001", 2), den = v("B17001", 1)),
    emp_ag_forestry_fishing_hunting_mining = list(
      label = "Works in agriculture, forestry, fishing, hunting and mining",
      num = v("C24050", 2), den = v("C24050", 1)),
    emp_manufacturing = list(label = "Works in manufacturing", num = v("C24050", 4), den = v("C24050", 1)),
    emp_prof_sci_mgmt_admin = list(
      label = "Works in professional, scientific, management and administrative services",
      num = v("C24050", 10), den = v("C24050", 1)),
    owner_occupied = list(label = "Owner-occupied homes", num = v("B25003", 2), den = v("B25003", 1)),
    renter_occupied = list(label = "Renter-occupied homes", num = v("B25003", 3), den = v("B25003", 1))
  )
}

ENGLISH_ONLY_VARS <- v("B16004", c(3, 25, 47))

fetch_acs <- function(universe) {
  vars <- tidycensus::load_variables(2020, "acs5")
  lab <- vars$label[match(names(ACS_LABEL_CHECKS), vars$name)]
  bad <- !mapply(grepl, ACS_LABEL_CHECKS, lab, MoreArgs = list(fixed = TRUE))
  if (any(bad)) stop("ACS labels changed: ", paste(names(ACS_LABEL_CHECKS)[bad], collapse = ", "))
  b16 <- vars[startsWith(vars$name, "B16004_"), ]
  english_num <- b16$name[grepl("Speak English \"not (well|at all)\"$", b16$label)]
  stopifnot(length(english_num) == 24)
  long <- do.call(rbind, lapply(ACS_TABLES, function(t) {
    as.data.frame(tidycensus::get_acs(geography = "county", table = t, year = 2020,
                                      survey = "acs5"))
  }))
  assert_current_codes(unique(long$GEOID), "ACS 2016-20")
  long <- long[long$GEOID %in% universe, ]
  est <- tapply(long$estimate, list(long$GEOID, long$variable), sum)
  moe <- tapply(long$moe, list(long$GEOID, long$variable), sum)
  if (!setequal(rownames(est), universe)) stop("ACS 2016-20: study counties missing")
  list(est = est[universe, ], moe = moe[universe, ], english_num = english_num)
}

moe_sum_rows <- function(m) sqrt(rowSums(m^2, na.rm = TRUE))

# County share (percent) with MOE: proportion formula, falling back to the ratio formula
# when the term under the root is negative (ACS handbook).
county_share <- function(num, den, moe_num, moe_den) {
  p <- num / den
  under <- moe_num^2 - p^2 * moe_den^2
  ratio <- moe_num^2 + p^2 * moe_den^2
  moe <- ifelse(under < 0, sqrt(ratio), sqrt(pmax(under, 0))) / den
  cbind(est = 100 * p, moe = 100 * moe)
}

# Numerator and denominator counts (with MOEs) for every indicator; English gets both variants.
acs_components <- function(acs) {
  defs <- acs_indicator_defs(acs$english_num)
  pick <- function(vars, what) acs[[what]][, vars, drop = FALSE]
  part <- function(vars) list(n = rowSums(pick(vars, "est")), moe = moe_sum_rows(pick(vars, "moe")))
  out <- lapply(defs, function(d) {
    if (is.null(d$den)) return(NULL)
    list(label = d$label, num = part(d$num), den = part(d$den))
  })
  eng <- defs$english_not_well_or_not_at_all
  total5 <- part(v("B16004", 1))
  only_en <- part(ENGLISH_ONLY_VARS)
  lote <- list(n = total5$n - only_en$n, moe = sqrt(total5$moe^2 + only_en$moe^2))
  english <- list(
    age5 = list(label = eng$label, num = part(eng$num), den = total5,
                note = "share of all people aged 5+"),
    lote = list(label = eng$label, num = part(eng$num), den = lote,
                note = "share of people aged 5+ who speak a language other than English at home"))
  list(indicators = out, english = english)
}

group_values <- function(ind, groups, method) {
  share <- ind$num$n / ind$den$n
  vals <- if (method == "pooled") {
    tapply(ind$num$n, groups, sum) / tapply(ind$den$n, groups, sum)
  } else {
    tapply(share, groups, mean)
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

# Choose pooled ratios or county means on the 13 single-definition indicators, then the
# English denominator under that method. Gaps are reported, never fatal.
compare_table1 <- function(comp, pathway, paper) {
  keys <- setdiff(names(comp$indicators), "english_not_well_or_not_at_all")
  keys <- keys[!vapply(comp$indicators[keys], is.null, TRUE)]
  rows <- function(method) {
    t(vapply(keys, function(k) pathway_row(comp$indicators[[k]], pathway, method), numeric(8)))
  }
  by_method <- lapply(c(pooled = "pooled", county_mean = "county_mean"), rows)
  mad <- vapply(by_method, function(m) mean(abs(m - paper[keys, ])), 0)
  method <- names(which.min(mad))
  eng_key <- "english_not_well_or_not_at_all"
  eng_rows <- t(vapply(comp$english, function(e) pathway_row(e, pathway, method), numeric(8)))
  eng_mad <- apply(eng_rows, 1, function(r) mean(abs(r - paper[eng_key, ])))
  english <- names(which.min(eng_mad))
  ours <- rbind(by_method[[method]], eng_rows[english, , drop = FALSE])
  rownames(ours)[nrow(ours)] <- eng_key
  ours <- ours[intersect(rownames(paper), rownames(ours)), ]
  diff <- ours - paper[rownames(ours), ]
  list(method = method, method_mad = mad, english = english, english_mad = eng_mad,
       english_rows = eng_rows, ours = ours, paper = paper[rownames(ours), ], diff = diff,
       n_outside = sum(abs(round(diff, 1)) > TABLE1_TOLERANCE), n_cells = length(diff))
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

# Alternative definitions that may explain Table 1 gaps. Reported in validation.md only;
# acs.json keeps the spec's definitions.
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

table1_diagnostics <- function(acs, decennial, pathway, paper) {
  e <- acs$est
  f <- factor(pathway, levels = 1:8)
  pooled <- function(n, d) 100 * as.numeric(tapply(n, f, sum) / tapply(d, f, sum))
  total5 <- e[, "B16004_001"]
  lote <- total5 - rowSums(e[, ENGLISH_ONLY_VARS])
  rows <- list(
    list(row = "english_not_well_or_not_at_all",
         alternative = "Speaks a language other than English at home, share of age 5+ (ACS B16004)",
         values = pooled(lote, total5)),
    list(row = "bachelors_plus_age25",
         alternative = "Bachelor's degree only, share of age 25+ (ACS B15003_022)",
         values = pooled(e[, "B15003_022"], e[, "B15003_001"])))
  for (k in c("white_nh", "black_nh", "asian_nh", "hispanic")) {
    rows[[length(rows) + 1]] <- list(
      row = k, alternative = "2020 Decennial Census PL table P2, same category",
      values = pooled(decennial[[k]], decennial$total))
  }
  lapply(rows, function(r) {
    r$paper <- unname(paper[r$row, ])
    r$max_abs_diff <- round(max(abs(round(r$values, 1) - r$paper)), 1)
    r
  })
}

# acs.json payload: county estimates with MOEs, plus pathway and U.S. (study area) values
# computed with the method that best reproduced Table 1.
acs_payload <- function(comp, t1, pathway, universe) {
  inds <- comp$indicators
  inds$english_not_well_or_not_at_all <- comp$english[[t1$english]]
  keys <- rownames(t1$ours)
  county_vals <- lapply(keys, function(k) {
    i <- inds[[k]]
    m <- round(county_share(i$num$n, i$den$n, i$num$moe, i$den$moe), 1)
    m[!is.finite(m)] <- NA  # zero denominators in the smallest counties
    m
  })
  names(county_vals) <- keys
  county <- lapply(seq_along(universe), function(r) {
    lapply(county_vals, function(m) unname(m[r, ]))
  })
  names(county) <- universe
  pw <- lapply(as.character(1:8), function(p) as.list(round(t1$ours[, p], 1)))
  names(pw) <- 1:8
  us <- lapply(keys, function(k) round(as.numeric(group_values(inds[[k]], rep("us", length(universe)),
                                                                t1$method)), 1))
  names(us) <- keys
  english_note <- comp$english[[t1$english]]$note
  list(
    indicators = lapply(keys, function(k) {
      out <- list(key = k, label = inds[[k]]$label, unit = "%")
      if (k == "english_not_well_or_not_at_all") out$note <- english_note
      out
    }),
    method = t1$method,
    county = county, pathway = pw, us = us)
}
