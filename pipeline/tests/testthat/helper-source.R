pipeline_dir <- normalizePath(file.path(testthat::test_path(), "..", ".."))
web_data_dir <- file.path(pipeline_dir, "..", "web", "public", "data")

for (f in list.files(file.path(pipeline_dir, "R"), pattern = "\\.R$", full.names = TRUE)) {
  source(f, local = TRUE)
}

read_web_json <- function(file) {
  path <- file.path(web_data_dir, file)
  testthat::skip_if_not(file.exists(path), paste(file, "not built; run `make data`"))
  jsonlite::read_json(path)
}
