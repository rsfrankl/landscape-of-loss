test_that("queen contiguity counts corner contact as neighbours", {
  grid <- sf::st_make_grid(sf::st_bbox(c(xmin = 0, ymin = 0, xmax = 3, ymax = 3)), n = c(3, 3))
  nb <- queen_neighbours(grid)
  expect_equal(lengths(nb), c(3, 5, 3, 5, 8, 5, 3, 5, 3))
  expect_false(any(mapply(function(j, i) i %in% j, nb, seq_along(nb))))
})

test_that("neighbour change is population-weighted, not a mean of percentages", {
  # County 1's neighbours: a big county losing 10% and a small one gaining 50%.
  # Mean of percentages = +20%; weighted = (-100 + 50) / 1100 = -4.5%.
  pop <- matrix(c(500, 1000, 100,
                  510, 900, 150), ncol = 2, dimnames = list(c("i", "j", "k"), c("t0", "t1")))
  lag <- neighbour_lag(pop, list(c(2L, 3L), 1L, integer()))
  expect_equal(lag[1, 1], 100 * -50 / 1100)
  expect_lt(lag[1, 1], 0)
  expect_true(is.na(lag[3, 1]))
})

test_that("A-D codes follow the self/neighbour signs; no neighbours counts as growth", {
  self <- matrix(c(-1, -1, 1, 1, -1, 1), 1)
  lag <- matrix(c(-2, 3, -4, 5, NA, NA), 1)
  expect_equal(as.vector(ad_codes(self, lag)), c("A", "B", "C", "D", "B", "D"))
  expect_equal(as.vector(ad_codes(matrix(0), matrix(0))), "D")
})

test_that("check_ad fails the build on any mismatch and records it", {
  codes <- matrix(c("A", "B", "C", "D", "D", "D", "A"), 1,
                  dimnames = list("01005", DECADE_LABELS))
  seqs <- data.frame(geoid = "01005", group = "loss", seq = "ABCDDDA",
                     `60` = "A", `70` = "B", `80` = "C", `90` = "D", `00` = "D", `10` = "D", `20` = "A",
                     check.names = FALSE)
  out <- tempfile(fileext = ".csv")
  expect_equal(check_ad(codes, seqs, out)$mismatches, 0L)
  seqs$`20` <- "B"
  expect_error(check_ad(codes, seqs, out), "1 of 7 cells")
  expect_equal(read.csv(out)$author, "B")
})
