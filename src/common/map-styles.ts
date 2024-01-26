import { json } from 'd3-fetch';
import * as L from 'leaflet';
import 'leaflet.vectorgrid';

export interface MapStyle {
  key: string;
  url: string;
  name: string;
  default_?: boolean;
  is_mapbox: boolean;
  options?: {
    attribution?: string;
    accessToken?: string;
  };
};

export async function mapStyles(): Promise<MapStyle[]> {
  return json('./map-styles');
}


// default map style
export async function generateDefaultMapLayer(): Promise<L.LayerGroup> {
  const waterFeatures = await json<GeoJSON.FeatureCollection & { crs: any }>('./water-features.geo.json')

  // change the tile URL as required
  const tileUrl = `http://localhost:8001/tiles/{z}/{x}/{y}.png`;

  // `layerGroup` with two members. The lower one is always shown, the higher one only above the given zoom level.
  const lowTileLayer = L.tileLayer(tileUrl, {
    maxNativeZoom: 6,
  });
  const highTileLayer = L.tileLayer(tileUrl, {
    minZoom: 7,
    maxNativeZoom: 12,
  });

  // make addable and removable without disturbing order
  const highTileGroup = L.layerGroup([highTileLayer]);

  const slicer = L.vectorGrid.slicer(waterFeatures, {
    rendererFactory: L.svg.tile,
    getFeatureId: feature => {
      return (feature.type as unknown as string)
    },
  });
  slicer.setFeatureStyle(2, {
    stroke: true,
    fill: false,
    color: '#758591',
    weight: 2,
    pmIgnore: true,  // do not use as GeoJSON filter
  });
  slicer.setFeatureStyle(3, {
    stroke: false,
    fill: true,
    fillColor: '#758591',
    fillOpacity: 1,
    pmIgnore: true,  // do not use as GeoJSON filter
  });

  const tileLayer = L.layerGroup([
    lowTileLayer,
    highTileGroup,
    slicer,
  ], {
    attribution: 'Made with Natural Earth. Map tiles &copy; 2024 <a href="https://darus.uni-stuttgart.de/dataset.xhtml?persistentId=doi:10.18419/darus-3837" target="_blank">Max Franke</a>',
  });

  function onZoom() {
    const zoom = this.getZoom();

    if (zoom >= 7 && !highTileGroup.hasLayer(highTileLayer)) {
      highTileGroup.addLayer(highTileLayer);
      slicer.bringToFront();
    }

    if (zoom < 7 && highTileGroup.hasLayer(highTileLayer)) highTileGroup.removeLayer(highTileLayer);

    slicer.setFeatureStyle(2, {
      stroke: zoom >= 4,
      fill: false,
      color: '#758591',
      pmIgnore: true,  // do not use as GeoJSON filter
      weight: 2,
    });
  }

  tileLayer.on('add', e => {
    e.sourceTarget._map.on('zoom', onZoom);
    onZoom.bind(e.sourceTarget._map)(e);
  });
  tileLayer.on('remove', e => {
    e.sourceTarget._map.off('zoom', onZoom);
  });

  return tileLayer
}
