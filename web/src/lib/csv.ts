import type { County, Meta } from './types';

// Client-side CSV downloads (spec 6.9): a plain header row, then one row per county, so the
// files open cleanly in R, pandas and Excel. The citation is shown beside each download link.

/** "1990–2000" → "1990_00". */
function decadeKey(start: number, end: number): string {
  return `${start}_${String(end).slice(-2)}`;
}

export function csvColumns(meta: Meta): string[] {
  return [
    'geoid',
    'county',
    'state',
    'pathway',
    'seq',
    ...meta.years.map((y) => `pop${y}`),
    ...meta.decades.map((d) => `pct${decadeKey(d.start, d.end)}`),
    'rucc2013',
    'rucc2023',
  ];
}

/** Quotes a field only when it needs it (RFC 4180). */
function field(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function countiesCsv(meta: Meta, counties: County[]): string {
  const rows = counties.map((c) =>
    [
      c.geoid,
      c.name,
      c.state,
      meta.pathways[c.pathway - 1].name,
      c.seq,
      ...c.pop,
      ...c.pct,
      c.rucc13,
      c.rucc23,
    ]
      .map(field)
      .join(','),
  );
  return [csvColumns(meta).join(','), ...rows].join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const csvName = (suffix: string) => `landscape-of-loss-${suffix}.csv`;
