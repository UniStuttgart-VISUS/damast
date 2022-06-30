import flask
import psycopg2
import json
from ...authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from ..decorators import rest_endpoint

name = 'external-database'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/external-database-list', role=['user', 'visitor'])
@rest_endpoint
def get_external_database_list(c):
    '''
    Get a list of external databases registered.

    @returns            application/json

    This returns a list of all external_database tuples in the database as an array.

    Example return value excerpt:

        [
          {
            "id": 1,
            "name": "Foo: the foo database",
            "short_name": "Foo",
            "url": "http://foo.bar/",
            "comment": null
          },
          ...
        ]
    '''
    c.execute('SELECT * FROM external_database;')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))

