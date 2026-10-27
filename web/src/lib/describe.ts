import type { AdCode, County, Meta, Mode } from './types';
import { LAST_DECADE } from './types';
import { formatCount, formatLag, formatPct, truncate1 } from './format';

/** One line of tooltip or panel text: a label, an optional value (set in mono) and swatch. */
export interface Line {
  label: string;
  value?: string;
  color?: string;
}

export function countyTitle(c: County): string {
  return `${c.name}, ${c.stusps}`;
}

/** "Recent population change (2010–20): −8.1%" */
export function recentLine(meta: Meta, c: County): Line {
  return {
    label: `Recent population change (${meta.decades[LAST_DECADE].label})`,
    value: formatPct(c.pct[LAST_DECADE], c.cls[LAST_DECADE]),
  };
}

/** "Population change (1980–90): −4.2%" */
export function changeLine(meta: Meta, c: County, decade: number): Line {
  return {
    label: `Population change (${meta.decades[decade].label})`,
    value: formatPct(c.pct[decade], c.cls[decade]),
  };
}

/**
 * The A–D category in words, then only the neighbors' population-weighted change; the county's
 * own % is not shown in this mode. Counties with no neighbors (always B or D) get one line saying
 * so instead of the standard label.
 */
export function contextLines(meta: Meta, c: County, decade: number): Line[] {
  const letter = c.seq[decade] as AdCode;
  const state = meta.ad.find((a) => a.code === letter)!;
  if (c.lag === null) {
    const self = letter === 'B' ? 'loss' : 'growth';
    return [
      { label: `Self population ${self}; no neighboring counties (counted as neighbor growth)`, color: state.color },
    ];
  }
  return [
    { label: state.label, color: state.color },
    {
      label: `Neighboring counties’ population change (${meta.decades[decade].label})`,
      value: formatLag(c.lag[decade], letter),
    },
  ];
}

/** Tooltip lines after the name and pathway, by mode (spec 6.4). */
export function modeLines(meta: Meta, mode: Mode, c: County, decade: number): Line[] {
  switch (mode) {
    case 'pathways':
      return [recentLine(meta, c)];
    case 'context':
      return contextLines(meta, c, decade);
    case 'change':
      return [changeLine(meta, c, decade)];
  }
}

/** A profile sentence: plain text with the numbers marked so they can be set in mono. */
export type Segment = { text: string; num?: true };

export function sentenceText(s: Segment[]): string {
  return s.map((x) => x.text).join('');
}

/** An unsigned amount, truncated to 1 decimal; "less than 0.1%" when that truncates to zero. */
function amount(x: number): Segment[] {
  const t = Math.abs(truncate1(x));
  return t === 0 ? [{ text: 'less than ' }, { text: '0.1%', num: true }] : [{ text: `${t.toFixed(1)}%`, num: true }];
}

/** "grew" or "lost", from the change class so it always agrees with the map. */
function selfVerb(c: County, decade: number): string {
  return c.cls[decade] >= 4 ? 'lost' : 'grew';
}

/**
 * Profile block 4 (spec 6.5): "Newton County grew 1.7% while its neighboring counties together
 * lost 0.6%." The neighbors' verb comes from the A–D letter (A and C: neighbors lost).
 */
export function decadeSentence(c: County, decade: number): Segment[] {
  const self: Segment[] = [{ text: `${c.name} ${selfVerb(c, decade)} ` }, ...amount(c.pct[decade])];
  if (c.lag === null) return [...self, { text: '; it has no neighboring counties.' }];
  const letter = c.seq[decade];
  const nb = letter === 'A' || letter === 'C' ? 'lost' : 'grew';
  return [...self, { text: ` while its neighboring counties together ${nb} ` }, ...amount(c.lag[decade]), { text: '.' }];
}

/** Profile block 5: "Newton County lost 1.9%." */
export function recentSentence(c: County): Segment[] {
  return [{ text: `${c.name} ${selfVerb(c, LAST_DECADE)} ` }, ...amount(c.pct[LAST_DECADE]), { text: '.' }];
}

/** Sequence-strip cell explanation: "2000–10 · Self population loss, neighbor population growth". */
export function stripCaption(meta: Meta, c: County, decade: number): string {
  return `${meta.decades[decade].label} · ${contextLines(meta, c, decade)[0].label}`;
}

/** "21,291 people (2020) · Nonmetro" */
export function populationLine(meta: Meta, c: County): string {
  const year = meta.years[meta.years.length - 1];
  return `${formatCount(c.pop[c.pop.length - 1])} people (${year}) · ${c.metro ? 'Metro' : 'Nonmetro'}`;
}

export function lineText(l: Line): string {
  return l.value === undefined ? l.label : `${l.label}: ${l.value}`;
}

export function mapLabel(meta: Meta, mode: Mode, decade: number): string {
  const d = meta.decades[decade].label;
  switch (mode) {
    case 'pathways':
      return 'Map of US counties colored by population change pathway, 1950–2020';
    case 'context':
      return `Map of US counties colored by population change in spatial context, ${d}`;
    case 'change':
      return `Map of US counties colored by population change, ${d}`;
  }
}
