import flask
import urllib.parse
import werkzeug.exceptions
import logging
import subprocess
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint
from ..document_fragment import extract_fragment, document_length
from .clean import clean_html

# this is where we pre-define endpoints
app = AuthenticatedBlueprintPreparator('annotator', __name__, template_folder='templates')

@app.route('/', role=['annotator', 'admin'])
@rest_endpoint
def root(cursor):
    document_id = flask.request.args.get('document_id', None)

    if document_id is not None:
        try:
            document_id = int(document_id)
            count = cursor.one('SELECT COUNT(*) FROM document WHERE id = %s;', (document_id,))
            if count == 0:
                document_id = None
                flask.flash('Invalid document ID', 'error')

        except ValueError:
            document_id = None
            flask.flash('Document ID is not a number', 'error')


    if document_id is None:
        query = cursor.mogrify('''SELECT
            D.id AS document_id,
            D.content as content,
            D.source_id AS source_id,
            D.version,
            D.comment,
            D.content_type,
            S.name AS source_name,
            S.short AS source_name_short,
            ST.name AS source_type,
            (
                SELECT COUNT(*) FROM annotation WHERE document_id = D.id
            ) AS num_annotations
        FROM
            document D
            JOIN source S ON D.source_id = S.id
            JOIN source_type ST ON S.source_type_id = ST.id;''', (document_id,))

        cursor.execute(query)
        documents = list(map(lambda x: x._asdict(), cursor.fetchall()))

        for doc in documents:
            # only first 1000 characters
            content = doc['content'].tobytes().decode('utf-8')

            if 'text/plain' in doc['content_type']:
                content = content[:1000]
            elif 'text/html' in doc['content_type']:
                x = extract_fragment(content, 0, 1000)
                content = x
            else:
                logging.getLogger('flask.error').warn('Unhandled content type for document with ID %d: %s.', doc['document_id'], doc['content_type'])
                content = ''

            doc['content'] = content

        return flask.render_template('annotator/select-document.html', documents=documents)

    return flask.render_template('annotator/annotator.html')


@app.route('/view-evidence/<int:evidence_id>', role=['annotator', 'admin'])
@rest_endpoint
def redirect_for_evidence(cursor, evidence_id):
    document_id = cursor.one('''SELECT DISTINCT A.document_id
FROM evidence E
LEFT JOIN place_instance PI ON E.place_instance_id = PI.id
LEFT JOIN person_instance PEI ON E.person_instance_id = PEI.id
LEFT JOIN religion_instance RI ON E.religion_instance_id = RI.id
LEFT JOIN time_group TG ON E.time_group_id = TG.id
JOIN annotation A ON A.id IN (
        PI.annotation_id,
        PEI.annotation_id,
        RI.annotation_id,
        TG.annotation_id
)
WHERE E.id = %s;''', (evidence_id,))
    if document_id is None:
        raise werkzeug.exceptions.NotFound(F'Evidence {evidence_id} was not created using the annotator.')

    url = flask.url_for('.root')
    (scheme, loc, path, _, __) = urllib.parse.urlsplit(url)
    fragment = str(evidence_id)
    query = urllib.parse.urlencode([('document_id', document_id)])
    next_ = urllib.parse.urlunsplit((scheme, loc, path, query, fragment))

    return flask.redirect(next_, 301)



@app.route('/<path:path>', role=['annotator', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(__path__[0] + '/static', path)


@app.route('/add-document', role=['annotator', 'admin'], methods=['GET', 'POST'])
@rest_endpoint
def add_document(cursor):
    if flask.request.method == 'GET':
        cursor.execute("SELECT id, format('%s: %s', short, name) AS name FROM source ORDER BY name ASC;")
        sources = cursor.fetchall()
        return flask.render_template('annotator/create-document.html', sources=sources)

    elif flask.request.method == 'POST':
        bytes_ = flask.request.files['content'].read()
        content = bytes_.decode('utf-8')

        content_type = flask.request.form['content_type']

        if content_type == 'text/plain;charset=UTF-8':
            length = len(content)
        elif content_type == 'text/html;charset=UTF-8':
            content = clean_html(content)
            bytes_ = content.encode('utf-8')
            length = document_length(content)
        else:
            raise werkzeug.exceptions.UnsupportedMediaType('Only plain text and HTML files allowed!')

        source_id = int(flask.request.form['source_id'])
        version = flask.request.form['version']
        comment = flask.request.form['comment']

        document_id = cursor.one('''INSERT INTO document (
            source_id,
            version,
            comment,
            content_type,
            content_length,
            content
        ) VALUES (
            %(source_id)s,
            %(version)s,
            %(comment)s,
            %(content_type)s,
            %(content_length)s,
            %(content)s
        ) RETURNING id;''', content=bytes_,
               content_type=content_type,
               content_length=length,
               source_id=source_id,
               version=version,
               comment=comment)

        return flask.redirect(flask.url_for('annotator.root') + F'?document_id={document_id}')
    else:
        raise werkzeug.exceptions.MethodNotAllowed()


@app.route('/trigger-annotation-suggestion-refresh', role=['admin'])
def trigger_rebuild():
    from .suggestions import start_refresh_job
    logging.getLogger('flask.error').info(F'Manually triggering annotation suggestion refresh.')
    start_refresh_job()

    return '', 204
