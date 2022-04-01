import flask
import psycopg2
import json
from ...authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from ..decorators import rest_endpoint

name = 'uri-namespace'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/uri-namespace-list', role='user')
@rest_endpoint
def get_uri_namespace_list(c):
    '''
    Get a list of URI namespaces registered.

    @returns            application/json

    This returns a list of all uri_namespace tuples in the database as an array.

    Example return value excerpt:

        [
          {
            "id": 1,
            "external_database_id", 1,
            "uri_pattern": "https://first.db/place/%s",
            "short_name": "first:%s",
            "comment": null
          }
          ...
        ]
    '''
    c.execute('SELECT * FROM uri_namespace;')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))

