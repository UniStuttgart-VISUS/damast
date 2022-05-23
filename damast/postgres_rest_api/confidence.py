import flask
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .decorators import rest_endpoint

name = 'confidence'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/confidence-values', role=['user', 'visitor'])
@rest_endpoint
def get_confidence_list(c):
    '''
    Get a list of all confidence values.

    @returns        application/json

    Example return value:

      ['false', 'uncertain', 'contested', 'probable', 'certain']

    '''
    c.execute('SELECT unnest(enum_range(NULL::confidence_value));')
    return flask.jsonify(list(map(lambda x: x[0], c.fetchall())))

