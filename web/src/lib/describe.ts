import type { AdCode, County, Meta, Mode } from './types';
import { LAST_DECADE } from './types';
import { formatLag, formatPct } from './format';

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
 * own % is not shown in this mode.
 */
export function contextLines(meta: Meta, c: County, decade: number): Line[] {
  const letter = c.seq[decade] as AdCode;
  const state = meta.ad.find((a) => a.code === letter)!;
  const label = `Neighboring counties’ population change (${meta.decades[decade].label})`;
  return [
    { label: state.label, color: state.color },
    c.lag === null ? { label, value: 'no neighboring counties' } : { label, value: formatLag(c.lag[decade], letter) },
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
