import * as L from 'leaflet';
import * as d3 from 'd3';

// canvas icon code inspired by and adapted from https://github.com/sashakavun/leaflet-canvasicon/blob/master/leaflet-canvasicon.js
const CanvasIcon = L.Icon.extend({
  createIcon: function(icon: HTMLElement): HTMLCanvasElement {
    const size = L.point(this.options.iconSize);

    if (!icon || (icon.tagName !== 'CANVAS')) {
      icon = document.createElement('canvas');
    }

    (<HTMLCanvasElement>icon).width = size.x;
    (<HTMLCanvasElement>icon).height = size.y;

    this._setIconStyles(icon, 'icon');

    return icon as HTMLCanvasElement;
  },

  _setIconStyles: function (icon, type) {
    if (typeof this.options.drawIcon == 'function') {
      this.options.drawIcon.apply(this, arguments);
    }

    (L.Icon.prototype as any)._setIconStyles.apply(this, arguments);
  }
});

function canvasIcon(options: any) {
  const x = new CanvasIcon();
  x.initialize(options);
  return x;
};

type DiversityDatum = [ number, number, number ];

const radius = 50;
const sigma = radius / 3;
const sigma2 = sigma * sigma;

const stencil = new Uint8ClampedArray(4 * radius * radius);
for (let i = 0; i < 2*radius; ++i) {
  for (let j = 0; j < 2*radius; ++j) {
    const dist2 = Math.pow(i - radius, 2) + Math.pow(j - radius, 2);
    const val = Math.max(0, Math.exp(-0.5 * dist2 / sigma2) - 0.01);

    stencil[2 * i * radius + j] = Math.floor(val * 255);
  }
}


function drawIcon(icon, type, [r, g, b]) {
  if (type === 'icon') {
    const ctx = icon.getContext('2d');
    const size = L.point(this.options.iconSize);
    const center = L.point(Math.floor(size.x / 2), Math.floor(size.y / 2));

    const imagedata = new Uint8ClampedArray(new Uint32Array(size.x * size.y).buffer);

    for (let i = 0; i < size.x; ++i) {
      for (let j = 0; j < size.y; ++j) {
        const idx = i * size.y + j;
        const idx4 = 4 * idx;
        imagedata[idx4] = r;
        imagedata[idx4 + 1] = g;
        imagedata[idx4 + 2] = b;
        imagedata[idx4 + 3] = stencil[idx];
      }
    }

    ctx.putImageData(new ImageData(imagedata, size.x, size.y), 0, 0);
  }
}

export default class DiversityLayer {
  readonly markerLayer: L.LayerGroup;
  readonly densityLayer: L.LayerGroup;

  constructor() {
    this.markerLayer = L.layerGroup();
    this.densityLayer = L.layerGroup();
  }

  setData(data: DiversityDatum[]) {
    this.markerLayer.clearLayers();
    this.densityLayer.clearLayers();

    data.sort((a, b) => a[2] - b[2]);
    data.forEach(([lat, lng, intensity], idx, { length }) => {
      const col = d3.rgb(d3.interpolateViridis(intensity));
      const color = [ col.r, col.g, col.b ];

      this.markerLayer.addLayer(L.circleMarker(
        [lat, lng],
        {
          radius: 4,
          fillColor: col.toString(),
          color: '#444',
          weight: 1,
          fillOpacity: 1,
        }));

      this.densityLayer.addLayer(L.marker(
        [lat, lng],
        {
          icon: canvasIcon({
            iconSize: [2*radius, 2*radius],
            iconAnchor: [radius, radius],
            drawIcon: function(icon, type) {
              drawIcon.apply(this, [icon, type, color]);
            },
          }),
          zIndexOffset: -length - 1 + idx,
          opacity: 0.8,
        }
      ));
    });
  }
};

