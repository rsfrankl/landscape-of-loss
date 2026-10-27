import type { County, Mode } from './types';
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
