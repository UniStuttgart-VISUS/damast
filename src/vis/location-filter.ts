import { MultiPolygon, Polygon, multiPoint, point, Feature, Point } from '@turf/helpers';
import pointsWithinPolygon from '@turf/points-within-polygon';

import * as T from './datatypes';

export type LocationFilter = Feature<MultiPolygon | Polygon> | null;

export interface LocationMatcher {
  tupleIsActive(p: T.LocationData): boolean;
};

export function createLocationMatcher(
  places: Map<number, T.Place>,
  filter: LocationFilter
): LocationMatcher {
  if (filter === null) return { tupleIsActive: () => true };

  const placeIds = new Set<number>();
  places.forEach((v, k) => {
    // match unplaced (XXX ?)
    if (v.geoloc === null) placeIds.add(k);
    else if (pointsWithinPolygon(point([v.geoloc.lng, v.geoloc.lat]), filter).features.length > 0) placeIds.add(k);
  });

  return {
    tupleIsActive: p => placeIds.has(p.place_id),
  };
}

export type PlaceFilter = null | number[];
export function tupleIsActive(t: { place_id: number }, f: PlaceFilter): boolean {
  return f === null || f.includes(t.place_id);
}

