test_that("change classes use exact breaks", {
  x <- c(20, 19.997, 10, 9.99, 0, -0.05, -9.99, -10, -25)
  expect_equal(bin_change(x), c(1L, 2L, 2L, 3L, 3L, 4L, 4L, 5L, 5L))
  m <- matrix(c(25, -10, 0, 5), 2)
  expect_equal(dim(bin_change(m)), c(2L, 2L))
})

test_that("decadal change matches the spec's Barbour County example", {
  pop <- matrix(c(28892, 24700, 22543, 24756, 25417, 29038, 27457, 25223), 1,
                dimnames = list("01005", YEARS))
  expect_equal(unname(round(pct_change(pop)[1, ], 1)), c(-14.5, -8.7, 9.8, 2.7, 14.2, -5.4, -8.1))
  expect_equal(unname(round(log_growth(pop)[1, ], 4)),
               c(-0.1568, -0.0914, 0.0936, 0.0264, 0.1332, -0.0560, -0.0849))
})

test_that("decade labels run 1950-60 to 2010-20, with the century written out", {
  expect_equal(DECADE_LABELS,
               c("1950–60", "1960–70", "1970–80", "1980–90",
                 "1990–2000", "2000–10", "2010–20"))
})

test_that("2010-20 class counts are asserted", {
  ok <- rep(1:5, EXPECTED_CAT1020_COUNTS)
  expect_equal(assert_cat1020_counts(ok), EXPECTED_CAT1020_COUNTS)
  expect_error(assert_cat1020_counts(ok[-1]), "class counts")
})
