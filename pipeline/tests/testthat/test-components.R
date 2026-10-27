test_that("drivers are assigned by sign", {
  net <- c(-5, -5, 5, 5)
  natural <- c(3, -3, -8, 2)
  expect_equal(driver_by_sign(net, natural), c("outmig", "both", "natural", "other"))
})

test_that("natural change of exactly 0 counts as natural decrease (Terry County, TX)", {
  expect_equal(driver_by_sign(net = c(9, -4), natural = c(0, 0)), c("natural", "both"))
})

test_that("Table 2 check passes on a match and fails the build on any difference", {
  comp <- data.frame(geoid = c("a", "b"), natural = c(3, -3), net = c(-5, -5), total = c(1, -8))
  paper <- data.frame(outmig = c(1, 0, 0, 0, 1), both = c(1, 0, 0, 0, 1), natural = 0, other = 0,
                      row.names = c(1:4, "total"))
  ok <- check_table2(comp, pathway = c(1, 1), paper)
  expect_equal(ok[c("cells", "mismatches")], list(cells = 20L, mismatches = 0L))
  paper$outmig[c(1, 5)] <- 0
  paper$other[c(1, 5)] <- 1
  expect_error(check_table2(comp, pathway = c(1, 1), paper), "4 of 20 cells")
})
