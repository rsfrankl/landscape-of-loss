import type { County } from './types';

// Similar counties (spec 6.7), the one derived feature: the counties whose decade-by-decade
// log growth rates lie closest to the selected county's. Computed at selection time; no matrix.

export interface SimilarOptions {
  /** Any pathway; otherwise only the selected county's pathway. */
  any: boolean;
  /** 2020 population between 0.5× and 2× the selected county's. */
  size: boolean;
  /** Same metro status (2023 RUCC, 2013 fallback). */
  metro: boolean;
}

export const DEFAULT_SIMILAR: SimilarOptions = { any: false, size: false, metro: false };

export interface Match {
  /** County index (TopoJSON order). */
  index: number;
  /** Euclidean distance between the `lgr` vectors. */
  distance: number;
}

/** Up to `k` closest counties to county `i`, nearest first, ties broken by GEOID. */
export function similarCounties(counties: County[], i: number, opts: SimilarOptions, k = 5): Match[] {
  const self = counties[i];
  const last = self.pop.length - 1;
  const pop = self.pop[last];
  const out: Match[] = [];
  for (let j = 0; j < counties.length; j++) {
    if (j === i) continue;
    const c = counties[j];
    if (!opts.any && c.pathway !== self.pathway) continue;
    if (opts.size && (c.pop[last] < 0.5 * pop || c.pop[last] > 2 * pop)) continue;
    if (opts.metro && c.metro !== self.metro) continue;
    let d2 = 0;
    for (let t = 0; t < self.lgr.length; t++) {
      const e = c.lgr[t] - self.lgr[t];
      d2 += e * e;
    }
    out.push({ index: j, distance: Math.sqrt(d2) });
  }
  out.sort((a, b) => a.distance - b.distance || (counties[a.index].geoid < counties[b.index].geoid ? -1 : 1));
  return out.slice(0, k);
}
