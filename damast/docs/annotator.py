import flask
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'annotator'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/annotator', role=['annotator', 'dev'])
def root():
    return flask.render_template('docs/annotator.html')


@app.route('/annotator/static/<path:filename>', role=['annotator', 'dev'])
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/annotator', filename)
