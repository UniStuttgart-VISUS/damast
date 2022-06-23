import * as d3 from 'd3-scale';
import * as d3c from 'd3-color';
import * as d3cs from 'd3-scale-chromatic';
import { hierarchy as d3hier, partition } from 'd3-hierarchy';
import type { HierarchyNode } from 'd3-hierarchy';
import * as T from './datatypes';

export interface ColorScales {
  religion:                 d3.ScaleOrdinal<number, string>;
  confidence:               d3.ScaleOrdinal<T.Confidence, string>;
};

function createReligionColorscale(hierarchy: T.OwnHierarchyNode): d3.ScaleOrdinal<number, string> {
  let colorpairs: Array<{religion: number, color: d3c.Color}> = [];

  function visit(node: T.OwnHierarchyNode) {
    if (node.children) node.children.forEach(visit);

    colorpairs.push({religion: node.id, color: d3c.color(node.color)});
  }
  visit(hierarchy);

  return d3.scaleOrdinal<number, string>()
    .domain(colorpairs.map(d => d.religion))
    .range(colorpairs.map(d => d.color.toString()));
}

function createConfidenceColorscale(): d3.ScaleOrdinal<T.Confidence, string> {
  return d3.scaleOrdinal<T.Confidence, string>()
    .domain(<T.Confidence[]>[
      'certain',
      'probable',
      'contested',
      'uncertain',
      'false',
      null
    ])
  .range([
    // https://colorbrewer2.org/?type=diverging&scheme=RdBu&n=5
    '#0571b0',
    '#92c5de',
    '#f7f7f7',
    '#f4a582',
    '#ca0020',

    '#a2b536'  // null color
  ]);
}

export function createColorscales(hierarchy: T.OwnHierarchyNode): ColorScales {
  return {
    religion: createReligionColorscale(hierarchy),
    confidence: createConfidenceColorscale()
  };
}

export function createFalseReligionColorscale(
  hierarchy: T.OwnHierarchyNode,
  religionOrder: Map<number, number>,
  activeReligions: Set<number>,
  allReligions: Array<number>,
  colorFn: (t: number) => string = (t) => d3cs.interpolateRainbow(t+0.25),
): d3.ScaleOrdinal<number, string> {
  function visit(node: T.OwnHierarchyNode) {
    if (node.children) {
      const children = node.children.map(d => visit(d))
        .filter(d => d !== null);
      if (children.length === 0 && !activeReligions.has(node.id)) return null;
      return { id: node.id, children };
    } else {
      return activeReligions.has(node.id) ? { id: node.id } : null;
    }
  }
  const newHierarchy = visit(hierarchy);
  const hier = d3hier(newHierarchy);
  hier.sort((a, b) => religionOrder.get(a.data.id) - religionOrder.get(b.data.id));

  const padding = 0.2;
  const colorpairs: [number, string][] = [];
  function visit2(node: HierarchyNode<T.OwnHierarchyNode>, t0: number, t1: number) {
    if (!node.children) {
      colorpairs.push([node.data.id, colorFn((t0 + t1) / 2)]);
      return;
    }

    if (!activeReligions.has(node.data.id) && node.children.length === 1) {
      visit2(node.children[0], t0, t1);
      return;
    }

    const parentCount = activeReligions.has(node.data.id) ? 1 : 0;
    const count = node.children.length + parentCount;
    const delta = t1 - t0;
    const paddingPer = delta * padding / count;
    const widthPer = delta / count;

    if (activeReligions.has(node.data.id)) colorpairs.push([node.data.id, colorFn(t0 + widthPer/2 - paddingPer/2)]);
    node.children.forEach((child, i) => {
      const offset = t0 + (i + parentCount) * widthPer;
      visit2(child, offset, offset + widthPer - paddingPer);
    });
  }
  const rootOffset = 1 / hier.children.length;
  visit2(hier, 0, 1);

  // rest: gray
  allReligions.forEach(rid => {
    if (!activeReligions.has(rid)) colorpairs.push([rid, '#666']);
  });

  return d3.scaleOrdinal<number, string>()
    .domain(colorpairs.map(d => d[0]))
    .range(colorpairs.map(d => d[1]));
}
