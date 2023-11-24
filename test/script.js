const map = L.map('map', { renderer: L.canvas() }).setView([40, 40], 9);
const req = await fetch('features.geo.json');
const data = await req.json();

const { type, crs, features } = data;

const areas = {
  type, crs,
  features: features.filter(v => v.geometry.type === 'Polygon' || v.geometry.type === 'MultiPolygon'),
};
const lines = {
  type, crs,
  features: features.filter(v => v.geometry.type === 'LineString' || v.geometry.type === 'MultiLineString'),
};

L.geoJSON(lines, {
  style: {
    stroke: true,
    fill: false,
    color: 'steelblue',
    weight: 1,
  }
}).addTo(map);
L.geoJSON(areas, {
  style: {
    stroke: false,
    fill: true,
    fillColor: 'steelblue',
    fillOpacity: 1,
  }
}).addTo(map);

