import flask
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .decorators import rest_endpoint

name = 'language'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/languages-list', role=['user', 'visitor'])
@rest_endpoint
def get_languages_list(c):
    '''
    Get a list of all religions.

    @returns        application/json

    This returns a JSON array of objects with `id` and `name` from table
    `language`. This API endpoint replaces `/LanguagesList` in the old servlet
    implementation.

    Example return value excerpt:

      [
        {
          "id": 1,
          "name": "Arabic - DMG"
        },
        {
          "id": 2,
          "name": "Arabic - AS"
        },
        ...
      ]

    '''
    c.execute('select id, name from language order by id asc')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))
