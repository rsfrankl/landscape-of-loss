import type { AdCode, AdState, County, Meta, Mode } from './types';
import { LAST_DECADE } from './types';
import { formatCount, truncate1 } from './format';

export function countyTitle(c: County): string {
  return `${c.name}, ${c.stusps}`;
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

/** "grew 1.7%" / "lost less than 0.1%": the county's change in a decade. */
function selfClause(c: County, decade: number): Segment[] {
  return [{ text: `${selfVerb(c, decade)} ` }, ...amount(c.pct[decade])];
}

/** "grew"/"lost" for the neighbors combined, from the A–D letter (A and C: neighbors lost). */
function neighborVerb(c: County, decade: number): string {
  const letter = c.seq[decade];
  return letter === 'A' || letter === 'C' ? 'lost' : 'grew';
}

/**
 * Profile block 4 (spec 6.5): "Newton County grew 1.7% while its neighboring counties together
 * lost 0.6%."
 */
export function decadeSentence(c: County, decade: number): Segment[] {
  const self: Segment[] = [{ text: `${c.name} ` }, ...selfClause(c, decade)];
  if (c.lag === null) return [...self, { text: '; it has no neighboring counties.' }];
  return [
    ...self,
    { text: ` while its neighboring counties together ${neighborVerb(c, decade)} ` },
    ...amount(c.lag[decade]),
    { text: '.' },
  ];
}

/** Profile block 5: "Newton County lost 1.9%." */
export function recentSentence(c: County): Segment[] {
  return [{ text: `${c.name} ` }, ...selfClause(c, LAST_DECADE), { text: '.' }];
}

export function adState(meta: Meta, c: County, decade: number): AdState {
  return meta.ad.find((a) => a.code === (c.seq[decade] as AdCode))!;
}

/**
 * Sequence-strip cell explanation (spec 6.5 block 3): the decade, the state's arrows and name,
 * then the decade's sentence. Counties without neighbors are counted as "neighbors grew".
 */
export function stripCaption(meta: Meta, c: County, decade: number): { decade: string; state: AdState; note: string; sentence: Segment[] } {
  return {
    decade: meta.decades[decade].label,
    state: adState(meta, c, decade),
    note: c.lag === null ? ' (no neighboring counties; counted as neighbors grew)' : '',
    sentence: decadeSentence(c, decade),
  };
}

/** Plain-text form of a strip caption, for labels: "2000–10: Localized loss. Barbour County lost …" */
export function stripCaptionText(meta: Meta, c: County, decade: number): string {
  const k = stripCaption(meta, c, decade);
  return `${k.decade}: ${k.state.label}${k.note}. ${sentenceText(k.sentence)}`;
}

/** A tooltip line: an optional swatch (the county's fill in the current mode), then text. */
export interface TipLine {
  swatch?: { color: string; round: boolean };
  segs: Segment[];
}

/**
 * Tooltip lines after the county name (spec 6.4). Exactly one swatch, matching the county's fill
 * in the current mode; every line starts with its time frame.
 */
export function tooltipLines(meta: Meta, mode: Mode, c: County, decade: number): TipLine[] {
  const pathway = meta.pathways[c.pathway - 1];
  const span = `${meta.years[0]}–${meta.years[meta.years.length - 1]}`;
  const pathwayText = `${span} pathway: ${pathway.name}`;
  const d = meta.decades[decade].label;
  switch (mode) {
    case 'pathways':
      return [
        { swatch: { color: pathway.color, round: true }, segs: [{ text: pathwayText }] },
        { segs: [{ text: `${meta.decades[LAST_DECADE].label}: ` }, ...selfClause(c, LAST_DECADE)] },
      ];
    case 'context': {
      const neighbors: Segment[] =
        c.lag === null
          ? [{ text: '; it has no neighboring counties' }]
          : [{ text: `; neighboring counties together ${neighborVerb(c, decade)} ` }, ...amount(c.lag[decade])];
      return [
        { swatch: { color: adState(meta, c, decade).color, round: false }, segs: [{ text: `${d}: ` }, ...selfClause(c, decade), ...neighbors] },
        { segs: [{ text: pathwayText }] },
      ];
    }
    case 'change':
      return [
        { swatch: { color: meta.change.find((k) => k.id === c.cls[decade])!.color, round: false }, segs: [{ text: `${d}: ` }, ...selfClause(c, decade)] },
        { segs: [{ text: pathwayText }] },
      ];
  }
}

/** "21,291 people (2020) · Nonmetro" */
export function populationLine(meta: Meta, c: County): string {
  const year = meta.years[meta.years.length - 1];
  return `${formatCount(c.pop[c.pop.length - 1])} people (${year}) · ${c.metro ? 'Metro' : 'Nonmetro'}`;
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
