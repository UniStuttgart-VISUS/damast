import flask
import psycopg2
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .decorators import rest_endpoint

name = 'religion'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/religions', role='user')
@rest_endpoint
def get_all_religions(c):
    '''
    Get a hierarchy of religions.

    @returns            application/json

    This utilizes the `parent_id` attribute in the table `religion` to build a
    list of trees. The return value is an array of JSON objects. Each root node
    is a main religion, and one of its attributes is `children`, holding an
    array of children, which may again hold children, and so on.

    Each node of each tree has the following, exemplary (2020-01-09) structure:

        {
            "abbreviation": "MARO",
            "children": [ ... ],
            "color": "hsl(10, 80%, 50%)",
            "id": 3,
            "name": "Maronite Church",
            "parent_id": 98
        }
    '''
    c.execute('select * from religion')
    data = list(map(lambda x: x._asdict(), c.fetchall()))

    def append_children(parent, lst):
        children = list(filter(lambda x: x['parent_id'] == parent['id'], lst))
        parent['children'] = children
        for child in children:
            append_children(child, lst)
        return parent

    toplevel = list(map(lambda x: append_children(x, data), filter(lambda x: x['parent_id'] is None, data)))

    return flask.jsonify(toplevel)


@app.route('/religion-list', role='user')
@rest_endpoint
def get_religion_list(c):
    '''
    Get a list of religion names and IDs.

    @returns            application/json

    Example return value excerpt:

        [
          {
            "id": 1,
            "name": "Christianity",
            "parent_id": null
          },
          {
            "id": 5,
            "name": "Church of the East",
            "parent_id": 1
          },
          ...
        ]
    '''
    c.execute('select id, name, parent_id from religion')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))
