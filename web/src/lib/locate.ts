import { geoContains } from 'd3';
import { feature } from 'topojson-client';
import type { Feature } from 'geojson';
import type { CountyTopology } from './data';
import type { County } from './types';

let features: Feature[] | null = null;

/** Index of the county containing a lon/lat point, or -1 (spec 6.8). Checks bboxes first. */
export function countyAt(topo: CountyTopology, counties: County[], lon: number, lat: number): number {
  features ??= feature(topo, topo.objects.counties).features;
  for (let i = 0; i < counties.length; i++) {
    const [w, s, e, n] = counties[i].bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    if (geoContains(features[i], [lon, lat])) return i;
  }
  return -1;
}

/** The browser's position, once. The coordinates are used here and never stored or sent. */
export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) reject(new Error('unsupported'));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, maximumAge: 0 });
  });
}
