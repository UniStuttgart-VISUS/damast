export interface SimpleReligionFilter {
  filter: number[];
  type: 'simple';
};

export interface ComplexReligionFilter {
  filter: number[][];
  type: 'complex';
};

export type ReligionFilter = true | SimpleReligionFilter | ComplexReligionFilter;

export function isSimpleReligionFilter(filter: ReligionFilter): filter is SimpleReligionFilter {
  return (filter !== true) && (filter.type === 'simple');
}

interface ReligionContainingTuple {
  religion_id: number;
}

export function tupleIsActive(filter: ReligionFilter, tuple: ReligionContainingTuple): boolean {
  if (filter === true) return true;
  else if (isSimpleReligionFilter(filter)) {
    return filter.filter.includes(tuple.religion_id);
  } else {
    return filter.filter.some(d => d.some(e => e === tuple.religion_id));
  }
}

export function equal(a: ReligionFilter, b: ReligionFilter, religionIds: number[]): boolean {
  // simple filter with all religions included equals 'true'

  if (a === true && (b === true || (b.type === 'simple' && religionIds.every(d => b.filter.includes(d))))) return true;
  if (a !== true && a.type === 'simple' && b === true && religionIds.every(d => a.filter.includes(d))) return true;

  // else, only accept full equality
  return JSON.stringify(a) === JSON.stringify(b);
}
