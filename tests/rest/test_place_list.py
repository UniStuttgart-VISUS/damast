import pytest
import dhimmis
import flask
import json

from conftest import get_headers


def test_get_all_visible_places(client_ro, minimal_testuser):
    '''test getting a list of places that are visible'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        rv = client_ro.get('/rest/place-list', headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            place_data = json.loads(rv.data)

            assert rv.status_code == 200
            assert len(place_data) == c.one('select count(*) from place join place_type on place.place_type_id = place_type.id where place.visible and place_type.visible;')

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('route', ['places', 'place/all'])
def test_get_all_places(client_ro, minimal_testuser, route):
    '''test getting a list of all places'''
    # TODO /rest/places add url parameter filter
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        rv = client_ro.get(F'/rest/{route}', headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            place_data = json.loads(rv.data)

            assert rv.status_code == 200
            assert len(place_data) == c.one('select count(*) from place;')

        else:
            assert rv.status_code == 403


def test_place_type_list(client_ro, minimal_testuser):
    '''test getting a list of all place types'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        rv = client_ro.get('/rest/place-type-list', headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            types = json.loads(rv.data)

            assert rv.status_code == 200
            assert len(types) == c.one('select count(*) from place_type;')

        else:
            assert rv.status_code == 403


_nouser_routes = [
        '/rest/places',
        '/rest/place/all',
        '/rest/place-list',
        '/rest/place-type-list',
        ]
_nouser_methods = [ 'GET' ]
@pytest.mark.parametrize('route', _nouser_routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    rv = client_ro.open(path=route, method=method)
    assert rv.status_code == 401
