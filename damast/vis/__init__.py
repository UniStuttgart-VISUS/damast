import flask
import subprocess
from functools import lru_cache
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..map_styles import app as map_styles

static = __path__[0] + '/static'
template = './templates'
app = AuthenticatedBlueprintPreparator('vis', __name__, template_folder=template)
app.register_blueprint(map_styles)

auth = flask.current_app.config['auth']

@app.route('/', role=['vis', 'admin'])
def root():
    return flask.render_template('vis/index.html', message=get_message())

@app.route('/<path:path>', role=['vis', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(static, path)

@lru_cache(1)
def get_message():
    return flask.current_app.version

@app.route('/info/<path:path>', role=['vis', 'admin'])
def get_info_dialog(path):
    return _render_standalone_info(F'vis/info/{path}')

@app.route('/info-standalone', role=['vis', 'admin'])
def get_empty_dialog():
    return _render_standalone_info()

def _render_standalone_info(content=None):
    return flask.render_template('vis/standalone-info.html',
            title=flask.request.args.get('title', default='[no title]', type=str),
            content=content,
            info_css_file='../static/info.css')

@app.route('/snippet/<path:path>', role=['vis', 'admin'])
def get_snippet(path):
    return flask.render_template(F'vis/info/{path}')


@app.route('/water-features.geo.json', role=['vis', 'geodb', 'admin'])
def get_geojson():
    resp = flask.send_file('reporting/map-data/features.geo.json.gz', 'application/json')
    resp.headers['Content-Encoding'] = 'gzip'
    return resp
