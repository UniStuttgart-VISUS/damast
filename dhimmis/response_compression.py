import flask
import gzip
import brotli
import werkzeug.exceptions
from io import BytesIO as IO

compress = flask.Blueprint('compress-response', __name__)

_brotli_mimetypes = (
        'text/plain',
        'text/html',
        'text/css',
        'text/csv',
        'text/javascript',
        'application/json',
        'image/svg+xml',
        'text/xml', 'application/xml',
        )

@compress.after_app_request
def _maybe_compress(response):
    '''
    Check if the Accept-Encoding header of the request allows for compression.
    If yes, do Brotli or gzip compression conditionally.
    '''
    if 'Content-Encoding' in response.headers:
        return response

    elif response.status_code < 200 \
            or response.status_code >= 300 \
            or response.content_type == 'application/gzip':
                response.headers['Content-Encoding'] = 'identity'

    elif 'br' in flask.request.accept_encodings \
            and response.mimetype in _brotli_mimetypes:
                response.direct_passthrough = False

                compressed = brotli.compress(response.data,
                        mode=brotli.MODE_TEXT,
                        quality=5)

                response.data = compressed
                response.headers['Content-Encoding'] = 'br'
                response.headers.extend(dict(Vary='Accept-Encoding'))
                response.headers['Content-Length'] = len(response.data)

    elif 'gzip' in flask.request.accept_encodings:
        response.direct_passthrough = False

        gzip_buffer = IO()
        gzip_file = gzip.GzipFile(mode='wb',
                                  fileobj=gzip_buffer,
                                  compresslevel=6)
        gzip_file.write(response.data)
        gzip_file.close()

        response.data = gzip_buffer.getvalue()
        response.headers['Content-Encoding'] = 'gzip'
        response.headers.extend(dict(Vary='Accept-Encoding'))
        response.headers['Content-Length'] = len(response.data)

    elif 'identity' in flask.request.accept_encodings \
            and flask.request.accept_encodings.quality('identity') == 0:
                exc = werkzeug.exceptions.NotAcceptable()
                return exc.get_response()

    else:
        response.headers['Content-Encoding'] = 'identity'


    return response
