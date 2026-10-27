# Spatial-context (A-D) rebuild and verification against the author's sequences (spec §4 step 5).

NO_NEIGHBOUR_GEOIDS <- c("25007", "25019", "53055")
SEQ_DECADE_COLS <- c("60", "70", "80", "90", "00", "10", "20")

# Queen contiguity on the unsimplified geometry: any shared boundary point, excluding self.
queen_neighbours <- function(geom) {
  nb <- sf::st_intersects(geom)
  lapply(seq_along(nb), function(i) setdiff(nb[[i]], i))
}

read_county_geometry <- function(gpkg, universe) {
  geom <- sf::st_read(gpkg, layer = "us_counties_typologies", quiet = TRUE)
  geom$geoid <- pad_fips(geom$GEOID)
  stopifnot(setequal(geom$geoid, universe), !anyDuplicated(geom$geoid))
  geom[match(universe, geom$geoid), ]
}

# Population-weighted neighbour change, in percent: sum of neighbours' change over the sum
# of their start populations. NA for counties with no neighbours.
neighbour_lag <- function(pop, nb) {
  p0 <- decade_start(pop)
  p1 <- decade_end(pop)
  rows <- lapply(nb, function(j) {
    if (!length(j)) return(rep(NA_real_, ncol(p0)))
    100 * colSums(p1[j, , drop = FALSE] - p0[j, , drop = FALSE]) / colSums(p0[j, , drop = FALSE])
  })
  matrix(unlist(rows), nrow = length(nb), byrow = TRUE, dimnames = dimnames(p0))
}

# A = self loss & neighbours loss; B = self loss & neighbours growth;
# C = self growth & neighbours loss; D = self growth & neighbours growth.
# Loss is strictly negative; no neighbours (NA lag) counts as neighbours-growth.
ad_codes <- function(self_change, lag) {
  self_loss <- self_change < 0
  nb_loss <- !is.na(lag) & lag < 0
  out <- ifelse(self_loss, ifelse(nb_loss, "A", "B"), ifelse(nb_loss, "C", "D"))
  dim(out) <- dim(self_change)
  dimnames(out) <- dimnames(self_change)
  out
}

read_sequences <- function(loss_path, growth_path) {
  read_one <- function(path, group) {
    s <- read.csv(path, colClasses = "character", check.names = FALSE)
    stopifnot(identical(names(s), c("geoid10", SEQ_DECADE_COLS)))
    data.frame(geoid = pad_fips(s$geoid10), group = group,
               seq = do.call(paste0, s[SEQ_DECADE_COLS]), s[SEQ_DECADE_COLS],
               check.names = FALSE)
  }
  rbind(read_one(loss_path, "loss"), read_one(growth_path, "growth"))
}

# Compare every county-decade cell with the author's files. Any mismatch is a build failure:
# the mismatches are written to `mismatch_path` and the target errors, so no output writer
# (each depends on this target) can run.
check_ad <- function(codes, sequences, mismatch_path) {
  seq_m <- as.matrix(sequences[SEQ_DECADE_COLS])
  rownames(seq_m) <- sequences$geoid
  if (!setequal(rownames(seq_m), rownames(codes)) || anyDuplicated(rownames(seq_m))) {
    stop("sequence files do not cover the study counties exactly once")
  }
  seq_m <- seq_m[rownames(codes), , drop = FALSE]
  bad <- which(codes != seq_m, arr.ind = TRUE)
  n_cells <- length(codes)
  if (nrow(bad)) {
    mism <- data.frame(geoid = rownames(codes)[bad[, 1]], decade = DECADE_LABELS[bad[, 2]],
                       rebuilt = codes[bad], author = seq_m[bad])
    dir.create(dirname(mismatch_path), showWarnings = FALSE, recursive = TRUE)
    write.csv(mism, mismatch_path, row.names = FALSE)
    stop("A-D rebuild: ", nrow(bad), " of ", n_cells, " cells differ from the sequence files; see ",
         mismatch_path)
  }
  if (file.exists(mismatch_path)) unlink(mismatch_path)
  list(cells = n_cells, mismatches = 0L, counties = nrow(codes),
       by_code = as.list(table(factor(codes, levels = c("A", "B", "C", "D")))))
}
