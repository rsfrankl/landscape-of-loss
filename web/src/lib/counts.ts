import type { County, Group, Mode } from './types';
import { legendKey } from './colors';

/** Number of counties under each legend key for a mode and decade. */
export function legendCounts(counties: County[], mode: Mode, decade: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of counties) {
    const k = legendKey(mode, c, decade);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** The 2010–20 breakdown (spec 6.6): for losing and gaining counties, the count in each pathway. */
export function breakdownCounts(counties: County[]): Record<Group, Map<number, number>> {
  const out: Record<Group, Map<number, number>> = { loss: new Map(), growth: new Map() };
  for (const c of counties) {
    const m = out[c.group];
    m.set(c.pathway, (m.get(c.pathway) ?? 0) + 1);
  }
  return out;
}
