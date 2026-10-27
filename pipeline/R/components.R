# Components of change, April 2010 - July 2020, from Vintage 2020 estimates (spec §4 step 8).

COMPONENT_PREFIXES <- c(natural = "NATURALINC", domestic = "DOMESTICMIG",
                        international = "INTERNATIONALMIG", net = "NETMIG")
DRIVER_KEYS <- c("outmig", "both", "natural", "other")

read_vintage2020 <- function(path, universe) {
  v <- read.csv(path, colClasses = c(STATE = "character", COUNTY = "character"),
                fileEncoding = "latin1", check.names = FALSE)
  v <- v[v$SUMLEV == 50, ]
  v$geoid <- paste0(v$STATE, v$COUNTY)
  assert_current_codes(v$geoid, "Vintage 2020")
  v <- restrict_one_to_one(v, universe, "Vintage 2020")
  sums <- vapply(COMPONENT_PREFIXES, function(p) {
    cols <- paste0(p, 2010:2020)
    stopifnot(all(cols %in% names(v)))
    rowSums(v[cols])
  }, numeric(nrow(v)))
  if (is.null(dim(sums))) sums <- t(sums)
  data.frame(geoid = v$geoid, sums, total = v$POPESTIMATE2020 - v$ESTIMATESBASE2010,
             row.names = NULL)
}

# Sign rules, used in components.json: net out-migration only, both, natural decrease only,
# otherwise "other". Natural change of exactly 0 counts as natural decrease, which reproduces
# Table 2 exactly (Terry County, TX, 48311, is the only loss county affected).
driver_sign_only <- function(net, natural) {
  ifelse(net < 0, ifelse(natural <= 0, "both", "outmig"), ifelse(natural <= 0, "natural", "other"))
}

# Total-first rule, reported for reference only: a loss county whose estimates show growth
# (total change >= 0) is "other"; the sign rules apply to the rest.
driver_total_first <- function(net, natural, total) {
  ifelse(total >= 0, "other", driver_sign_only(net, natural))
}

# Counts by pathway for both rules, laid out like paper_table2.csv.
driver_table <- function(comp, pathway, rule) {
  loss <- pathway <= 4
  d <- if (rule == "total_first") {
    driver_total_first(comp$net, comp$natural, comp$total)
  } else {
    driver_sign_only(comp$net, comp$natural)
  }
  tab <- table(factor(pathway[loss], levels = 1:4), factor(d[loss], levels = DRIVER_KEYS))
  out <- as.data.frame.matrix(tab)
  rbind(out, total = colSums(out))
}

# Loss counties sitting exactly on a sign boundary, listed so the tie handling stays visible.
driver_edge_cases <- function(comp, pathway) {
  edge <- pathway <= 4 & (comp$natural == 0 | comp$net == 0)
  data.frame(geoid = comp$geoid[edge], pathway = pathway[edge], natural = comp$natural[edge],
             net = comp$net[edge], total = comp$total[edge],
             sign_only = driver_sign_only(comp$net, comp$natural)[edge],
             total_first = driver_total_first(comp$net, comp$natural, comp$total)[edge])
}

TABLE2_COLS <- c(outmig = "net_outmigration_only", both = "net_outmigration_and_natural_decrease",
                 natural = "natural_decrease_only", other = "other")

read_paper_table2 <- function(path) {
  t2 <- read.csv(path, comment.char = "#", check.names = FALSE, colClasses = c(pathway_id = "character"))
  stopifnot(all(TABLE2_COLS %in% names(t2)), identical(t2$pathway_id, c("1", "2", "3", "4", "total")))
  out <- t2[TABLE2_COLS]
  names(out) <- names(TABLE2_COLS)
  rownames(out) <- t2$pathway_id
  out
}

compare_table2 <- function(comp, pathway, paper) {
  rules <- c("total_first", "sign_only")
  res <- lapply(rules, function(r) {
    got <- driver_table(comp, pathway, r)
    list(counts = got, diff = got - paper, abs_diff = sum(abs(as.matrix(got - paper))))
  })
  names(res) <- rules
  res
}
