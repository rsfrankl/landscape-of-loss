import type { AdCode, County, Meta, Mode } from './types';
import { LAST_DECADE } from './types';

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** `top` at `alpha` over an opaque `base`. */
export function mix(base: Rgb, top: Rgb, alpha: number): Rgb {
  return base.map((b, i) => Math.round(b * (1 - alpha) + top[i] * alpha)) as Rgb;
}

export interface Palettes {
  pathway: Map<number, Rgb>;
  ad: Map<AdCode, Rgb>;
  change: Map<number, Rgb>;
}

export function palettes(meta: Meta): Palettes {
  return {
    pathway: new Map(meta.pathways.map((p) => [p.id, hexToRgb(p.color)])),
    ad: new Map(meta.ad.map((a) => [a.code, hexToRgb(a.color)])),
    change: new Map(meta.change.map((c) => [c.id, hexToRgb(c.color)])),
  };
}

/** The legend key a county falls under in a mode, e.g. "p3", "A", "c2". */
export function legendKey(mode: Mode, county: County, decade: number): string {
  switch (mode) {
    case 'pathways':
      return `p${county.pathway}`;
    case 'context':
      return county.seq[decade];
    case 'change':
      return `c${county.cls[decade]}`;
    case 'recent':
      return `c${county.cls[LAST_DECADE]}`;
  }
}

export function dataColor(p: Palettes, mode: Mode, county: County, decade: number): Rgb {
  switch (mode) {
    case 'pathways':
      return p.pathway.get(county.pathway)!;
    case 'context':
      return p.ad.get(county.seq[decade] as AdCode)!;
    case 'change':
      return p.change.get(county.cls[decade])!;
    case 'recent':
      return p.change.get(county.cls[LAST_DECADE])!;
  }
}

export interface Emphasis {
  /** Pathway ids kept by the filter; empty keeps every county. */
  filter: number[];
  /** Legend key under the pointer; other counties dim while it is set. */
  isolate: string | null;
}

export function isDimmed(e: Emphasis, mode: Mode, county: County, decade: number): boolean {
  if (e.filter.length > 0 && !e.filter.includes(county.pathway)) return true;
  if (e.isolate !== null && legendKey(mode, county, decade) !== e.isolate) return true;
  return false;
}
