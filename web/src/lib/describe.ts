import type { AdCode, County, Meta, Mode } from './types';
import { LAST_DECADE } from './types';
import { formatLag, formatPct } from './format';

export function countyTitle(c: County): string {
  return `${c.name}, ${c.stusps}`;
}

/** Spatial-context line, e.g. "2000–10: B · county −5.4%, neighbours +5.0%". */
export function contextLine(meta: Meta, c: County, decade: number): string {
  const letter = c.seq[decade] as AdCode;
  const self = formatPct(c.pct[decade], c.cls[decade]);
  const nb = c.lag === null ? 'no neighbours' : `neighbours ${formatLag(c.lag[decade], letter)}`;
  return `${meta.decades[decade].label}: ${letter} · county ${self}, ${nb}`;
}

/** Third tooltip line, by mode (spec 6.4). */
export function modeLine(meta: Meta, mode: Mode, c: County, decade: number): string {
  const last = meta.decades[LAST_DECADE].label;
  switch (mode) {
    case 'pathways':
      return `${last} change: ${formatPct(c.pct[LAST_DECADE], c.cls[LAST_DECADE])}`;
    case 'context':
      return contextLine(meta, c, decade);
    case 'change':
      return `${meta.decades[decade].label}: ${formatPct(c.pct[decade], c.cls[decade])}`;
    case 'recent':
      return `${formatPct(c.pct[LAST_DECADE], c.cls[LAST_DECADE])}, ${last}`;
  }
}

export function mapLabel(meta: Meta, mode: Mode, decade: number): string {
  const d = meta.decades[decade].label;
  switch (mode) {
    case 'pathways':
      return 'Map of U.S. counties coloured by population-change pathway, 1950–2020';
    case 'context':
      return `Map of U.S. counties coloured by spatial context of population change, ${d}`;
    case 'change':
      return `Map of U.S. counties coloured by population change, ${d}`;
    case 'recent':
      return `Map of U.S. counties coloured by population change, ${meta.decades[LAST_DECADE].label}`;
  }
}
