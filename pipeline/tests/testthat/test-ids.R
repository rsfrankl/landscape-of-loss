test_that("pad_fips zero-pads and rejects junk", {
  expect_equal(pad_fips(c("1001", 6037, "53055")), c("01001", "06037", "53055"))
  expect_error(pad_fips("51-019"))
})

test_that("workbook recode renames Shannon and sums Bedford city into Bedford County", {
  wb <- data.frame(geoid = c("01001", "46113", "51019", "51515"),
                   p1 = c(10, 20, 100, 7), p2 = c(11, 21, 110, 8))
  out <- recode_workbook(wb, c("p1", "p2"))
  expect_setequal(out$geoid, c("01001", "46102", "51019"))
  expect_equal(unlist(out[out$geoid == "51019", c("p1", "p2")], use.names = FALSE), c(107, 118))
  expect_equal(unlist(out[out$geoid == "46102", c("p1", "p2")], use.names = FALSE), c(20, 21))
})

test_that("RUCC 2013 recode drops Bedford city and keeps Bedford County's own code", {
  r <- data.frame(geoid = c("46113", "51019", "51515"), code = c(6L, 2L, 7L))
  out <- recode_rucc2013(r)
  expect_equal(out$geoid, c("46102", "51019"))
  expect_equal(out$code[out$geoid == "51019"], 2L)
})

test_that("inputs on current codes are asserted, not recoded", {
  expect_true(assert_current_codes(c("01001", "46102", "51019"), "x"))
  expect_error(assert_current_codes(c("46102", "46113"), "ACS"), "46113")
  expect_error(assert_current_codes(c("46102", "51515"), "Vintage"), "51515")
  expect_error(assert_current_codes(c("01001"), "x"), "46102")
})

test_that("restrict_one_to_one enforces a 1:1 join", {
  df <- data.frame(geoid = c("b", "a", "z"), v = 1:3)
  expect_equal(restrict_one_to_one(df, c("a", "b"), "x")$geoid, c("a", "b"))
  expect_error(restrict_one_to_one(df, c("a", "c"), "x"), "missing")
  expect_error(restrict_one_to_one(rbind(df, df[1, ]), c("a", "b"), "x"), "duplicate")
  expect_equal(restrict_one_to_one(df, c("a", "c"), "x", allow_missing = "c")$geoid, "a")
})
