import flask
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .decorators import rest_endpoint
from .user_action import add_user_action
from ..document_fragment import inner_text, extract_fragment

name = 'annotation-suggestion'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/annotation-suggestion/<int:as_id>', methods=['DELETE'], role='user')
@rest_endpoint
def delete_annotation_suggestion(cursor, as_id):
    '''
    Delete an annotation suggestion.
    '''

    del_id = cursor.one('DELETE FROM annotation_suggestion WHERE id = %s RETURNING id;', (as_id,))
    if del_id is None:
        raise werkzeug.exceptions.NotFound(F'No annotation suggestion with ID {as_id}.')

    return flask.jsonify(dict(annotation_suggestion=del_id)), 200


@app.route('/document/<int:document_id>/annotation-suggestion-list', methods=['GET'], role='user')
@rest_endpoint
def document_annotation_suggestion_list(cursor, document_id):
    '''
    REST endpoint to get a list of annotation suggestions associated with a document.
    '''
    if 0 == cursor.one('SELECT COUNT(*) FROM document WHERE id = %s;', (document_id,)):
        raise werkzeug.exceptions.NotFound(F'No document with ID {document_id}.')

    query = cursor.mogrify('SELECT * FROM annotation_suggestion WHERE document_id = %s;', (document_id,))
    cursor.execute(query)

    return flask.jsonify(list(map(lambda x: x._asdict(), cursor.fetchall())))


