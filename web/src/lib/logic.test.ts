import { describe, expect, it } from 'vitest';
import metaJson from '../../public/data/meta.json';
import countiesJson from '../../public/data/counties.json';
import topoJson from '../../public/data/counties.topo.json';
import componentsJson from '../../public/data/components.json';
import type { AdCode, Components, County, Meta } from './types';
import { LAST_DECADE } from './types';
import { changeClass, formatLag, formatPct, truncate1 } from './format';
import { dataColor, hexToRgb, isDimmed, legendKey, mix, palettes } from './colors';
import { legendCounts } from './counts';
import { decodePick, pickCandidates, pickColor } from './picking';
import { alignCounties, type CountyTopology } from './data';
import {
  contextLines,
  decadeSentence,
  lineText,
  modeLines,
  populationLine,
  recentSentence,
  sentenceText,
  stripCaption,
  type Segment,
} from './describe';
import { DEFAULT_STATE, parseUrl, toSearch } from './url';
import { axisEnd, driverSentence, driverShares } from './profile';
import { buildIndex, search } from './search';
import { countyAt } from './locate';

const meta = metaJson as unknown as Meta;
const counties = alignCounties(topoJson as unknown as CountyTopology, countiesJson as unknown as County[]);
const byId = new Map(counties.map((c) => [c.geoid, c]));
const county = (g: string) => byId.get(g)!;

describe('truncation and formatting', () => {
  it('truncates toward zero, never rounds', () => {
    expect(truncate1(19.997)).toBe(19.9);
    expect(truncate1(19.9)).toBe(19.9);
    expect(truncate1(-9.983)).toBe(-9.9);
    expect(truncate1(2.67)).toBe(2.6);
    expect(Math.abs(truncate1(-0.012))).toBe(0);
  });

  it('takes the sign of a zero from the class or the A–D letter', () => {
    expect(formatPct(-0.012, 4)).toBe('−0.0%');
    expect(formatPct(0, 3)).toBe('+0.0%');
    expect(formatPct(19.99, 2)).toBe('+19.9%');
    expect(formatLag(0, 'A')).toBe('−0.0%');
    expect(formatLag(0, 'B')).toBe('+0.0%');
    expect(formatLag(5, 'D')).toBe('+5.0%');
  });

  it('truncates the neighbors’ change rather than rounding it', () => {
    // Newton MS 1980–90: neighbors at −0.660 read −0.6, not −0.7.
    const newton = county('28101');
    expect(newton.lag![3]).toBe(-0.66);
    expect(formatLag(newton.lag![3], newton.seq[3] as AdCode)).toBe('−0.6%');
    expect(formatLag(-0.004, 'A')).toBe('−0.0%');
  });
});

describe('change classes', () => {
  it('uses the exact breaks', () => {
    expect(changeClass(20, meta.change)).toBe(1);
    expect(changeClass(19.97, meta.change)).toBe(2);
    expect(changeClass(10, meta.change)).toBe(2);
    expect(changeClass(0, meta.change)).toBe(3);
    expect(changeClass(-0.03, meta.change)).toBe(4);
    expect(changeClass(-10, meta.change)).toBe(5);
  });

  it('cls agrees with the class rebuilt from pop in every county-decade', () => {
    let cells = 0;
    for (const c of counties) {
      for (let d = 0; d < meta.decades.length; d++) {
        const exact = (100 * (c.pop[d + 1] - c.pop[d])) / c.pop[d];
        expect(c.cls[d], `${c.geoid} decade ${d}`).toBe(changeClass(exact, meta.change));
        cells++;
      }
      expect(c.cls[LAST_DECADE]).toBe(c.cat1020);
    }
    expect(cells).toBe(21756);
  });

  it('every displayed value falls inside its own class', () => {
    for (const c of counties) {
      for (let d = 0; d < meta.decades.length; d++) {
        const shown = parseFloat(formatPct(c.pct[d], c.cls[d]).replace('−', '-'));
        const negative = formatPct(c.pct[d], c.cls[d]).startsWith('−');
        // A shown −0.0 is a loss of under 0.05%; check it against class 4 directly.
        const probe = negative && shown === 0 ? -0.01 : shown;
        expect(changeClass(probe, meta.change), `${c.geoid} decade ${d}`).toBe(c.cls[d]);
      }
    }
  });

  it('places the spec edge counties correctly', () => {
    expect(county('31153').cls[LAST_DECADE]).toBe(2);
    expect(formatPct(county('31153').pct[LAST_DECADE], 2)).toBe('+19.9%');
    for (const g of ['48331', '51530']) {
      expect(county(g).cls[LAST_DECADE]).toBe(4);
      expect(formatPct(county(g).pct[LAST_DECADE], 4).startsWith('−')).toBe(true);
    }
  });
});

describe('legend counts', () => {
  it('pathway counts match the paper', () => {
    const n = legendCounts(counties, 'pathways', 0);
    expect(meta.pathways.map((p) => n.get(`p${p.id}`))).toEqual([557, 126, 442, 512, 949, 141, 312, 69]);
    expect(meta.pathways.map((p) => p.n)).toEqual([557, 126, 442, 512, 949, 141, 312, 69]);
  });

  it('2010–20 splits 1,637 losing and 1,471 gaining', () => {
    const n = legendCounts(counties, 'change', LAST_DECADE);
    const lost = (n.get('c4') ?? 0) + (n.get('c5') ?? 0);
    expect(lost).toBe(1637);
    expect(counties.length - lost).toBe(1471);
  });

  it('A–D counts per decade sum to 3,108', () => {
    for (let d = 0; d < 7; d++) {
      const n = legendCounts(counties, 'context', d);
      expect([...n.values()].reduce((a, b) => a + b, 0)).toBe(3108);
    }
  });
});

describe('colours', () => {
  const p = palettes(meta);

  it('come from meta.json', () => {
    const barbour = county('01005');
    expect(dataColor(p, 'pathways', barbour, 0)).toEqual(hexToRgb(meta.pathways[0].color));
    expect(dataColor(p, 'context', barbour, 5)).toEqual(hexToRgb(meta.ad[1].color)); // B
    expect(dataColor(p, 'change', barbour, LAST_DECADE)).toEqual(hexToRgb(meta.change[3].color));
    expect(legendKey('change', barbour, 4)).toBe('c2');
  });

  it('dim by filter and by legend isolation', () => {
    const barbour = county('01005');
    expect(isDimmed({ filter: [], isolate: null }, 'pathways', barbour, 0)).toBe(false);
    expect(isDimmed({ filter: [3], isolate: null }, 'context', barbour, 0)).toBe(true);
    expect(isDimmed({ filter: [1], isolate: 'B' }, 'context', barbour, 5)).toBe(false);
    expect(isDimmed({ filter: [], isolate: 'A' }, 'context', barbour, 5)).toBe(true);
  });

  it('mixes a colour over the background', () => {
    expect(mix([251, 251, 251], [122, 108, 104], 0.25)).toEqual([219, 215, 214]);
  });
});

describe('picking', () => {
  it('round-trips every county index and rejects impossible ids', () => {
    for (const i of [0, 1, 255, 256, 3107]) {
      const [r, g, b] = pickColor(i).match(/\d+/g)!.map(Number);
      expect(decodePick(r, g, b, 3108)).toBe(i);
    }
    expect(decodePick(0, 0, 0, 3108)).toBe(-1);
    expect(decodePick(255, 255, 255, 3108)).toBe(-1);
  });
});

describe('tooltip lines', () => {
  const text = (lines: ReturnType<typeof modeLines>) => lines.map(lineText);

  it('follow spec 6.4', () => {
    const barbour = county('01005');
    expect(text(modeLines(meta, 'pathways', barbour, 3))).toEqual(['Recent population change (2010–20): −8.1%']);
    expect(text(modeLines(meta, 'change', barbour, 5))).toEqual(['Population change (2000–10): −5.4%']);
    expect(text(modeLines(meta, 'context', barbour, 5))).toEqual([
      'Self population loss, neighbor population growth',
      'Neighboring counties’ population change (2000–10): +4.9%',
    ]);
  });

  it('never show the county’s own change in spatial context mode', () => {
    const barbour = county('01005');
    expect(text(modeLines(meta, 'context', barbour, 5)).join(' ')).not.toContain('5.4');
  });

  it('replace the standard label for the three counties with no neighbors', () => {
    for (const g of ['25007', '25019', '53055']) {
      const c = county(g);
      for (let d = 0; d < 7; d++) {
        const self = c.seq[d] === 'B' ? 'loss' : 'growth';
        expect(contextLines(meta, c, d).map(lineText), `${g} decade ${d}`).toEqual([
          `Self population ${self}; no neighboring counties (counted as neighbor growth)`,
        ]);
      }
    }
    expect(new Set(['25007', '25019', '53055'].flatMap((g) => [...county(g).seq]))).toEqual(new Set(['B', 'D']));
  });

  it('label A–D in words', () => {
    expect(meta.ad.map((a) => a.label)).toEqual([
      'Self population loss, neighbor population loss',
      'Self population loss, neighbor population growth',
      'Self population growth, neighbor population loss',
      'Self population growth, neighbor population growth',
    ]);
  });
});

describe('US spelling', () => {
  it('meta.json visible text has no British spellings', () => {
    const visible = JSON.stringify([meta.pathways, meta.ad, meta.change, meta.notes]);
    expect(visible).not.toMatch(/neighbour|colour|behaviour|centre|licence/i);
  });
});

describe('URL state', () => {
  const idx = (g: string) => counties.findIndex((c) => c.geoid === g);

  it('leaves the default view out of the URL', () => {
    expect(toSearch(DEFAULT_STATE, meta, counties)).toBe('');
    expect(parseUrl('', meta, counties)).toEqual(DEFAULT_STATE);
  });

  it('round-trips every key', () => {
    const state = { mode: 'context' as const, decade: 4, selected: idx('01005'), filter: [3, 4] };
    const search = toSearch(state, meta, counties);
    expect(search).toBe('?mode=context&decade=1990&county=01005&path=3,4');
    expect(parseUrl(search, meta, counties)).toEqual(state);
    for (const mode of ['change', 'context', 'pathways'] as const) {
      for (let decade = 0; decade < 7; decade++) {
        const s = { mode, decade, selected: idx('28101'), filter: [] };
        expect(parseUrl(toSearch(s, meta, counties), meta, counties)).toEqual(s);
      }
    }
  });

  it('redirects the retired mode=recent to Decadal population change at 2010–20', () => {
    expect(parseUrl('?mode=recent&decade=1970&county=28101&path=2', meta, counties)).toEqual({
      mode: 'change',
      decade: LAST_DECADE,
      selected: idx('28101'),
      filter: [2],
    });
  });

  it('ignores unknown values', () => {
    expect(parseUrl('?mode=nope&decade=1985&county=99999&path=0,9,x', meta, counties)).toEqual(DEFAULT_STATE);
    expect(parseUrl('?path=4,1,4', meta, counties).filter).toEqual([1, 4]);
  });
});

describe('profile sentences (spec 6.5)', () => {
  const text = (s: Segment[]) => sentenceText(s);

  it('describe the decade on the map with grew/lost and truncated values', () => {
    expect(text(decadeSentence(county('28101'), 3))).toBe(
      'Newton County grew 1.7% while its neighboring counties together lost 0.6%.',
    );
    expect(text(recentSentence(county('28101')))).toBe('Newton County lost 1.9%.');
    expect(populationLine(meta, county('28101'))).toBe('21,291 people (2020) · Nonmetro');
  });

  it('say "less than 0.1%" when a value truncates to zero', () => {
    expect(text(recentSentence(county('48331')))).toBe('Milam County lost less than 0.1%.');
  });

  it('say so for the three counties with no neighbors', () => {
    expect(text(decadeSentence(county('25007'), 3))).toBe('Dukes County grew 30.1%; it has no neighboring counties.');
    for (const g of ['25007', '25019', '53055'])
      for (let d = 0; d < 7; d++) expect(text(decadeSentence(county(g), d))).toMatch(/no neighboring counties\.$/);
  });

  it('agree with the A–D letter in every county-decade', () => {
    for (const c of counties) {
      for (let d = 0; d < 7; d++) {
        const s = text(decadeSentence(c, d));
        const self = s.startsWith(`${c.name} lost`) ? 'loss' : 'growth';
        expect(self === 'loss', `${c.geoid} ${d}`).toBe('AB'.includes(c.seq[d]));
        if (c.lag) expect(s.includes('neighboring counties together lost')).toBe('AC'.includes(c.seq[d]));
      }
    }
  });

  it('explain strip cells in the A–D words', () => {
    expect(stripCaption(meta, county('01005'), 5)).toBe('2000–10 · Self population loss, neighbor population growth');
  });
});

describe('profile detail blocks', () => {
  it('end each ACS axis at a rounded value above the largest marker', () => {
    expect(axisEnd(0.4)).toBe(5);
    expect(axisEnd(5.8)).toBe(10);
    expect(axisEnd(20)).toBe(25);
    expect(axisEnd(60.1)).toBe(70);
    expect(axisEnd(99)).toBe(100);
    expect(axisEnd(208.2)).toBe(100);
  });

  it('give the Table 2 driver with its share of loss counties', () => {
    const shares = driverShares(componentsJson as unknown as Record<string, Components>);
    expect(driverSentence('both', shares)).toBe(
      'Lost population through both net out-migration and natural decrease, like 50% of loss counties.',
    );
    expect([...shares.values()].reduce((a, b) => a + b)).toBeCloseTo(1);
  });
});

describe('search and location (spec 6.8)', () => {
  const index = buildIndex(counties);
  const titles = (q: string) => search(index, q).map((i) => `${counties[i].name}, ${counties[i].stusps}`);

  it('is accent- and case-insensitive', () => {
    expect(titles('dona ana')[0]).toBe('Doña Ana County, NM');
    expect(titles('DOÑA')[0]).toBe('Doña Ana County, NM');
  });

  it('matches "County name, ST" and keeps the top 8', () => {
    expect(titles('newton, ms')).toEqual(['Newton County, MS']);
    expect(titles('newton ms')).toEqual(['Newton County, MS']);
    expect(titles('washington')).toHaveLength(8);
    expect(titles('')).toEqual([]);
  });

  it('finds the county under a point', () => {
    const topo = topoJson as unknown as CountyTopology;
    const at = (lon: number, lat: number) => {
      const i = countyAt(topo, counties, lon, lat);
      return i < 0 ? null : counties[i].geoid;
    };
    expect(at(...county('28101').label)).toBe('28101');
    expect(at(-89.4012, 43.0731)).toBe('55025'); // Madison, WI
    expect(at(-157.8583, 21.3069)).toBeNull(); // Honolulu
    expect(at(-30, 40)).toBeNull(); // Atlantic
  });
});

describe('pick candidates', () => {
  // A 3 × 3 window: county 5 at the centre, a blended border pixel (decodes to 9) beside it.
  const px = (i: number) => [...(i < 0 ? [0, 0, 0] : [(i + 1) & 255, ((i + 1) >> 8) & 255, 0]), 255];
  const data = [-1, 2, 2, 9, 5, 2, 5, 5, 2].flatMap(px);

  it('lists the centre pixel first, then neighbors by distance, each county once', () => {
    expect(pickCandidates(data, 3, 3, 1, 1, 3108)).toEqual([5, 2, 9]);
  });

  it('still offers the real county when the centre pixel is a blend', () => {
    expect(pickCandidates(data, 3, 3, 0, 1, 3108)).toEqual([9, 5, 2]);
  });
});
