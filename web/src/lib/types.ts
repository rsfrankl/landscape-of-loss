// Shapes of the pipeline outputs in public/data (spec 5).

export type Group = 'loss' | 'growth';
export type AdCode = 'A' | 'B' | 'C' | 'D';

export interface Decade {
  start: number;
  end: number;
  label: string;
}

export interface Pathway {
  id: number;
  name: string;
  group: Group;
  n: number;
  color: string;
  blurb: string;
}

export interface AdState {
  code: AdCode;
  label: string;
  color: string;
}

export interface ChangeClass {
  id: number;
  label: string;
  min: number | null;
  max: number | null;
  includeMin: boolean;
  includeMax: boolean;
  color: string;
}

export interface Meta {
  years: number[];
  decades: Decade[];
  pathways: Pathway[];
  ad: AdState[];
  change: ChangeClass[];
  citation: {
    authors: string[];
    year: number;
    title: string;
    journal: string;
    doi: string;
    url: string;
    text: string;
  };
  notes: Record<string, string>;
  validation: { adCells: number; adMismatches: number };
}

export interface County {
  geoid: string;
  name: string;
  state: string;
  stusps: string;
  pathway: number;
  group: Group;
  /** A–D state per decade, e.g. "BBDDDBB". */
  seq: string;
  /** One count per meta.years entry. */
  pop: number[];
  /** Decadal % change, 3 decimals. Display only; never classify from it. */
  pct: number[];
  /** Change class (1–5) per decade, binned upstream on unrounded values. */
  cls: number[];
  lgr: number[];
  /** Neighbours' population-weighted % change per decade; null when the county has no neighbours. */
  lag: number[] | null;
  cat1020: number;
  rucc13: number;
  rucc23: number | null;
  metro: boolean;
  rucc_note: string | null;
  label: [number, number];
  bbox: [number, number, number, number];
}

export type Mode = 'pathways' | 'context' | 'change' | 'recent';

export const MODES: { id: Mode; label: string; usesDecade: boolean }[] = [
  { id: 'pathways', label: 'Pathways', usesDecade: false },
  { id: 'context', label: 'Spatial context', usesDecade: true },
  { id: 'change', label: 'Population change', usesDecade: true },
  { id: 'recent', label: '2010–20 vs. 70 years', usesDecade: false },
];

/** Index of 2010–20 in the decade arrays. */
export const LAST_DECADE = 6;
