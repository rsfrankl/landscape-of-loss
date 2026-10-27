# Output contract: the committed files in web/public/data/ (spec §5, §8.5).

counties <- function() {
  x <- read_web_json("counties.json")
  setNames(x, vapply(x, `[[`, "", "geoid"))
}

test_that("counties.json has 3,108 complete records", {
  cs <- counties()
  expect_length(cs, 3108)
  expect_true(all(vapply(cs, function(r) length(r$pop) == 8 && length(r$pct) == 7 &&
                           length(r$cls) == 7 && length(r$lgr) == 7 && nchar(r$seq) == 7, TRUE)))
  expect_true(all(vapply(cs, function(r) all(unlist(r$cls) %in% 1:5), TRUE)))
  expect_equal(vapply(cs, function(r) r$cls[[7]], 0), vapply(cs, `[[`, 0, "cat1020"), ignore_attr = TRUE)
  lag_ok <- vapply(cs, function(r) is.null(r$lag) || length(r$lag) == 7, TRUE)
  expect_true(all(lag_ok))
  expect_setequal(names(cs)[vapply(cs, function(r) is.null(r$lag), TRUE)], NO_NEIGHBOUR_GEOIDS)
  expect_true(all(vapply(cs, function(r) !is.null(r$rucc23) || !is.null(r$rucc_note), TRUE)))
})

test_that("pathway and 2010-20 counts match the paper", {
  cs <- counties()
  expect_equal(tabulate(vapply(cs, `[[`, 0L, "pathway"), 8), EXPECTED_PATHWAY_N)
  group <- vapply(cs, `[[`, "", "group")
  expect_equal(c(sum(group == "loss"), sum(group == "growth")), c(1637, 1471))
  expect_equal(tabulate(vapply(cs, `[[`, 0L, "cat1020"), 5), EXPECTED_CAT1020_COUNTS)
})

test_that("Barbour County matches the spec's example record", {
  b <- counties()[["01005"]]
  expect_equal(unlist(b$pop), c(28892, 24700, 22543, 24756, 25417, 29038, 27457, 25223))
  expect_equal(round(unlist(b$pct), 1), c(-14.5, -8.7, 9.8, 2.7, 14.2, -5.4, -8.1))
  expect_equal(unlist(b$pct), round(100 * diff(unlist(b$pop)) / head(unlist(b$pop), -1), 3))
  expect_equal(unlist(b$cls), c(5, 4, 3, 3, 2, 4, 4))
  expect_equal(unlist(b$lgr), c(-0.1568, -0.0914, 0.0936, 0.0264, 0.1332, -0.0560, -0.0849))
  expect_equal(unlist(b$lag), c(1.3, 9.7, 0.1, 0.5, 3.7, 5.0, 1.9))
  expect_equal(b$seq, "BBDDDBB")
  expect_equal(b[c("name", "state", "stusps", "pathway", "group", "cat1020")],
               list(name = "Barbour County", state = "Alabama", stusps = "AL", pathway = 1L,
                    group = "loss", cat1020 = 4L))
})

test_that("known edge counties land where the spec says", {
  cs <- counties()
  # Milam TX (-0.012%, so a 1-decimal pct would read 0.0) and Buena Vista VA lose population.
  for (g in c("48331", "51530")) {
    expect_equal(cs[[g]][c("group", "cat1020")], list(group = "loss", cat1020 = 4L), info = g)
    expect_equal(cs[[g]]$cls[[7]], 4, info = g)
    expect_lt(cs[[g]]$pct[[7]], 0)
  }
  expect_equal(cs[["31153"]]$cat1020, 2L)  # Sarpy NE
  expect_equal(cs[["31153"]]$cls[[7]], 2)
  expect_lt(cs[["31153"]]$pct[[7]], 20)
  # 2010 base is the workbook (Bedford County + city), not the GeoPackage's POP_201 (74,872).
  expect_equal(cs[["51019"]]$pop[[7]], 74898)
  expect_equal(cs[["35013"]]$name, "Doña Ana County")
})

test_that("counties.topo.json has counties and states with the spec's properties", {
  path <- file.path(web_data_dir, "counties.topo.json")
  skip_if_not(file.exists(path))
  expect_lt(file.size(path), 1.2e6)
  topo <- jsonlite::read_json(path)
  geoms <- topo$objects$counties$geometries
  expect_setequal(vapply(geoms, `[[`, "", "id"), names(counties()))
  expect_true(all(vapply(geoms, function(g) identical(names(g$properties), c("name", "state", "stusps")), TRUE)))
  expect_length(topo$objects$states$geometries, 49)
})

test_that("meta.json carries the spec palettes and pathway definitions", {
  meta <- read_web_json("meta.json")
  expect_equal(unlist(meta$years), YEARS)
  expect_equal(vapply(meta$pathways, `[[`, "", "color"), PATHWAYS$color)
  expect_equal(vapply(meta$pathways, `[[`, 0L, "n"), EXPECTED_PATHWAY_N)
  expect_equal(vapply(meta$ad, `[[`, "", "color"), AD_STATES$color)
  expect_equal(vapply(meta$change, `[[`, "", "color"),
               c("#2887a1", "#79a7ac", "#b5c8b8", "#d6bd8d", "#a16928"))
})

test_that("components.json drivers reproduce Table 2 exactly", {
  comp <- read_web_json("components.json")
  cs <- counties()
  loss <- names(comp)[vapply(cs[names(comp)], `[[`, "", "group") == "loss"]
  tab <- table(factor(vapply(cs[loss], `[[`, 0L, "pathway"), levels = 1:4),
               factor(vapply(comp[loss], `[[`, "", "driver"), levels = DRIVER_KEYS))
  got <- as.data.frame.matrix(tab)
  got <- rbind(got, total = colSums(got))
  paper <- read_paper_table2(file.path(pipeline_dir, "checks", "paper_table2.csv"))
  expect_equal(as.matrix(got), as.matrix(paper), ignore_attr = TRUE)
})

test_that("acs.json uses the agreed sources, labels and Table 1 values", {
  acs <- read_web_json("acs.json")
  ind <- setNames(acs$indicators, vapply(acs$indicators, `[[`, "", "key"))
  expect_length(ind, 14)
  expect_equal(unname(vapply(ind[c("white_nh", "black_nh", "asian_nh", "hispanic")], `[[`, "", "source")),
               rep("census2020", 4))
  expect_true(all(vapply(ind[setdiff(names(ind), c("white_nh", "black_nh", "asian_nh", "hispanic"))],
                         `[[`, "", "source") == "acs"))
  expect_equal(ind$language_other_than_english$label, "Speaks a language other than English at home")
  expect_equal(ind$bachelors_plus_age25$label, "Bachelor’s degree or higher (age 25+)")
  # Every row except the intended education difference reproduces Table 1 within 0.5 points.
  paper <- read_paper_table1(file.path(pipeline_dir, "checks", "paper_table1.csv"))
  for (k in setdiff(names(ind), "bachelors_plus_age25")) {
    row <- if (k == "language_other_than_english") "english_not_well_or_not_at_all" else k
    ours <- vapply(as.character(1:8), function(p) acs$pathway[[p]][[k]], 0)
    expect_lte(max(abs(ours - paper[row, ])), 0.5 + 1e-9, label = k)
  }
  # Census counts have no sampling error: estimate with a null MOE.
  expect_null(acs$county[["01005"]]$white_nh[[2]])
})

test_that("acs.json and components.json cover every county", {
  acs <- read_web_json("acs.json")
  expect_length(acs$county, 3108)
  expect_setequal(names(acs$pathway), as.character(1:8))
  comp <- read_web_json("components.json")
  expect_length(comp, 3108)
  cs <- counties()
  has_driver <- vapply(names(comp), function(g) !is.null(comp[[g]]$driver), TRUE)
  expect_equal(unname(has_driver), unname(vapply(cs[names(comp)], `[[`, "", "group") == "loss"))
})
