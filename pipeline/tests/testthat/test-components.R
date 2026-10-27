test_that("sign-rule drivers", {
  net <- c(-5, -5, 5, 5)
  natural <- c(3, -3, -8, 2)
  expect_equal(driver_sign_only(net, natural), c("outmig", "both", "natural", "other"))
})

test_that("natural change of exactly 0 counts as natural decrease (Terry County, TX)", {
  expect_equal(driver_sign_only(net = c(9, -4), natural = c(0, 0)), c("natural", "both"))
})

test_that("total-first rule makes estimated growth 'other' before the sign rules", {
  # Net out-migration but estimated total change >= 0: total-first says "other".
  expect_equal(driver_total_first(net = -5, natural = 3, total = 1), "other")
  expect_equal(driver_sign_only(net = -5, natural = 3), "outmig")
  expect_equal(driver_total_first(net = -5, natural = 3, total = 0), "other")
  expect_equal(driver_total_first(net = c(-5, 5), natural = c(-3, -8), total = c(-8, -3)),
               c("both", "natural"))
})

test_that("Table 2 comparison reports both rules", {
  comp <- data.frame(geoid = c("a", "b"), natural = c(3, -3), net = c(-5, -5), total = c(1, -8))
  paper <- data.frame(outmig = c(1, 0, 0, 0, 1), both = c(1, 0, 0, 0, 1), natural = 0, other = 0,
                      row.names = c(1:4, "total"))
  res <- compare_table2(comp, pathway = c(1, 1), paper)
  expect_equal(res$sign_only$abs_diff, 0)
  expect_equal(res$total_first$abs_diff, 4)
})
