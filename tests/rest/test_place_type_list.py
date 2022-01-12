import pytest
import dhimmis
import flask
import json

@pytest.fixture
def url():
    return '/rest/place-type-list'


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'HEAD', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_method_not_allowed(client_ro, ro_headers, minimal_testuser, url, method):
    user,password = minimal_testuser

    rv = client_ro.open(path=url, method=method)

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


def test_place_type_list(client_ro, ro_headers, minimal_testuser, url):
    '''test getting a list of place types'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        rv = client_ro.get(url)

        if 'user' in user.roles and 'readdb' in user.roles:
            assert rv.status_code == 200, rv.data.decode('utf-8')
            place_type_data = json.loads(rv.data)

            assert len(place_type_data) == c.one('select count(*) from place_type;')

            for t in place_type_data:
                assert 'id' in t
                assert 'type' in t
                assert 'visible' in t

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('method', ['GET', 'POST', 'TRACE', 'HEAD', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_nouser(client_ro, url, method):
    rv = client_ro.open(path=url, method=method)
    if method in ('GET', 'HEAD'):
        assert rv.status_code == 401
    else:
        assert rv.status_code == 405
