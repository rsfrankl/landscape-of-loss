import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Acs, Components, County, Meta } from './types';
import { applyDevPalette } from './devPalette';

export type CountyTopology = Topology<{
  counties: GeometryCollection<{ name: string; state: string; stusps: string }>;
  states: GeometryCollection;
}>;

export interface StartupData {
  meta: Meta;
  topo: CountyTopology;
  /** In TopoJSON geometry order, so an index means the same county everywhere. */
  counties: County[];
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`could not load ${file} (${res.status})`);
  return res.json() as Promise<T>;
}

export function alignCounties(topo: CountyTopology, records: County[]): County[] {
  const byId = new Map(records.map((c) => [c.geoid, c]));
  const out = topo.objects.counties.geometries.map((g) => {
    const c = byId.get(String(g.id));
    if (!c) throw new Error(`no counties.json record for ${g.id}`);
    return c;
  });
  if (out.length !== records.length) throw new Error('counties.json and the TopoJSON disagree');
  return out;
}

export interface ProfileData {
  acs: Acs;
  components: Record<string, Components>;
}

let profileData: Promise<ProfileData> | null = null;

/** acs.json and components.json, fetched once on the first profile open (spec 5). */
export function loadProfileData(): Promise<ProfileData> {
  profileData ??= Promise.all([
    getJson<Acs>('acs.json'),
    getJson<Record<string, Components>>('components.json'),
  ]).then(([acs, components]) => ({ acs, components }));
  // A failed load can be retried on the next open.
  profileData.catch(() => (profileData = null));
  return profileData;
}

export async function loadStartup(): Promise<StartupData> {
  const [meta, topo, records] = await Promise.all([
    getJson<Meta>('meta.json'),
    getJson<CountyTopology>('counties.topo.json'),
    getJson<County[]>('counties.json'),
  ]);
  if (import.meta.env.DEV) applyDevPalette(meta);
  return { meta, topo, counties: alignCounties(topo, records) };
}
