import { json } from 'd3-fetch';
import * as L from 'leaflet';

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

  const renderer = L.canvas();

      // TODO: wrap vector features: https://stackoverflow.com/questions/48994873/wrap-geojson-objects-around-leaflet-js-map
      // SRTM Hillshading + Natural Earth water features

  // change the tile URL as required
  const tileUrl = `http://localhost:8001/tiles/{z}/{x}/{y}.png`;

  // `layerGroup` with two members. The lower one is always shown, the higher one only above the given zoom level.
  const lowTileLayer = L.tileLayer(tileUrl, {
    maxNativeZoom: 6,
    zIndex: 200,
  });
  const highTileLayer = L.tileLayer(tileUrl, {
    minZoom: 7,
    maxNativeZoom: 12,
    zIndex: 201,
  });


  const { type, crs, features } = waterFeatures;

  const areas = {
    type, crs,
    features: features.filter(v => v.geometry.type === 'Polygon' || v.geometry.type === 'MultiPolygon'),
  };
  const lines = {
    type, crs,
    features: features.filter(v => v.geometry.type === 'LineString' || v.geometry.type === 'MultiLineString'),
  };

  const lineLayer = L.geoJSON(lines, {
    style: {
      stroke: true,
      fill: false,
      color: '#758591',
      weight: 2,
      renderer,
      pmIgnore: true,  // do not use as GeoJSON filter
    },
    pane: 'tilePane',
  });
  const areaLayer = L.geoJSON(areas, {
    style: {
      stroke: false,
      fill: true,
      fillColor: '#758591',
      fillOpacity: 1,
      renderer,
      pmIgnore: true,  // do not use as GeoJSON filter
    },
    pane: 'tilePane',
  });

  // make addable and removable without disturbing order
  const highTileGroup = L.layerGroup([highTileLayer]);
  const lineGroup = L.layerGroup([lineLayer]);

  const tileLayer = L.layerGroup([
    lowTileLayer,
    highTileGroup,
    lineGroup,
    areaLayer,
  ], {
    attribution: 'Made with Natural Earth. Map tiles &copy; 2024 <a href="https://darus.uni-stuttgart.de/dataset.xhtml?persistentId=doi:10.18419/darus-3837" target="_blank">Max Franke</a>',
  });

  function onZoom() {
    const zoom = this.getZoom();

    if (zoom >= 7 && !highTileGroup.hasLayer(highTileLayer)) highTileGroup.addLayer(highTileLayer);
    if (zoom < 7 && highTileGroup.hasLayer(highTileLayer)) highTileGroup.removeLayer(highTileLayer);

    if (zoom >= 5 && !lineGroup.hasLayer(lineLayer)) lineGroup.addLayer(lineLayer);
    if (zoom < 5 && lineGroup.hasLayer(lineLayer)) lineGroup.removeLayer(lineLayer);

    lineLayer.setStyle({
      weight: zoom < 7 ? 1 : 2,
    })
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
