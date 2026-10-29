import { describe, expect, it } from 'vitest';
import metaJson from '../../public/data/meta.json';
import countiesJson from '../../public/data/counties.json';
import topoJson from '../../public/data/counties.topo.json';
import type { AdCode, County, Meta } from './types';
import { LAST_DECADE } from './types';
import { changeClass, formatPct, truncate1 } from './format';
import { dataColor, emphasis, hexToRgb, isDark, legendKey, mix, palettes } from './colors';
import { breakdownCounts, legendCounts } from './counts';
import { countiesCsv, csvColumns } from './csv';
import { decodePick, pickCandidates, pickColor } from './picking';
import { alignCounties, type CountyTopology } from './data';
import {
  decadeSentence,
  populationLine,
  recentSentence,
  sentenceText,
  stripCaptionText,
  tooltipLines,
  type Segment,
} from './describe';
import { DEFAULT_STATE, parseUrl, toSearch } from './url';
import { axisEnd } from './profile';
import { buildIndex, search } from './search';
import { countyAt } from './locate';
import { DEFAULT_SIMILAR, similarCounties } from './similar';
import { REGIONAL_MAX, regionalScale } from './zoom';

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

  it('the 2010–20 breakdown splits 1,637 losing and 1,471 gaining counties into their pathways', () => {
    const b = breakdownCounts(counties);
    expect([...b.loss.keys()].sort()).toEqual([1, 2, 3, 4]);
    expect([...b.growth.keys()].sort()).toEqual([5, 6, 7, 8]);
    expect([1, 2, 3, 4].map((p) => b.loss.get(p))).toEqual([557, 126, 442, 512]);
    expect([5, 6, 7, 8].map((p) => b.growth.get(p))).toEqual([949, 141, 312, 69]);
    expect([...b.loss.values()].reduce((a, n) => a + n, 0)).toBe(1637);
    expect([...b.growth.values()].reduce((a, n) => a + n, 0)).toBe(1471);
    // Each county's group agrees with its 2010–20 change class, so the bars match the map.
    expect(counties.filter((c) => (c.group === 'loss') !== c.cls[LAST_DECADE] >= 4)).toEqual([]);
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

  it('gray by filter and legend isolation, fade outside the breakdown highlight', () => {
    const barbour = county('01005');
    const e = { filter: [] as number[], isolate: null, highlight: null };
    expect(emphasis(e, 'pathways', barbour, 0)).toBe('full');
    expect(emphasis({ ...e, filter: [3] }, 'context', barbour, 0)).toBe('gray');
    expect(emphasis({ ...e, filter: [1], isolate: 'B' }, 'context', barbour, 5)).toBe('full');
    expect(emphasis({ ...e, isolate: 'A' }, 'context', barbour, 5)).toBe('gray');
    expect(emphasis({ ...e, highlight: 1 }, 'change', barbour, LAST_DECADE)).toBe('full');
    expect(emphasis({ ...e, highlight: 3 }, 'change', barbour, LAST_DECADE)).toBe('faded');
    // Gray wins over faded: a filtered-out county stays gray whatever is highlighted.
    expect(emphasis({ ...e, filter: [2], highlight: 3 }, 'change', barbour, LAST_DECADE)).toBe('gray');
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

describe('tooltip lines (spec 6.4)', () => {
  const text = (lines: ReturnType<typeof tooltipLines>) =>
    lines.map((l) => (l.swatch ? (l.swatch.round ? '● ' : '■ ') : '') + sentenceText(l.segs));
  const barbour = county('01005');

  it('start every line with its time frame, with one swatch', () => {
    expect(text(tooltipLines(meta, 'context', barbour, 5))).toEqual([
      '■ 2000–10: lost 5.4%; neighboring counties together grew 4.9%',
      '1950–2020 pathway: Emerging Localized Loss',
    ]);
    expect(text(tooltipLines(meta, 'change', barbour, 5))).toEqual([
      '■ 2000–10: lost 5.4%',
      '1950–2020 pathway: Emerging Localized Loss',
    ]);
    expect(text(tooltipLines(meta, 'pathways', barbour, 3))).toEqual([
      '● 1950–2020 pathway: Emerging Localized Loss',
      '2010–20: lost 8.1%',
    ]);
    expect(text(tooltipLines(meta, 'context', county('28101'), 3))[0]).toBe(
      '■ 1980–90: grew 1.7%; neighboring counties together lost 0.6%',
    );
    expect(text(tooltipLines(meta, 'pathways', county('48331'), 0))[1]).toBe('2010–20: lost less than 0.1%');
  });

  it('match the county’s fill in each mode', () => {
    for (const c of [barbour, county('28101'), county('25007')]) {
      for (let d = 0; d < 7; d++) {
        const sw = (mode: 'change' | 'context' | 'pathways') =>
          tooltipLines(meta, mode, c, d).filter((l) => l.swatch).map((l) => hexToRgb(l.swatch!.color));
        expect(sw('change')).toEqual([dataColor(palettes(meta), 'change', c, d)]);
        expect(sw('context')).toEqual([dataColor(palettes(meta), 'context', c, d)]);
        expect(sw('pathways')).toEqual([dataColor(palettes(meta), 'pathways', c, d)]);
      }
    }
  });

  it('use the no-neighbor wording for the three island counties', () => {
    expect(text(tooltipLines(meta, 'context', county('25007'), 3))[0]).toBe(
      '■ 1980–90: grew 30.1%; it has no neighboring counties',
    );
    expect(new Set(['25007', '25019', '53055'].flatMap((g) => [...county(g).seq]))).toEqual(new Set(['B', 'D']));
  });

  it('name the four states with arrows, county first', () => {
    expect(meta.ad.map((a) => `${a.arrows} ${a.label}`)).toEqual([
      '↓↓ Regional loss',
      '↓↑ Localized loss',
      '↑↓ Localized growth',
      '↑↑ Regional growth',
    ]);
  });
});

describe('text on the state colours', () => {
  // WCAG contrast of the ink the strip, key and legend choose (theme --text / --bg, spec 7).
  const lum = (hex: string) =>
    hexToRgb(hex)
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('meets AA (4.5:1) on every fill, with light text on the navy', () => {
    for (const a of meta.ad) {
      const ink = isDark(a.color) ? '#fbfbfb' : '#1a1210';
      expect(contrast(ink, a.color), a.label).toBeGreaterThanOrEqual(4.5);
    }
    expect(isDark(meta.ad.find((a) => a.code === 'D')!.color)).toBe(true);
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
    const state = { mode: 'context' as const, decade: 4, selected: idx('01005'), filter: [3, 4], pinned: null, similar: DEFAULT_SIMILAR };
    const search = toSearch(state, meta, counties);
    expect(search).toBe('?mode=context&decade=1990&county=01005&path=3,4');
    expect(parseUrl(search, meta, counties)).toEqual(state);
    for (const mode of ['change', 'context', 'pathways'] as const) {
      for (let decade = 0; decade < 7; decade++) {
        const s = { mode, decade, selected: idx('28101'), filter: [], pinned: null, similar: DEFAULT_SIMILAR };
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
      pinned: null,
      similar: DEFAULT_SIMILAR,
    });
  });

  it('keeps the breakdown pin only in Decadal population change at 2010–20', () => {
    const pinned = { ...DEFAULT_STATE, selected: idx('01005'), pinned: 3 };
    expect(toSearch(pinned, meta, counties)).toBe('?county=01005&hl=3');
    expect(parseUrl('?county=01005&hl=3', meta, counties)).toEqual(pinned);
    expect(toSearch({ ...pinned, decade: 4 }, meta, counties)).toBe('?decade=1990&county=01005');
    expect(toSearch({ ...pinned, mode: 'pathways' }, meta, counties)).toBe('?mode=pathways&county=01005');
    expect(parseUrl('?decade=1990&hl=3', meta, counties).pinned).toBeNull();
    expect(parseUrl('?mode=context&hl=3', meta, counties).pinned).toBeNull();
    expect(parseUrl('?hl=9', meta, counties).pinned).toBeNull();
  });

  it('round-trips the similar-counties settings as sim tokens', () => {
    const s = { ...DEFAULT_STATE, selected: idx('01005'), similar: { any: true, size: true, metro: false } };
    expect(toSearch(s, meta, counties)).toBe('?county=01005&sim=any,size');
    expect(parseUrl('?county=01005&sim=size,any,nope', meta, counties)).toEqual(s);
    for (const any of [false, true])
      for (const size of [false, true])
        for (const metro of [false, true]) {
          const t = { ...DEFAULT_STATE, similar: { any, size, metro } };
          expect(parseUrl(toSearch(t, meta, counties), meta, counties)).toEqual(t);
        }
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

  it('explain strip cells with the state names', () => {
    expect(stripCaptionText(meta, county('01005'), 5)).toBe(
      '2000–10: Localized loss. Barbour County lost 5.4% while its neighboring counties together grew 4.9%.',
    );
    expect(stripCaptionText(meta, county('25007'), 3)).toBe(
      '1980–90: Regional growth (no neighboring counties; counted as neighbors grew). Dukes County grew 30.1%; it has no neighboring counties.',
    );
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
});

describe('similar counties (spec 6.7)', () => {
  const idx = (g: string) => counties.findIndex((c) => c.geoid === g);
  const geoids = (m: { index: number }[], list = counties) => m.map((x) => list[x.index].geoid);

  it('ranks the 5 nearest lgr vectors in the same pathway by default', () => {
    const i = idx('01005');
    const m = similarCounties(counties, i, DEFAULT_SIMILAR);
    expect(geoids(m)).toEqual(['29011', '45017', '01111', '08105', '29057']);
    expect(m.every((x) => counties[x.index].pathway === counties[i].pathway)).toBe(true);
    expect(m[0].distance).toBeCloseTo(0.075, 3);
  });

  it('excludes the county itself and sorts ascending with a GEOID tie-break', () => {
    // Two identical copies of a county tie at distance 0; the lower GEOID comes first.
    const a = county('01005');
    const twins = [a, { ...a, geoid: '99002' }, { ...a, geoid: '99001' }, county('29011')];
    expect(geoids(similarCounties(twins, 0, DEFAULT_SIMILAR), twins)).toEqual(['99001', '99002', '29011']);
    for (const g of ['01005', '28101', '06037']) {
      const m = similarCounties(counties, idx(g), { any: true, size: false, metro: false });
      expect(m).toHaveLength(5);
      expect(geoids(m)).not.toContain(g);
      for (let k = 1; k < m.length; k++) expect(m[k].distance).toBeGreaterThanOrEqual(m[k - 1].distance);
    }
  });

  it('applies the size and metro checkboxes', () => {
    const i = idx('28101');
    const self = counties[i];
    const m = similarCounties(counties, i, { any: true, size: true, metro: true });
    expect(m).toHaveLength(5);
    for (const x of m) {
      const c = counties[x.index];
      expect(c.pop[7]).toBeGreaterThanOrEqual(0.5 * self.pop[7]);
      expect(c.pop[7]).toBeLessThanOrEqual(2 * self.pop[7]);
      expect(c.metro).toBe(self.metro);
    }
  });

  it('returns fewer than 5 when the pool is small', () => {
    // Los Angeles: no metro county in its pathway is within 2× of its size.
    expect(similarCounties(counties, idx('06037'), { any: false, size: true, metro: true })).toEqual([]);
    expect(similarCounties(counties, idx('06003'), { any: false, size: true, metro: true })).toHaveLength(2);
  });

  it('runs in under 5 ms per selection', () => {
    const t = performance.now();
    for (let i = 0; i < 200; i++) similarCounties(counties, i * 15, { any: true, size: false, metro: false });
    expect((performance.now() - t) / 200).toBeLessThan(5);
  });
});

describe('zoom on select (spec 6.9)', () => {
  it('frames the county at about 1/20 of the map width, between 1× and 4×', () => {
    // A 10 px county on a 900 px map: 45 px wide means 4.5×, capped at 4×.
    expect(regionalScale(10, 6, 900, 1)).toBe(REGIONAL_MAX);
    // A 20 px county: 45 / 20 = 2.25×. The longer side counts.
    expect(regionalScale(20, 12, 900, 1)).toBeCloseTo(2.25);
    expect(regionalScale(12, 20, 900, 1)).toBeCloseTo(2.25);
    // A county already wider than 1/20 of the map stays at 1×.
    expect(regionalScale(80, 60, 900, 1)).toBe(1);
  });

  it('never zooms out from a closer view: it only pans', () => {
    expect(regionalScale(20, 12, 900, 6)).toBe(6);
    expect(regionalScale(10, 6, 900, 3)).toBe(REGIONAL_MAX);
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

describe('CSV downloads (spec 6.9)', () => {
  it('starts with a plain header row in the spec column order', () => {
    const text = countiesCsv(meta, counties);
    const [head] = text.split('\r\n');
    expect(head).toBe(
      'geoid,county,state,pathway,seq,pop1950,pop1960,pop1970,pop1980,pop1990,pop2000,pop2010,pop2020,' +
        'pct1950_60,pct1960_70,pct1970_80,pct1980_90,pct1990_00,pct2000_10,pct2010_20,rucc2013,rucc2023',
    );
    expect(csvColumns(meta)).toHaveLength(22);
    expect(text.startsWith('#')).toBe(false);
  });

  it('writes one row per county, 3,108 in all, with full-precision values', () => {
    const rows = countiesCsv(meta, counties).trimEnd().split('\r\n');
    expect(rows).toHaveLength(3109);
    const barbour = rows.find((r) => r.startsWith('01005,'))!;
    expect(barbour).toBe(
      '01005,Barbour County,Alabama,Emerging Localized Loss,BBDDDBB,' +
        `${county('01005').pop.join(',')},${county('01005').pct.join(',')},${county('01005').rucc13},${county('01005').rucc23 ?? ''}`,
    );
  });

  it('quotes fields with commas or quotes, and leaves a missing 2023 code empty', () => {
    const odd = { ...county('09001'), name: 'Fair "field", County' };
    const [, row] = countiesCsv(meta, [odd]).split('\r\n');
    expect(row.startsWith('09001,"Fair ""field"", County",Connecticut,')).toBe(true);
    expect(county('09001').rucc23).toBeNull();
    expect(row.endsWith(`,${county('09001').rucc13},`)).toBe(true);
  });

  it('subsets to the counties in a filter', () => {
    const kept = counties.filter((c) => [3, 4].includes(c.pathway));
    expect(countiesCsv(meta, kept).trimEnd().split('\r\n')).toHaveLength(442 + 512 + 1);
  });
});
