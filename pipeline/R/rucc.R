# Rural-Urban Continuum Codes, 2013 and 2023 (spec §4 step 9).

CT_RUCC_NOTE <- paste(
  "RUCC 2023 codes Connecticut by planning region, not county;",
  "the 2013 code is used for metro status.")

read_rucc <- function(path, code_col) {
  r <- readxl::read_excel(path)
  r <- r[!is.na(r$FIPS), ]
  data.frame(geoid = pad_fips(r$FIPS), code = as.integer(r[[code_col]]))
}

# metro = RUCC 1-3, from 2023 where it exists, else 2013 with a note (Connecticut).
build_rucc <- function(rucc13_path, rucc23_path, names, universe) {
  r13 <- restrict_one_to_one(recode_rucc2013(read_rucc(rucc13_path, "RUCC_2013")), universe,
                             "RUCC 2013")
  r23_all <- read_rucc(rucc23_path, "RUCC_2023")
  assert_current_codes(r23_all$geoid, "RUCC 2023")
  ct <- names$geoid[names$statefp == "09"]
  r23 <- restrict_one_to_one(r23_all, universe, "RUCC 2023", allow_missing = ct)
  out <- data.frame(geoid = universe,
                    rucc13 = r13$code[match(universe, r13$geoid)],
                    rucc23 = r23$code[match(universe, r23$geoid)])
  stopifnot(!anyNA(out$rucc13), all(out$rucc13 %in% 1:9), all(out$rucc23 %in% c(1:9, NA)))
  fallback <- is.na(out$rucc23)
  if (!setequal(out$geoid[fallback], ct)) stop("RUCC 2023 gaps outside Connecticut")
  out$metro <- ifelse(fallback, out$rucc13, out$rucc23) <= 3
  out$rucc_note <- ifelse(fallback, CT_RUCC_NOTE, NA_character_)
  out
}
