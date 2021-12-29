import * as T from './datatypes';

export type SourceWithPayload = T.Source & { data?: any, stack: CountStackDatum[], active: boolean };
export interface CountStackDatum {
  data_id: T.Confidence | number;
  active: boolean;
  x: number;
  w: number;
  color: string;
  count: number;
};

export type SourceFilter = Set<number> | null;
export function tupleIsActive(tuple: {source_ids: number[]}, filter: SourceFilter): boolean {
  return (filter === null) || tuple.source_ids === null || tuple.source_ids.some(d => filter.has(d));
}

export type ExportableSourceFilter = number[] | null;

export function to_exportable(f: SourceFilter): ExportableSourceFilter {
  if (f === null) return null;
  return Array.from(f);
}

export function from_exportable(f: ExportableSourceFilter): SourceFilter {
  if (f === null) return null;
  return new Set<number>(f);
}
