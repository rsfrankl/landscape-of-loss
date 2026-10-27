# Geometry for the front end: lon/lat export, mapshaper simplification to TopoJSON,
# per-county label point and bbox (spec §4 step 2).

TOPO_MAX_BYTES <- 1.2e6
SIMPLIFY_START_PCT <- 3
SIMPLIFY_STEP_PCT <- 0.25

read_county_attrs <- function(gpkg) {
  sf::st_read(gpkg, quiet = TRUE,
              query = "SELECT GEOID, STATEFP, NAMELSAD, INTPTLAT, INTPTLON FROM us_counties_typologies")
}

county_names <- function(attrs, universe) {
  a <- restrict_one_to_one(transform(attrs, geoid = pad_fips(GEOID)), universe, "county attributes")
  st <- unique(tidycensus::fips_codes[c("state_code", "state", "state_name")])
  m <- match(a$STATEFP, st$state_code)
  if (anyNA(m)) stop("unknown STATEFP: ", paste(unique(a$STATEFP[is.na(m)]), collapse = ", "))
  data.frame(geoid = a$geoid, statefp = a$STATEFP, name = a$NAMELSAD,
             state = st$state_name[m], stusps = st$state[m],
             label_lon = as.numeric(a$INTPTLON), label_lat = as.numeric(a$INTPTLAT))
}

# Write the unsimplified counties in EPSG:4326 as a shapefile for mapshaper, and return the
# per-county bbox from the same unsimplified geometry.
export_lonlat <- function(geom, names, shp_path) {
  stopifnot(identical(geom$geoid, names$geoid))
  ll <- sf::st_transform(geom["geoid"], 4326)
  bb <- t(vapply(sf::st_geometry(ll), function(g) as.numeric(sf::st_bbox(g)), numeric(4)))
  out <- sf::st_sf(GEOID = names$geoid, name = names$name, state = names$state,
                   stusps = names$stusps, STATEFP = names$statefp, geometry = sf::st_geometry(ll))
  dir.create(dirname(shp_path), showWarnings = FALSE, recursive = TRUE)
  unlink(list.files(dirname(shp_path), full.names = TRUE))
  sf::st_write(out, shp_path, quiet = TRUE, layer_options = "ENCODING=UTF-8")
  list(shp = shp_path,
       bbox = data.frame(geoid = names$geoid, xmin = bb[, 1], ymin = bb[, 2],
                         xmax = bb[, 3], ymax = bb[, 4]))
}

run_mapshaper <- function(shp, out, pct) {
  bin <- file.path("node_modules", ".bin", "mapshaper")
  if (!file.exists(bin)) stop("mapshaper not installed; run `npm install` in pipeline/")
  args <- c("-i", shQuote(shp), "encoding=utf8", "name=counties",
            "-simplify", "weighted", paste0(pct, "%"), "keep-shapes",
            "-clean",
            "-dissolve", "STATEFP", "+", "name=states",
            "-filter-fields", "target=counties", "GEOID,name,state,stusps",
            "-o", shQuote(out), "format=topojson", "quantization=1e5",
            "id-field=GEOID,STATEFP", "target=counties,states")
  log <- system2(bin, args, stdout = TRUE, stderr = TRUE)
  status <- attr(log, "status")
  if (!is.null(status) && status != 0) stop("mapshaper failed:\n", paste(log, collapse = "\n"))
  strip_id_properties(out)
}

# mapshaper keeps the id fields as properties too; the spec's objects carry the id only
# (counties: name, state, stusps; states: none).
strip_id_properties <- function(path) {
  topo <- jsonlite::read_json(path)
  topo$objects$counties$geometries <- lapply(topo$objects$counties$geometries, function(g) {
    g$properties$GEOID <- NULL
    g
  })
  topo$objects$states$geometries <- lapply(topo$objects$states$geometries, function(g) {
    g$properties <- NULL
    g
  })
  jsonlite::write_json(topo, path, auto_unbox = TRUE, digits = NA)
  invisible(path)
}

# Start at the spec's 3% and lower the retained-vertex share until the file fits the budget.
build_topojson <- function(shp, out) {
  pct <- SIMPLIFY_START_PCT
  repeat {
    run_mapshaper(shp, out, pct)
    bytes <- file.size(out)
    if (bytes < TOPO_MAX_BYTES) break
    pct <- pct - SIMPLIFY_STEP_PCT
    if (pct <= 0) stop("cannot simplify TopoJSON under ", TOPO_MAX_BYTES, " bytes")
  }
  topo <- jsonlite::read_json(out)
  ids <- vapply(topo$objects$counties$geometries, function(g) g$id, "")
  list(path = out, simplify_pct = pct, bytes = bytes,
       n_counties = length(ids), n_states = length(topo$objects$states$geometries), ids = ids)
}

assert_topojson <- function(topo, universe) {
  if (!setequal(topo$ids, universe) || anyDuplicated(topo$ids)) {
    stop("TopoJSON counties do not match the 3,108 study counties")
  }
  if (topo$n_states != 49) stop("expected 49 state objects (48 + DC), got ", topo$n_states)
  invisible(TRUE)
}
