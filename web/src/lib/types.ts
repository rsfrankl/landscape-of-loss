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

/** Map modes; the ids are the URL `mode` values (spec 6.9). */
export type Mode = 'change' | 'context' | 'pathways';

/** In tab order (spec 6.2). */
export const MODES: { id: Mode; label: string; usesDecade: boolean }[] = [
  { id: 'change', label: 'Decadal population change', usesDecade: true },
  { id: 'context', label: 'Decadal population change in spatial context', usesDecade: true },
  { id: 'pathways', label: 'Population change trajectories', usesDecade: false },
];

/** Index of 2010–20 in the decade arrays. */
export const LAST_DECADE = 6;
