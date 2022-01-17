import flask
import werkzeug.exceptions
from .authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'map-styles'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None, static_folder=None)

_styles = [
  {
    'key': "light",
    'url': 'https://api.mapbox.com/styles/v1/mfranke/ckg0r0rkg2gjr19of0s0ox6oq/tiles/256/{z}/{x}/{y}?access_token={accessToken}',
    'name': 'MapBox Custom Light',
    'default_': True,
    'is_mapbox': True,
    'options': {
      'accessToken': 'pk.eyJ1IjoibWZyYW5rZSIsImEiOiJjam0yNGFmd3EwYXFhM3B0YWpkd3ZsZGd0In0.NokTlNyaWNFG82lHN3eObg',
      'attribution': '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
    },
  },
  {
    'key': "dare",
    'url': 'https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png',
    'name': 'Digital Atlas of the Roman Empire',
    'is_mapbox': False,
    'options': {
      'attribution': 'Creative Commons Attribution 4.0 International license (CC BY 4.0)',
    },
  },
  ]

@app.route('/map-styles', role='readdb')
def get_map_styles():
    '''
    Get the Leaflet map styles available.

    This blueprint is used in multiple places: for the visualization, the
    GeoDB-Editor, and the place URI page.
    '''

    return flask.jsonify(_styles)
