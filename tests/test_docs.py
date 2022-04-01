import pytest
import damast
import gzip
from functools import namedtuple


Endpoint = namedtuple('Endpoint', ['path', 'roles', 'content_type'])

_endpoints = [
    Endpoint('/', ('user', 'dev'), 'text/html'),
    Endpoint('/index/static/index.css', ('user', 'dev'), 'text/css'),
    Endpoint('/api', ('dev',), 'text/html'),
    Endpoint('/api/static/api.css', ('dev',), 'text/css'),
    Endpoint('/schema', ('admin', 'dev', 'pgadmin',), 'application/pdf'),
    Endpoint('/log', ('admin',), 'text/html'),
    Endpoint('/user-log/static/userlog.css', ('admin',), 'text/css'),
        ]

@pytest.fixture(params=_endpoints)
def endpoint(request):
    return Endpoint('/docs' + request.param.path, request.param.roles, request.param.content_type)

def test_page(ro_headers_full, client_ro, testuser, endpoint):
    user, _ = testuser

    rv = client_ro.get(endpoint.path, headers=ro_headers_full)
    if any(map(lambda x: x in user.roles, endpoint.roles)):
        assert rv.status_code == 200
        assert endpoint.content_type in rv.content_type
    else:
        assert rv.status_code == 403


def test_nologin(client_ro, endpoint):
    rv = client_ro.get(endpoint.path)
    assert rv.status_code == 401


_illegal_endpoints = [
    Endpoint('/docs/user-log/static/../api/api.css', ('admin',), ''),
    Endpoint('/docs/user-log/static/../../assets/database_schema.pdf.br', ('admin',), ''),
    Endpoint('/docs/api/static/../../__init__.py', ('dev',), ''),
    Endpoint('/docs/index/static/../../__init__.py', ('user',), ''),
    Endpoint('/docs/index/static/../api/api.css', ('user',), ''),
        ]
@pytest.fixture(params=_illegal_endpoints)
def illegal_endpoint(request):
    return request.param

def test_no_static_dir_escaping(ro_headers_full, client_ro, testuser, illegal_endpoint):
    user, _ = testuser

    rv = client_ro.get(illegal_endpoint.path, headers=ro_headers_full)

    if any(map(lambda x: x in user.roles, illegal_endpoint.roles)):
        assert rv.status_code == 404, rv.data
    else:
        assert rv.status_code in (403, 404)


def test_db_dump(client_ro, ro_headers_full, testuser):
    '''Check that /rest/dump/ is available and does not contain sensible information'''
    user, _ = testuser
    rv = client_ro.get('/rest/dump/', headers=ro_headers_full)

    if 'user' not in user.roles:
        assert rv.status_code == 403
        return

    assert 'application/gzip' in rv.content_type
    assert rv.status_code == 200

    bytes_ = gzip.decompress(rv.data)

    if 'admin' in user.roles:
        # check that DROP and CREATE are in sql
        assert b'DROP DATABASE' in bytes_
        assert b'CREATE DATABASE' in bytes_

        # check that privileges are in sql
        assert b'ALTER DATABASE' in bytes_
        assert b'ALTER TABLE ONLY' in bytes_
        assert b'ALTER SEQUENCE' in bytes_
        assert b'GRANT CONNECT' in bytes_
        assert b'GRANT' in bytes_

        # check that users, user actions and action types are in sql
        assert b'COPY public.action_type' in bytes_
        assert b'COPY public.users' in bytes_
        assert b'COPY public.user_action' in bytes_

    else:
        # check that DROP and CREATE are not in sql
        assert b'DROP DATABASE' not in bytes_
        assert b'CREATE DATABASE' not in bytes_

        # check that privileges are not in sql
        assert b'ALTER TABLE ONLY' not in bytes_
        assert b'GRANT USAGE' not in bytes_
        assert b'GRANT SELECT' not in bytes_

        # check that users, user actions and action types are not in sql
        assert b'COPY public.action_type' not in bytes_
        assert b'COPY public.users' not in bytes_
        assert b'COPY public.user_action' not in bytes_
