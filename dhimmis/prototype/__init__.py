import flask
import subprocess
from functools import lru_cache
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

static = __path__[0] + '/static'
template = './templates'
app = AuthenticatedBlueprintPreparator('vis', __name__, template_folder=template)

auth = flask.current_app.config['auth']

@app.route('/', role=['vis', 'admin'])
def root():
    return flask.render_template('prototype/index.html', message=get_message())

@app.route('/<path:path>', role=['vis', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(static, path)

@lru_cache(1)
def get_message():
    return flask.current_app.version

@app.route('/info/<path:path>', role=['vis', 'admin'])
def get_info_dialog(path):
    print(path)
    return flask.render_template('prototype/standalone-info.html',
            title=flask.request.args.get('title', default='[no title]', type=str),
            content='prototype/info/'+path,
            info_css_file='../static/info.css')

@app.route('/snippet/<path:path>', role=['vis', 'admin'])
def get_snippet(path):
    return flask.render_template(F'prototype/info/{path}')
