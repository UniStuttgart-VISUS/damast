const between_lines_min = 2;
const between_lines_max = 20;

interface LinkData {
  path: string;
  label_anchor: { x: number, y: number };
};

export default function createLinks<T extends { points: [number, number][] }>(
  pointGroups: T[],

  // First visible pixel, vertically, of viewport
  top: number,

  // last visible pixel, vertically, of viewport
  bottom: number,

  // left start of swimlane
  left: number,

  // right end of swimlane
  right: number,

  // Pixel length: if vertical distance between two nodes is smaller than this,
  // draw a direct line between them instead of going through the swimlane.
  // DO NOT USE: kind of broken at the moment.
  vertical_threshold: number = -1,

  // This is a way to force an element to be "special", namely the element at
  // `always_show_index` in the passed `pointGroups` array. This group of
  // points will always be drawn, even if none of its elements are within the
  // current viewport. This might be desirable for the evidence currently being
  // edited.
  always_show_index: number = -1,
): ( T & LinkData )[] {
  // filter out point groups where no point is in visible area
  const visible = pointGroups.filter((pointGroup, i) => i === always_show_index || pointGroup.points.some(([_, y]) => y >= top && y <= bottom));

  // order by y, then x
  visible.forEach(d => d.points.sort((a,b) => a[1] - b[1] || a[0] - b[0]));

  // calculate swimlanes
  const scaling = visible.length === 1
    ? 0
    : (right - left) / (visible.length - 1);

  // count number of groups accessing each horizontal level (line)
  const indices_per_line = new Map<number, Set<number>>();
  visible.forEach((datum, i) => {
    datum.points.forEach(([_, y]) => {
      if (indices_per_line.has(y)) indices_per_line.get(y).add(i);
      else indices_per_line.set(y, new Set<number>([i]));
    });
  });

  const per_line: Map<number, number[]> = new Map<number, number[]>(
    Array.from(indices_per_line.entries()).map(([k,v]) => [k, Array.from(v)])
  );

  const objs: (T & LinkData)[] = [];

  // create links
  visible.forEach((datum, i) => {
    if (datum.points.length === 0) return;
    let path = '';

    const sw_x = left + scaling * i;

    const d_per_line = new Map<number, number[]>();
    datum.points.forEach(([x,y]) => {
      if (d_per_line.has(y)) d_per_line.get(y).push(x);
      else d_per_line.set(y, [x]);
    });

    // construct vertical part
    const _y_min = Math.min(...Array.from(d_per_line.keys()));
    const _y_max = Math.max(...Array.from(d_per_line.keys()));

    const _y_min_group_idxs = per_line.get(_y_min);
    const _y_min_idx = _y_min_group_idxs.indexOf(i);
    const y_min = _y_min + between_lines_min + (between_lines_max - between_lines_min) * _y_min_idx / Math.max(_y_min_group_idxs.length - 1, 1);

    const _y_max_group_idxs = per_line.get(_y_max);
    const _y_max_idx = _y_max_group_idxs.indexOf(i);
    const y_max = _y_max + between_lines_min + (between_lines_max - between_lines_min) * _y_max_idx / Math.max(_y_max_group_idxs.length - 1, 1);

    path += `M${sw_x} ${y_min}V${y_max}`;

    // construct horizontal parts
    d_per_line.forEach((xs, y) => {
      const x_max = Math.max(...xs);
      const y_idxs = per_line.get(y);
      const y_idx = y_idxs.indexOf(i);
      const y_ = y + between_lines_min + (between_lines_max - between_lines_min) * y_idx / Math.max(y_idxs.length - 1, 1);

      path += `M${sw_x} ${y_}H${x_max - 5}`;

      // construct ends for each point in line
      xs.forEach(x => {
        path += `M${x - 5} ${y_}L${x} ${y}`;
      });
    });

    objs.push({...datum, path, label_anchor: { x: sw_x, y: y_min } });
  });

  return objs;
}
