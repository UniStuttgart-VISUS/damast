/**
 * Filter by tag.id:
 *  - Either permit all (true),
 *  - or just one (number),
 *  - or a set of tags (Set<number>)
 */
export type TagFilter = true | number | Set<number>;
export type ExportableTagFilter = true | number | Array<number>;

export function tupleIsActive(
  tuple: {tuple_id: number},
  filter: TagFilter,
  lut: Map<number, number[]>
): boolean {
  if (filter === true) return true;
  const tag_ids = lut.get(tuple.tuple_id);
  if (tag_ids === undefined) return false;

  return (typeof filter === 'number' && tag_ids.includes(filter))
      || (typeof filter === 'object' && tag_ids.some(d => filter.has(d)));
}


export function to_exportable(f: TagFilter): ExportableTagFilter {
  if (f === true || typeof f === 'number') return f;
  return Array.from(f);
}

export function from_exportable(f: ExportableTagFilter): TagFilter {
  if (f === true || typeof f === 'number') return f;
  return new Set<number>(f);
}
