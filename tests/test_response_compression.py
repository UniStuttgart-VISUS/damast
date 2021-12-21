import pytest
import dhimmis
import flask
import os
import os.path
import tempfile
import shutil
import datetime
import jwt
import brotli
import gzip
import warnings
from urllib.parse import quote
from functools import namedtuple


@pytest.fixture
def login_headers(client_ro, normal_user):
    user, password = normal_user
    username = user.name

    rv = client_ro.post('/login', data=dict(username=username, password=password), follow_redirects=False)
    headers = dict(Cookie=rv.headers.get('Set-Cookie'))

    # clean up message flashes for comparability
    rv = client_ro.get('/', headers=headers)
    return dict(Cookie=rv.headers.get('Set-Cookie'))


Url = namedtuple('Url', ['url', 'has_brotli'])
_test_cases = [
        Url('/', True),
        Url('/rest/religion-list', True),
        Url('/rest/religions', True),
        Url('/rest/place/all', True),
        Url('/impressum.html', True),
        Url('/static/public/base.css', True),
        Url('/static/public/dsgvo.css', True),
        Url('/static/public/40x.css', True),
        Url('/static/public/font-awesome/fonts/fontawesome-webfont.svg', True),
        Url('/static/public/font-awesome/fonts/fontawesome-webfont.ttf', True),
        Url('/static/public/font-awesome/fonts/fontawesome-webfont.eot', True),
        Url('/static/public/font-awesome/fonts/fontawesome-webfont.woff', True),
        Url('/static/public/font-awesome/fonts/fontawesome-webfont.woff2', True),
        Url('/static/public/favicon.png', True),
        Url('/docs/schema', True),
        Url('/rest/dump', False),
        ]

@pytest.fixture(params=_test_cases)
def test_case(request):
    return request.param


AcceptEncoding = namedtuple('AcceptEncoding', ['list', 'expect', 'fallback', 'acceptable'])
_accept_encodings = [
        AcceptEncoding(None, 'identity', 'identity', True),
        AcceptEncoding('identity', 'identity', 'identity', True),
        AcceptEncoding('deflate', 'identity', 'identity', True),
        AcceptEncoding('deflate, br', 'br', 'identity', True),
        AcceptEncoding('deflate, gzip, br', 'br', 'gzip', True),
        AcceptEncoding('bz2, gzip, br', 'br', 'gzip', True),
        AcceptEncoding('bz2, gzip', 'gzip', 'gzip', True),
        AcceptEncoding('gzip, deflate', 'gzip', 'gzip', True),
        AcceptEncoding('gzip, deflate, identity', 'gzip', 'gzip', True),
        AcceptEncoding('gzip, br, deflate, identity', 'br', 'gzip', True),
        AcceptEncoding('br, deflate, identity', 'br', 'identity', True),
        AcceptEncoding('gzip, identity;q=0', 'gzip', 'gzip', True),
        AcceptEncoding('stupid, identity;q=0', None, None, False),
        ]

@pytest.fixture(params=_accept_encodings)
def accept(request):
    return request.param


def test_response_compression(client_ro, normal_user, login_headers, test_case, accept):
    headers = { **login_headers }
    if accept.list is not None:
        headers['Accept-Encoding'] = accept.list

    rv = client_ro.get(test_case.url, headers=headers, follow_redirects=True)
    ce = rv.headers.get('Content-Encoding', None)

    if not accept.acceptable:
        assert rv.status_code == 406
        return

    expect = accept.expect if test_case.has_brotli else accept.fallback if test_case.url != '/rest/dump' else 'identity'  # dump is application/gzip with identity
    assert ce == expect, rv.status_code

    if ce == 'identity' or ce is None:
        pass
    elif ce == 'br':
        r1d = brotli.decompress(rv.data)

        del headers['Accept-Encoding']
        r2 = client_ro.get(test_case.url, headers=headers, follow_redirects=True)

        assert r1d == r2.data
        if len(rv.data) >= len(r2.data):
            warnings.warn('Brotli compression increased file size', UserWarning)

    elif ce == 'gzip':
        r1d = gzip.decompress(rv.data)

        del headers['Accept-Encoding']
        r2 = client_ro.get(test_case.url, headers=headers, follow_redirects=True)

        assert r1d == r2.data
        if len(rv.data) >= len(r2.data):
            warnings.warn('GZIP compression increased file size', UserWarning)

    else:
        assert False, ce

