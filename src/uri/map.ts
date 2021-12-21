import * as L from 'leaflet';
import { map_styles } from '../common/map-styles';

const mapPane: HTMLDivElement = document.querySelector('div.map:not(.map--none)');
if (mapPane) {
  const lat = parseFloat(mapPane.getAttribute('data-lat'));
  const lng = parseFloat(mapPane.getAttribute('data-lng'));

  const map = L.map(mapPane, {
    zoomControl: false,
    center: [lat, lng],
    zoom: 8,
    layers: [
      L.tileLayer(map_styles[0].url, map_styles[0].options),
      L.marker({lat, lng}, {
        icon: L.icon({
          iconUrl: '../uri/images/marker-icon-blue.png',
          iconRetinaUrl: '../uri/images/marker-icon-2x-blue.png',
          shadowUrl: '../uri/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }),
    ],
  });

  const mapbox_attribution = new L.Control({position: 'bottomleft'});
  mapbox_attribution.onAdd = function(_) {
    const div = L.DomUtil.create('div', 'attribution');
    div.innerHTML = `<a href="http://mapbox.com/about/maps" class='mapbox-wordmark' target="_blank">Mapbox</a>`;
    return div;
  };
  mapbox_attribution.addTo(map);
}
