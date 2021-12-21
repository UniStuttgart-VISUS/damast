import * as d3 from 'd3-scale';
import * as d3c from 'd3-color';
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
