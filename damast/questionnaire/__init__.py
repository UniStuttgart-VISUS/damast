import flask
import uuid
import os.path
import datetime
import pathlib
import json
from functools import lru_cache
from contextlib import contextmanager
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

template = './templates'
app = AuthenticatedBlueprintPreparator('questionnaire', __name__, template_folder=template)

auth = flask.current_app.config['auth']

@app.route('/', role=['vis', 'admin'], methods=['GET'])
def root():
    return flask.render_template('questionnaire/questionnaire.html')


@app.route('/submit', role=['vis', 'admin'], methods=['POST'])
def post_feedback():
    u = str(uuid.uuid1())
    with feedback_file(u) as f:
        data = dict(flask.request.form)
        data['uuid'] = u
        data['time-received'] = datetime.datetime.now().astimezone().isoformat()
        data['user-agent'] = str(flask.request.user_agent)
        json.dump(data, f)

    return flask.render_template('questionnaire/thanks.html')


@app.route('/<path:path>', role=['vis', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(__path__[0] + '/static', path)


@contextmanager
def feedback_file(u):
    fname = os.path.join('/data', 'feedback', F'{u}.json')
    pathname = os.path.dirname(fname)
    pathlib.Path(pathname).mkdir(parents=True, exist_ok=True)
    f = open(fname, 'w')
    yield f
    f.close()
