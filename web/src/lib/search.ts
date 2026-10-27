import type { County } from './types';

/** Accent- and case-insensitive form: "Doña Ana" → "dona ana". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const words = (s: string) => normalize(s).split(/[\s,.'’-]+/).filter(Boolean);

export interface SearchIndex {
  entries: { i: number; words: string[]; pop: number }[];
}

/** Searchable words of "County name, ST" for every county, in county-index order. */
export function buildIndex(counties: County[]): SearchIndex {
  return {
    entries: counties.map((c, i) => ({ i, words: words(`${c.name} ${c.stusps}`), pop: c.pop[c.pop.length - 1] })),
  };
}

/**
 * Top matches for a query (spec 6.8): every query word must start some word of "County name,
 * ST" ("dona ana", "newton ms"). Matches on the first word rank first; then larger counties.
 */
export function search(index: SearchIndex, query: string, limit = 8): number[] {
  const q = words(query);
  if (q.length === 0) return [];
  const hits: { i: number; rank: number; pop: number }[] = [];
  for (const e of index.entries) {
    if (!q.every((w) => e.words.some((x) => x.startsWith(w)))) continue;
    hits.push({ i: e.i, rank: e.words[0].startsWith(q[0]) ? 0 : 1, pop: e.pop });
  }
  hits.sort((a, b) => a.rank - b.rank || b.pop - a.pop);
  return hits.slice(0, limit).map((h) => h.i);
}
