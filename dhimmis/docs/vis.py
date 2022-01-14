import flask
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'vis'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/vis', role=['vis'])
def root():
    return flask.render_template('docs/vis.html')


@app.route('/vis/static/<path:filename>', role=['vis'])
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/vis', filename)
