import flask
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint

name = 'license'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/license', optional=True)
def root():
    '''
    Get the license
    '''
    return flask.render_template('docs/license.html')


@app.route('/license/static/<path:filename>')
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/license', filename)
