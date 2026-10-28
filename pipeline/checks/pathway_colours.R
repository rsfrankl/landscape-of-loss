# Colour-vision options for the pathway palette (spec 7 and 8.6): the author decides; the
# palette in meta.json is unchanged. Same method as the 27 Oct change-palette re-check:
# colorspace simulation (Machado 2009, severity 1) and farver CIEDE2000.
# Run from pipeline/: Rscript checks/pathway_colours.R  (writes ../docs/pathway-colours.svg)
suppressPackageStartupMessages({ library(colorspace); library(farver) })

names8 <- c("Emerging Localized Loss", "Isolated Loss", "Persistent Loss", "Punctuated Regionalized Loss",
            "Constant Growth", "Localized Recovery and Regional Growth", "Punctuated Growth", "Emerging Growth")
current <- c("#6388b4", "#ffae34", "#ef6f6a", "#00a86b", "#8cc2ca", "#e5e522", "#bb7693", "#8cd17d")
sims <- list(normal = identity, deutan = function(x) deutan(x, 1), protan = function(x) protan(x, 1),
             tritan = function(x) tritan(x, 1))

de_matrix <- function(pal, sim) {
  lab <- decode_colour(sims[[sim]](pal))
  compare_colour(lab, lab, from_space = "rgb", method = "cie2000")
}
overall_min <- function(pal) min(sapply(names(sims), function(s) { m <- de_matrix(pal, s); min(m[upper.tri(m)]) }))

# Every pair under `below`, weakest first.
low_pairs <- function(pal, below = 12) {
  out <- NULL
  for (s in names(sims)) {
    m <- de_matrix(pal, s)
    for (i in 1:7) for (j in (i + 1):8) if (m[i, j] < below)
      out <- rbind(out, data.frame(sim = s, pair = sprintf("%d %s / %d %s", i, names8[i], j, names8[j]),
                                   dE = round(m[i, j], 1)))
  }
  out[order(out$dE), ]
}

# Lightness shift in HCL, keeping hue and chroma where in gamut.
shift <- function(hex, dL) {
  h <- coords(as(hex2RGB(hex), "polarLUV"))
  L <- h[, "L"] + dL
  if (L < 5 || L > 97) return(NA_character_)
  tolower(hcl(h = h[, "H"], c = h[, "C"], l = L, fixup = TRUE))
}

# Joint search: change one colour in each of the three named pairs (8 choices) by -36..+36 L in
# steps of 4; report the palettes with the highest worst-pair ΔE, cheapest first.
search_lightness <- function() {
  steps <- seq(-36, 36, by = 4)
  res <- list()
  for (a in c(2, 6)) for (b in c(3, 4)) for (c8 in c(5, 8)) {
    for (da in steps) for (db in steps) for (dc in steps) {
      x <- c(shift(current[a], da), shift(current[b], db), shift(current[c8], dc))
      if (anyNA(x)) next
      p <- replace(current, c(a, b, c8), x)
      res[[length(res) + 1]] <- data.frame(changed = paste(a, b, c8), dL = paste(da, db, dc),
                                           cost = abs(da) + abs(db) + abs(dc), min = round(overall_min(p), 2),
                                           colours = paste(x, collapse = " "))
    }
  }
  r <- do.call(rbind, res)
  head(r[order(-r$min, r$cost), ], 5)
}

options <- list(
  "A. Unchanged (paper's Fig. 8)" = current,
  "B. Three lightness nudges" = replace(current, c(2, 3, 8), c("#f3a31a", "#c0433d", "#aef3a0")),
  "C. As B, but darken 4 Punctuated Regionalized Loss instead of 3 Persistent Loss" =
    replace(current, c(2, 4, 8), c("#f3a31a", "#007e40", "#aef3a0")))

for (nm in names(options)) {
  cat("\n==", nm, "\n  ", paste(options[[nm]], collapse = " "), "\n")
  print(low_pairs(options[[nm]]), row.names = FALSE)
}
cat("\nBest lightness-only palettes (joint search):\n")
print(search_lightness(), row.names = FALSE)

# Swatch sheet: each option under normal vision and the three simulations.
write_svg <- function(path) {
  sw <- 26; gap <- 4; colw <- 8 * sw + 7 * gap; left <- 12; top <- 46; rowh <- 84
  w <- left + 4 * (colw + 24); h <- top + length(options) * rowh + 150
  out <- c(sprintf('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Jost, Helvetica Neue, Helvetica, sans-serif" font-size="13">', w, h),
           sprintf('<rect width="%d" height="%d" fill="#fbfbfb"/>', w, h))
  heads <- c("Normal vision", "Deuteranopia", "Protanopia", "Tritanopia")
  for (k in seq_along(sims)) out <- c(out, sprintf('<text x="%d" y="28" fill="#2e2420" font-weight="bold">%s</text>', left + (k - 1) * (colw + 24), heads[k]))
  for (r in seq_along(options)) {
    y <- top + (r - 1) * rowh
    out <- c(out, sprintf('<text x="12" y="%d" fill="#1a1210" font-weight="bold">%s</text>', y + 14, names(options)[r]))
    y <- y + 24
    for (k in seq_along(sims)) {
      cols <- sims[[k]](options[[r]])
      for (i in 1:8) {
        x <- left + (k - 1) * (colw + 24) + (i - 1) * (sw + gap)
        out <- c(out, sprintf('<rect x="%d" y="%d" width="%d" height="%d" rx="3" fill="%s"/>', x, y, sw, sw, cols[i]),
                 sprintf('<text x="%d" y="%d" text-anchor="middle" fill="#7a6c68" font-size="11">%d</text>', x + sw / 2, y + sw + 14, i))
      }
    }
  }
  y <- top + length(options) * rowh + 16
  for (i in 1:8) out <- c(out, sprintf('<text x="12" y="%d" fill="#7a6c68" font-size="12">%d %s</text>', y + (i - 1) * 16, i, names8[i]))
  writeLines(c(out, "</svg>"), path)
}
write_svg("../docs/pathway-colours.svg")
