import pytest
import dhimmis
import flask
import json
from functools import namedtuple

def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'HEAD', 'CONNECT'])
def test_method_not_allowed(client_ro, minimal_testuser, method):
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path='/rest/place/1', headers=headers, method=method)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 405, rv.data
    else:
        if method == 'HEAD':
            assert rv.status_code == 403
        else:
            assert rv.status_code == 405


testplaces = [
    (json.dumps(dict(name=F'New place name', comment='test', geoloc=dict(lat=12,lng=134), confidence='probable', place_type_id=2)), 201, True),
    (json.dumps(dict(name=F'New place name 2', geoloc=dict(lat=12,lng=134), confidence='probable', place_type_id=2)), 201, True),
    (json.dumps(dict(name=F'New place name 3', comment='test', confidence='probable', place_type_id=2)), 201, True),
    (json.dumps(dict(name=F'New place name 4', comment='test', geoloc=dict(lat=12,lng=134), place_type_id=2)), 201, True),
    (json.dumps(dict(name=F'New place name 5', comment='test', geoloc=dict(lat=12,lng=134), confidence='probable')), 201, True),
    (json.dumps(dict(comment='test', geoloc=dict(lat=12,lng=134), confidence='probable', place_type_id=2)), 400, False),
    ('bad value', 400, False),
    (None, 400, False),
        ]
@pytest.fixture(params=testplaces)
def testplace(request):
    return request.param


def test_put_place(client, minimal_testuser, testplace):
    '''test putting a new place'''
    user,password = minimal_testuser
    payload, statuscode, success = testplace

    with flask.current_app.pg.get_cursor() as c:
        old_place_count = c.one('select count(*) from place;')

        headers = get_headers(client, user.name, password)
        headers['Content-Type'] = 'application/json'
        rv = client.put('/rest/place/0', data=payload, headers=headers)

        new_place_count = c.one('select count(*) from place;')

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == statuscode, flask.current_app.ht.to_string()
            if success:
                assert new_place_count == old_place_count + 1
            else:
                assert new_place_count == old_place_count
        else:
            assert rv.status_code == 403
            assert new_place_count == old_place_count


@pytest.mark.parametrize('place_name,existing', [('New place name', False), ('Place A', True), ('Place N', True)])
def test_put_duplicate_place(client, minimal_testuser, place_name, existing):
    '''test putting a place with an existing name'''
    user,password = minimal_testuser

    headers = get_headers(client, user.name, password)
    headers['Content-Type'] = 'application/json'
    rv = client.put('/rest/place/0', data=json.dumps(dict(name=place_name)), headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if existing:
            assert rv.status_code == 409 # Conflict
        else:
            assert rv.status_code == 201 # Created
    else:
        assert rv.status_code == 403


PatchPlace = namedtuple('PatchPlace', ['id', 'payload', 'content_type', 'status_code', 'success'])
_patch_places = [
    PatchPlace(1, b'', 'text/plain', 415, False),
    PatchPlace(4, b'illegal payload', 'text/plain', 415, False),
    PatchPlace(4, json.dumps(dict()), None, 415, False),
    PatchPlace(7, dict(
        name='new place name that is free'
        ), None, 205, True),
    PatchPlace(12, dict(
        name=''
        ), None, 400, False),
    PatchPlace(3, dict(
        geoloc=dict(lat=12,lng=15)
        ), None, 205, True),
    PatchPlace(24, dict(
        geoloc=dict(lng=-12.54)
        ), None, 400, False),
    PatchPlace(24, dict(
        geoloc=dict(lat=11)
        ), None, 400, False),
    PatchPlace(16, dict(
        confidence='false',
        visible=False
        ), None, 205, True),
    PatchPlace(11, dict(
        place_type_id=2,
        comment='New comment value'
        ), None, 205, True),
    PatchPlace(2, dict(
        place_type_id=16,
        confidence='contested'
        ), None, 409, False),
    PatchPlace(45, dict(
        confidence='true'
        ), None, 404, False),
    PatchPlace(22, dict(
        place_type_id=16,
        confidence='invalid_confidence_value'
        ), None, 422, False),
    PatchPlace(1, dict(
        name='Place D'
        ), None, 409, False),
    ]

@pytest.mark.parametrize('place', _patch_places)
def test_patch_place(client, minimal_testuser, place):
    '''test patching an existing place'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor() as c:
        if place.status_code != 404:
            old_place_data = c.one('select * from place where id=%s;', (place.id,))._asdict()

        headers = get_headers(client, user.name, password)
        headers['Content-Type'] = place.content_type or 'application/json'
        data = json.dumps(place.payload) if place.content_type is None else place.payload
        rv = client.patch(F'/rest/place/{place.id}', data=data, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == place.status_code, rv.data

            if place.status_code != 404:
                new_place_data = c.one('select * from place where id=%s;', (place.id,))._asdict()
                if place.success:
                    for k, v in place.payload.items():
                        if k == 'geoloc':
                            pass

                        else:
                            assert new_place_data[k] == v


                else:
                    assert json.dumps(old_place_data) == json.dumps(new_place_data)

        else:
            assert rv.status_code == 403


_place_inserts = [
    ('Place Name with no references', [], [], True),
    ('Place Name with instances', ['Test comment', 'Test 2'], [], False),
    ('Place Name with variant', [], [('Variant', 1), ('Variant 2', 2)], True),
    ('Place Name with instances and variant', ['Name with both'], [('Variant', 1), ('Variant 2', 2)], False),
        ]
@pytest.mark.parametrize('placedata', _place_inserts)
def test_delete_place(client, minimal_testuser, placedata):
    '''test deleting an existing place'''
    user,password = minimal_testuser
    name, instances, variants, success = placedata

    with flask.current_app.pg.get_cursor(autocommit=True) as c:
        place_id = c.one('insert into place(name, place_type_id) values (%s, 1) returning id;', (name,))
        for instance in instances:
            query = c.mogrify('insert into place_instance (place_id, comment) values (%s, %s);', (place_id, instance))
            c.execute(query)

        var_ids = []
        for var in variants:
            var_id = c.one('insert into name_var (place_id, name, main_form, language_id) values (%s, %s, %s, 1) returning id;', (place_id, var, True))

        headers = get_headers(client, user.name, password)
        rv = client.delete(F'/rest/place/{place_id}', headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            if success:
                assert rv.status_code == 200
                assert 0 == c.one('select count(*) from place where id = %s;', (place_id,))

                for var_id in var_ids:
                    assert 0 == c.one('select count(*) from name_var where id = %s;', (var_id,))

            else:
                assert rv.status_code == 409

        else:
            assert rv.status_code == 403


_get_place_ids = [ (1, True), (4, True), (12, True), (22, True), (41, False), (0, False), (2143, False) ]
@pytest.mark.parametrize('place_id, exists', _get_place_ids)
@pytest.mark.parametrize('details', [False, True])
def test_get_place(client_ro, minimal_testuser, place_id, exists, details):
    '''test getting an existing place'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        route = F'/rest/place/{place_id}'
        if details:
            route += '/details'
        rv = client_ro.get(route, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            if exists:
                place_data = json.loads(rv.data)

                assert rv.status_code == 200
                assert 1 == c.one('select count(*) from place where id = %s;', (place_id,))

                if details:
                    assert 'place_id' in place_data
                    assert place_data['place_id'] == place_id
                else:
                    assert 'id' in place_data
                    assert place_data['id'] == place_id

            else:
                assert rv.status_code == 404
                assert 0 == c.one('select count(*) from place where id = %s;', (place_id,))

        else:
            assert rv.status_code == 403


_nouser_routes = [
        '/rest/place/12',
        '/rest/place/24',
        '/rest/place/0',
        '/rest/place/64'
        ]
_nouser_methods = [ 'GET', 'PUT', 'PATCH', 'DELETE']
@pytest.mark.parametrize('route', _nouser_routes)
@pytest.mark.parametrize('details', [False, True])
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, details, method):
    rt = route + ('/details' if details else '')
    rv = client_ro.open(path=rt, method=method)
    if details and method != 'GET':
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
