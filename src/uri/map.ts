import { map as leafletMap, marker, tileLayer, icon, Control, DomUtil } from 'leaflet';
import { mapStyles } from '../common/map-styles';

const mapPane: HTMLDivElement = document.querySelector('div.map:not(.map--none)');
if (mapPane) {
  const lat = parseFloat(mapPane.getAttribute('data-lat'));
  const lng = parseFloat(mapPane.getAttribute('data-lng'));

  mapStyles().then(map_styles => {
    const map = leafletMap(mapPane, {
      zoomControl: false,
      center: [lat, lng],
      zoom: 8,
      layers: [
        tileLayer(map_styles[0].url, map_styles[0].options),
        marker({lat, lng}, {
          icon: icon({
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

    if (map_styles[0].is_mapbox) {
      const mapbox_attribution = new Control({position: 'bottomleft'});
      mapbox_attribution.onAdd = function(_) {
        const div = DomUtil.create('div', 'attribution');
        div.innerHTML = `<a href="http://mapbox.com/about/maps" class='mapbox-wordmark' target="_blank">Mapbox</a>`;
        return div;
      };
      mapbox_attribution.addTo(map);
    }
  });
}
