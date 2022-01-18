import { json } from 'd3-fetch';

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

export const map_styles: MapStyle[] = [
  {
    key: "light",
    url: 'https://api.mapbox.com/styles/v1/mfranke/ckg0r0rkg2gjr19of0s0ox6oq/tiles/256/{z}/{x}/{y}?access_token={accessToken}',
    name: 'MapBox Custom Light',
    default_: true,
    is_mapbox: true,
    options: {
      accessToken: 'pk.eyJ1IjoibWZyYW5rZSIsImEiOiJjam0yNGFmd3EwYXFhM3B0YWpkd3ZsZGd0In0.NokTlNyaWNFG82lHN3eObg',
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
    },
  },
  {
    key: "dare",
    url: 'https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png',
    name: 'Digital Atlas of the Roman Empire',
    is_mapbox: false,
    options: {
      attribution: 'Creative Commons Attribution 4.0 International license (CC BY 4.0)',
    },
  },
];

export async function mapStyles(): Promise<MapStyle[]> {
  return json('./map-styles');
}
