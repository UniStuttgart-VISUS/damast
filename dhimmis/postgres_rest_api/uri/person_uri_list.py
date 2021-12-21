import flask
import psycopg2
import json
from ...authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from ..decorators import rest_endpoint

name = 'person-uri-list'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/external-person-uri-list', role='user')
@rest_endpoint
def get_uri_list(c):
    '''
    Get a list of external person URIs.

    @returns            application/json

    Example return value excerpt for `GET /rest/uri/external-person-uri-list`:

        [
          {
            "id": 1,
            "person_id": 12,
            "uri_namespace_id": 1,
            "uri_fragment": "27223",
            "comment": null
          }
          ...
        ]
    '''
    c.execute('SELECT * FROM external_person_uri;')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))

