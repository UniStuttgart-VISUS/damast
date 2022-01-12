import pytest
import dhimmis
import flask
import json

from conftest import get_headers


@pytest.fixture
def url():
    return '/rest/sources-list'


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'HEAD', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_method_not_allowed(client_ro, minimal_testuser, url, method):
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=url, headers=headers, method=method)

    if 'user' in user.roles and 'readdb' in user.roles:
        if method == 'HEAD':
            assert rv.status_code == 200
        else:
            assert rv.status_code == 405, rv.data
    else:
        if method == 'HEAD':
            assert rv.status_code == 403
        else:
            assert rv.status_code == 405


def test_source_list(client_ro, minimal_testuser, url):
    '''test getting a list of sources'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        rv = client_ro.get(url, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            sources_data = json.loads(rv.data)

            assert rv.status_code == 200
            assert len(sources_data) == c.one('select count(*) from source;')

            for source in sources_data:
                assert 'id' in source
                assert 'name' in source
                assert 'short' in source
                assert 'default_confidence' in source

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('method', ['GET', 'POST', 'TRACE', 'HEAD', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_nouser(client_ro, url, method):
    rv = client_ro.open(path=url, method=method)
    if method in ('GET', 'HEAD'):
        assert rv.status_code == 401
    else:
        assert rv.status_code == 405
