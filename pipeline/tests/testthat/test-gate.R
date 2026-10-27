# Every target that writes to web/public/data/ or docs/ must depend directly on ad_check.

test_that("all output writers are gated on the A-D check", {
  old <- setwd(pipeline_dir)
  on.exit(setwd(old))
  manifest <- targets::tar_manifest(fields = c(name, command))
  edges <- targets::tar_network(targets_only = TRUE)$edges
  writes <- manifest$name[grepl("WEB_DATA|VALIDATION_MD", manifest$command)]
  expect_setequal(writes, c("web_topo", "web_counties", "web_meta", "web_acs", "web_components",
                            "validation_md"))
  for (w in writes) {
    expect_true(any(edges$from == "ad_check" & edges$to == w), info = w)
  }
})

test_that("writers refuse to run without a passing A-D check", {
  expect_error(write_web_json(list(), "x.json", list(mismatches = 3L), tempdir()), "A-D check")
})
