import flask
import subprocess
from functools import lru_cache
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

static = __path__[0] + '/static'
app = AuthenticatedBlueprintPreparator('uri', __name__)

from .place import app as place_app
app.register_blueprint(place_app, url_prefix='/place')

@app.route('/uri/<path:path>', role='user')
def file(path):
    return flask.current_app.serve_static_file(static, path)

