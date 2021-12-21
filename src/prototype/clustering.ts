import {Confidences} from './datatypes';

export interface Cluster<T> {
  x: number;
  y: number;
  count: number;
  members: Array<T>;
  extra_data?: any;
  per_religion: Map<number, [{religion_id: number, active: boolean, count: number}]>;
  confidences_per_religion?: Map<number, Confidences>;
};

function locationFromDatum(datum: {x: number, y: number}): {x: number, y: number} {
  return {x: datum.x, y: datum.y};
}

/**
 * Algorithm cuts off if distance from center of cluster to center of other
 * cluster is greater than threshold. This avoids the creation of monoclusters
 * while still avoiding overlaps.
 * The cutoff radius needs to be selected as twice the maximum radius of one
 * cluster's graphical representation in order to avoid overlaps. The algorithm
 * is naïve and its complexity is in O(n^3), but it performs fine on our data.
*/
export function cluster<T>(datapoints: Array<T>,
  threshold: number,
  locationExtractor: (T) => {x: number, y: number} = locationFromDatum
) : Array<Cluster<T>>
{
  // first, create one cluster for each data point
  let clusters = datapoints.map(function(d) {
    const pos = locationExtractor(d);
    return {
      x: pos.x,
      y: pos.y,
      count: 1,
      members: [d],
      per_religion: new Map()
    };
  });

  let d;
  do {
    let arr = findClosest(clusters);
    if (arr === null) return clusters;
    let ca = clusters[arr[0]], cb = clusters[arr[1]];
    d = distance(ca, cb);
    if (d < threshold) {
      clusters.splice(arr[1], 1);
      clusters.splice(arr[0], 1);
      clusters.unshift(join(ca, cb));
    }
  } while (d < threshold);

  return clusters;
}

function findClosest<T>(clusters: Array<Cluster<T>>): [number, number] | null {
  if (clusters.length < 2) return null;

  let a = 0, b = 1;
  let dist = Infinity;

  for (let i = 0; i < clusters.length - 1; ++i) {
    for (let j = i+1; j < clusters.length; ++j) {
      const d = distance(clusters[i], clusters[j]);
      if (d < 1e-4) return [i,j]; // shortcut
      if (d < dist) {
        a = i;
        b = j;
        dist = d;
      }
    }
  }

  return [a,b];
}

function distance<T>(a: Cluster<T>, b: Cluster<T>): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)
  );
}

function join<T>(a: Cluster<T>, b: Cluster<T>): Cluster<T> {
  return {
    x: (a.x * a.count + b.x * b.count) / (a.count + b.count),
    y: (a.y * a.count + b.y * b.count) / (a.count + b.count),
    count: a.count + b.count,
    members: a.members.concat(b.members),
    per_religion: new Map()
  };
}
