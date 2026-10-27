# Public inputs fetched by the pipeline into pipeline/downloads/ (gitignored). Each file gets a
# provenance sidecar (URL, download time, SHA-256) that validation.md reports.

DOWNLOADS <- list(
  vintage2020 = list(
    url = "https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020-alldata.csv",
    file = "co-est2020-alldata.csv"),
  rucc2013 = list(
    url = "https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53251/ruralurbancodes2013.xls",
    file = "ruralurbancodes2013.xls"),
  rucc2023 = list(
    url = "https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53251/Ruralurbancontinuumcodes2023.xlsx",
    file = "Ruralurbancontinuumcodes2023.xlsx")
)

sha256 <- function(path) {
  out <- system2("shasum", c("-a", "256", shQuote(path)), stdout = TRUE)
  sub(" .*", "", out)
}

# Download once; later runs reuse the file. Delete it from pipeline/downloads/ to refetch.
fetch_download <- function(key, dir = "downloads") {
  spec <- DOWNLOADS[[key]]
  path <- file.path(dir, spec$file)
  sidecar <- paste0(path, ".provenance.json")
  if (!file.exists(path)) {
    dir.create(dir, showWarnings = FALSE, recursive = TRUE)
    tmp <- paste0(path, ".part")
    status <- utils::download.file(spec$url, tmp, mode = "wb", quiet = TRUE)
    if (status != 0) stop("download failed: ", spec$url)
    file.rename(tmp, path)
    jsonlite::write_json(list(url = spec$url, file = spec$file,
                              downloaded = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                              sha256 = sha256(path)),
                         sidecar, auto_unbox = TRUE, pretty = TRUE)
  }
  c(path, sidecar)
}

read_provenance <- function(paths) {
  p <- jsonlite::read_json(paths[2])
  if (!identical(p$sha256, sha256(paths[1]))) {
    stop(paths[1], " no longer matches the SHA-256 recorded when it was downloaded")
  }
  p
}
