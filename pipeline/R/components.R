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

# Table 2 drivers by sign: net out-migration only, both, natural decrease only, otherwise
# "other". Natural change <= 0 counts as decrease, which reproduces Table 2 exactly (Terry
# County, TX, 48311, is the only loss county with natural change of exactly 0).
driver_by_sign <- function(net, natural) {
  ifelse(net < 0, ifelse(natural <= 0, "both", "outmig"), ifelse(natural <= 0, "natural", "other"))
}

# Counts by pathway for the loss counties, laid out like paper_table2.csv.
driver_table <- function(comp, pathway) {
  loss <- pathway <= 4
  d <- driver_by_sign(comp$net, comp$natural)
  tab <- table(factor(pathway[loss], levels = 1:4), factor(d[loss], levels = DRIVER_KEYS))
  out <- as.data.frame.matrix(tab)
  rbind(out, total = colSums(out))
}

# Loss counties sitting exactly on a sign boundary, listed so the tie handling stays visible.
driver_edge_cases <- function(comp, pathway) {
  edge <- pathway <= 4 & (comp$natural == 0 | comp$net == 0)
  data.frame(geoid = comp$geoid[edge], pathway = pathway[edge], natural = comp$natural[edge],
             net = comp$net[edge], total = comp$total[edge],
             driver = driver_by_sign(comp$net, comp$natural)[edge])
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

# Table 2 must match in all 20 cells; any difference fails the build.
check_table2 <- function(comp, pathway, paper) {
  got <- driver_table(comp, pathway)
  diff <- got - paper
  bad <- sum(as.matrix(diff) != 0)
  if (bad) {
    stop("Table 2 drivers: ", bad, " of 20 cells differ from the paper\n",
         paste(capture.output(print(diff)), collapse = "\n"))
  }
  list(counts = got, cells = length(as.matrix(got)), mismatches = 0L)
}
