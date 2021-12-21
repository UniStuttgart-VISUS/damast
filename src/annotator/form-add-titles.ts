import { Selection } from 'd3-selection';

export default function addTitles(
  selection: Selection<HTMLElement, any, any, any>,
  titles_list: [ string, string ][],
): void {
  titles_list.forEach(([name, title]) => selection.selectAll(`[for="${name}"], [name="${name}"]`)
    .attr('title', title));
}
