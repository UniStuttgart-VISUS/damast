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


@pytest.fixture(scope='module', autouse=True, params=[
    ])
def environment(request):
    return request.param


@pytest.fixture(scope='module', autouse=True)
def url_prefix(environment):
    return environment[0]


@pytest.fixture(scope='module', autouse=True)
def env_variable(environment):
    return environment[1]


@pytest.fixture(scope='module', autouse=True)
def roles(environment):
    return environment[2]


filecontents = [
        ('index.html', b'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>title</title>
</head>
<body>
  Hello World!
</body>
</html>'''),
        ('a.txt', b'iO4kXS3KNh4lugLJMW1pOZrDpY'),
        ('test.css', b'a { color: red; }'),
        ('t.png', b'b { color: blue; }'),
        ('x.json', b'{ "color": "blue"; "binary": true }'),
        ]

@pytest.fixture(params=filecontents)
def filecontent(request):
    return request.param


CompressionCase = namedtuple('TestCase', ['dir', 'identity', 'brotli', 'gzip'])
_test_cases = [
    CompressionCase('plain', True, False, False),
    CompressionCase('br', False, True, False),
    CompressionCase('gzip', False, False, True),
    CompressionCase('a', False, True, True),
    CompressionCase('b', True, False, True),
    CompressionCase('c', True, True, False),
    CompressionCase('d', True, True, True),
        ]

@pytest.fixture(params=_test_cases)
def compression_combination(request):
    return request.param


def create(path):
    for fname, content in filecontents:
        for tc in _test_cases:
            d = os.path.join(path, tc.dir, os.path.dirname(fname))
            if d != '':
                os.makedirs(d, exist_ok=True)

            if tc.identity:
                with open(os.path.join(path, tc.dir, fname), 'xb') as f:
                    f.write(content)
            if tc.brotli:
                with open(os.path.join(path, tc.dir, fname + '.br'), 'xb') as f:
                    f.write(brotli.compress(content))
            if tc.gzip:
                with open(os.path.join(path, tc.dir, fname + '.gz'), 'xb') as f:
                    f.write(gzip.compress(content))


@pytest.fixture(scope='module', autouse=True)
def testdir(env_variable):
    os.environ[env_variable] = tempfile.mkdtemp(dir='/dev/shm')
    create(os.environ[env_variable])

    yield

    shutil.rmtree(os.environ[env_variable])


@pytest.fixture
def login_headers(client, normal_user):
    user, password = normal_user
    username = user.name

    rv = client.post('/login', data=dict(username=username, password=password), follow_redirects=False)
    headers = dict(Cookie=rv.headers.get('Set-Cookie'))

    # clean up message flashes for comparability
    rv = client.get('/', headers=headers)
    return dict(Cookie=rv.headers.get('Set-Cookie'))



AcceptEncoding = namedtuple('AcceptEncoding', ['list', 'acceptable'])
_accept_encodings = [
        AcceptEncoding(None, True),
        AcceptEncoding('identity', True),
        AcceptEncoding('deflate', True),
        AcceptEncoding('deflate, br', True),
        AcceptEncoding('deflate, gzip, br', True),
        AcceptEncoding('bz2, gzip, br', True),
        AcceptEncoding('bz2, gzip', True),
        AcceptEncoding('gzip, deflate', True),
        AcceptEncoding('gzip, deflate, identity', True),
        AcceptEncoding('gzip, br, deflate, identity', True),
        AcceptEncoding('br, deflate, identity', True),
        AcceptEncoding('gzip, identity;q=0', True),
        AcceptEncoding('stupid, identity;q=0', False),
        ]

@pytest.fixture(params=_accept_encodings)
def accept(request):
    return request.param


@pytest.fixture
def url(environment, filecontent, compression_combination):
    e, _, __ = environment
    f, _ = filecontent
    return F'{e}/{compression_combination.dir}/{f}'


def test_response_compression(testdir, client, normal_user, login_headers, environment, filecontent, accept, compression_combination, url):
    headers = { **login_headers }
    if accept.list is not None:
        headers['Accept-Encoding'] = accept.list

    rv = client.get(url, headers=headers, follow_redirects=True)
    ce = rv.headers.get('Content-Encoding', None)

    if not accept.acceptable:
        assert rv.status_code == 406
        return

    if ce == 'identity' or ce is None:
        assert rv.data == filecontent[1]
    elif ce == 'br':
        r1d = brotli.decompress(rv.data)
        assert r1d == filecontent[1]
    elif ce == 'gzip':
        r1d = gzip.decompress(rv.data)
        assert r1d == filecontent[1]
    else:
        assert False, ce

