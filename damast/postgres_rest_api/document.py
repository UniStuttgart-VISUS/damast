import flask
import re
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .decorators import rest_endpoint
from ..document_fragment import extract_fragment

name = 'document'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/document/list', methods=['GET'], role='user')
@rest_endpoint
def document_list(cursor):
    '''
    GET a list of all documents.


    Example return value excerpt:

        [
          {
            "comment": "Michael Rabo, Chronography",
            "content_length": 3012062,
            "content_type": "text/html;charset=UTF-8",
            "default_source_confidence": null,
            "document_version": 1,
            "id": 3,
            "source_id": 67,
            "source_name": "Michael der Syrer; Moosa, Matti (2014): The Syriac ...",
            "source_type": "Primary source"
          },
          ...
        ]
    '''
    cursor.execute('''SELECT
        D.id,
        S.id AS source_id,
        S.name AS source_name,
        ST.name AS source_type,
        S.default_confidence AS default_source_confidence,
        D.version AS document_version,
        D.comment,
        D.content_type,
        length(D.content) AS content_length
    FROM
        document D
    JOIN source S
        ON D.source_id = S.id
    JOIN source_type ST
        ON S.source_type_id = ST.id;''')

    content = list(map(lambda x: x._asdict(), cursor.fetchall()))
    return flask.jsonify(content)


@app.route('/document/<int:document_id>/metadata', methods=['GET'], role='user')
@rest_endpoint
def document_metadata(cursor, document_id):
    '''
    CRUD endpoint to get document metadata for a document.


    GET       @param document_id            ID of document
              @returns                      application/json


    Example return value for `/document/3/metadata`:

      {
        "comment": "Michael Rabo, Chronography",
        "content_length": 2926379,
        "content_type": "text/html;charset=UTF-8",
        "default_source_confidence": null,
        "document_version": 1,
        "id": 3,
        "source_id": 67,
        "source_name": "Michael der Syrer; Moosa, Matti (2014): The Syriac ...",
        "source_type": "Primary source"
      }
    '''
    content = cursor.one('''SELECT
        D.id,
        S.id AS source_id,
        S.name AS source_name,
        ST.name AS source_type,
        S.default_confidence AS default_source_confidence,
        D.version AS document_version,
        D.comment,
        D.content_type,
        D.content_length
    FROM
        document D
    JOIN source S
        ON D.source_id = S.id
    JOIN source_type ST
        ON S.source_type_id = ST.id
    WHERE d.id = %s;''', (document_id,))

    if content is None:
        raise werkzeug.exceptions.NotFound(F'No document with ID {document_id}')

    return flask.jsonify(content._asdict())


_bytes_spec = re.compile('(bytes|document-characters)=(?P<start>\\d*)-(?P<end>\\d*)')
_characters_spec = re.compile('document-characters=(?P<start>\\d*)-(?P<end>\\d*)')
@app.route('/document/<int:document_id>', methods=['GET'], role='user')
@rest_endpoint
def document(cursor, document_id):
    '''
    CRUD endpoint to get document content for a document.

    GET       @param document_id            ID of document
              @returns                      document.content_type

    This endpoint gets the actual document data for the document with ID
    `document_id`. Because those documents can be quite large, this endpoint
    supports the `Range` HTTP header, but only in the following forms:

        For `text/plain` type documents: `Range: bytes=[n]-[m]`
        For `text/html` type documents: `Range: content-characters=[n]-[m]`

    where `[n]` and `[m]` are both optional numbers. A range
    header with more than one range is not supported at the moment. The return
    code of the request is either 200 or 206 for successful requests, 416, 400
    or 404 for unsuccessful requests.

    SIDENOTE: The `<unit>=-<suffix-length>` variant of the `Range` header is
    currently not supported correctly, but instead is interpreted as
    `<unit>=0-<suffix-length>`.
    '''
    # TODO: suffix-length
    content = cursor.one('''SELECT
        content,
        content_type,
        content_length
    FROM
        document
    WHERE
        id = %s;''', (document_id,))

    if content is None:
        raise werkzeug.exceptions.NotFound(F'No document with ID {document_id}')

    barr = content.content.tobytes()
    length = content.content_length

    range_ = flask.request.headers.get('Range', None)

    headers = dict()
    return_code = 200

    if range_ is not None:
        if 'text/plain' in content.content_type:
            start, end = _calc_range(_bytes_spec, range_, 'Only a single range of bytes supported', length)

            if start > 0 or end < length-1:
                return_code = 206
                headers['Content-Range'] = F'bytes {start}-{end}/{length}'
                barr = barr[start:end+1]

        elif 'text/html' in content.content_type:
            start, end = _calc_range(_characters_spec, range_, 'Only a single range of characters supported', length)
            if start > 0 or end < length-1:
                return_code = 206
                headers['Content-Range'] = F'content-characters {start}-{end}/{length}'
                barr = extract_fragment(barr, start, end+1)
        else:
            raise werkzeug.exceptions.RequestedRangeNotSatisfiable(length, description=F'Document content type \'{content.content_type}\' does not support range requests.')

    resp = flask.Response(barr, content_type=content.content_type, headers=headers)

    return resp, return_code

def _calc_range(regex, range_, err_msg, length):
    m = regex.fullmatch(range_)
    if not m:
        raise werkzeug.exceptions.RequestedRangeNotSatisfiable(description=err_msg, length=length)

    start = int(m['start']) if len(m['start']) > 0 else 0
    end = int(m['end']) if len(m['end']) > 0 else length-1

    if start > end or end >= length or start < 0:
        raise werkzeug.exceptions.RequestedRangeNotSatisfiable(description=F'Range outside of valid range (0-{length-1})', length=length)

    return start, end
