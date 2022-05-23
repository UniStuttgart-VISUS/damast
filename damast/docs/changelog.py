import flask
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint

name = 'changelog'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/changelog', role=['user', 'visitor'])
def root():
    '''
    Get a version changelog.
    '''
    return flask.render_template('docs/changelog.html')


@app.route('/changelog/static/<path:filename>', role=['user', 'visitor'])
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/changelog', filename)
