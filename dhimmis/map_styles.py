import flask
import werkzeug.exceptions
from .authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'map-styles'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None, static_folder=None)

_styles = [
  {
    'key': "mapbox",
    'url': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'name': 'OpenStreetMap',
    'default_': True,
    'is_mapbox': False,
    'options': {
      'attribution': '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>',
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
