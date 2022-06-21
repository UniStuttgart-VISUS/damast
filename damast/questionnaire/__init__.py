import flask
import subprocess
from functools import lru_cache
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

template = './templates'
app = AuthenticatedBlueprintPreparator('questionnaire', __name__, template_folder=template)

auth = flask.current_app.config['auth']

@app.route('/', role=['vis', 'admin'], methods=['POST'])
def root():
    print(flask.request.form)
    return flask.render_template('questionnaire/thanks.html')

