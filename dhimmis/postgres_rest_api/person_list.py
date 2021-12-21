import flask
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .decorators import rest_endpoint

name = 'person-list'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/person-list', role='user')
@rest_endpoint
def person_list(cursor):
    '''
    Get content of table `person` as a list of dicts.

    @return     application/json
    '''
    cursor.execute('select * from person;')

    return flask.jsonify(list(map(lambda x: x._asdict(), cursor.fetchall())))
