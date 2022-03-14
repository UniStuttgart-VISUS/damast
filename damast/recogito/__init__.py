import flask
import werkzeug.exceptions

from urllib3.util import parse_url, Url

from ..postgres_rest_api.decorators import rest_endpoint
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

# authentification module
auth = flask.current_app.config['auth']

# this is where we pre-define endpoints
app = AuthenticatedBlueprintPreparator('annotator-recogito', __name__, template_folder='templates')

@app.route('/', role=['annotator', 'dev', 'admin'])
@rest_endpoint
def root(cursor):
    document_id = flask.request.args.get('d', None)
    if document_id is None:
        u = parse_url(flask.request.full_path)
        u2 = Url(u.scheme, u.auth, u.host, u.port, u.path, 'd=2', u.fragment)
        return flask.redirect(u2.url)

    did = int(document_id)
    document = cursor.one('SELECT * FROM document WHERE id = %s;', (did,))
    if document is None:
        raise werkzeug.exceptions.NotFound(F'No document with ID {did}.')

    print(bytes(document.content).decode('utf-8')[:200])

    return flask.render_template('recogito/index.html', content=bytes(document.content).decode('utf-8'))

@app.route('/<path:path>', role=['annotator', 'dev', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(__path__[0] + '/static', path)

