import { describe, expect, it } from 'vitest';
import metaJson from '../../public/data/meta.json';
import countiesJson from '../../public/data/counties.json';
import topoJson from '../../public/data/counties.topo.json';
import type { AdCode, County, Meta } from './types';
import { LAST_DECADE } from './types';
import { changeClass, formatLag, formatPct, truncate1 } from './format';
import { dataColor, hexToRgb, isDimmed, legendKey, mix, palettes } from './colors';
import { legendCounts } from './counts';
import { decodePick, pickColor } from './picking';
import { alignCounties, type CountyTopology } from './data';
import { contextLines, lineText, modeLines } from './describe';
import { DEFAULT_STATE, parseUrl, toSearch } from './url';

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
