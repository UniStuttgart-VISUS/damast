import flask
import werkzeug.exceptions
import os
import os.path
import json
import jsonschema
import logging
from .authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'map-styles'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None, static_folder=None)

_default_styles = [
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

_logger = logging.getLogger('flask.error')

_schema_path = os.path.join(flask.current_app.root_path, 'vis/static/schemas', 'map-styles.json')
with open(_schema_path) as f:
    _cont = json.load(f)
    _schema = jsonschema.Draft7Validator(_cont)

_styles = None
if 'DHIMMIS_MAP_STYLES' not in os.environ:
    _styles = _default_styles
    _logger.info('No map style file provided, default map tile selection will be used.')
else:
    dms = os.environ.get('DHIMMIS_MAP_STYLES')
    _styles_path = os.path.join('/data', dms)

    if not os.path.isfile(_styles_path):
        _logger.warning('Map style file configured, but does not exist. This might be an oversight. Default map tile selection will be used.')
    else:
        _logger.info('Map styles will be loaded from: %s', _styles_path)


def _get_styles():
    global _styles, _styles_path

    if _styles is not None:
        return _styles  # default styles

    if os.path.isfile(_styles_path):
        try:
            with open(_styles_path) as f:
                styles = json.load(f)

                if not _schema.is_valid(styles):
                    err = '\n'.join(map(str, _schema.iter_errors(styles)))
                    _logger.error('Provided map style file has errors, using default selection instead:\n%s', err)
                    return _default_styles

                return styles


        except IOError as err:
            _logger.error('Something went wrong when loading the map style file, using default selection: %s', err)
            return _default_styles

        except json.JSONDecodeError as err:
            _logger.error('Something went wrong when loading the map style file, using default selection: %s', err)
            return _default_styles

    return _default_styles


@app.route('/map-styles', role='readdb')
def get_map_styles():
    '''
    Get the Leaflet map styles available.

    This blueprint is used in multiple places: for the visualization, the
    GeoDB-Editor, and the place URI page.
    '''
    return flask.jsonify(_get_styles())
