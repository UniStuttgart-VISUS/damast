import pytest
import re
import dhimmis
import flask
import json
from functools import namedtuple

from database.testdata import person_table, person_instance_table


Get = namedtuple('Get', ['id', 'exists', 'data'])
_gets = []
for p in person_table:
    _gets.append(Get(p.id, True, p))
for i in [11, 0, 22661]:
    _gets.append(Get(i, False, None))

@pytest.fixture(params=_gets)
def get(request):
    return request.param

@pytest.fixture
def get_route(get):
    return F'/rest/person/{get.id}'

@pytest.mark.parametrize('get', _gets)
def test_get_person(client_ro, ro_headers, minimal_testuser, get, get_route):
    '''test getting person'''
    user, _ = minimal_testuser

    rv = client_ro.get(get_route, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if get.exists:
            assert rv.status_code == 200
            assert json.dumps(get.data._asdict(), sort_keys=True) == json.dumps(json.loads(rv.data), sort_keys=True)

        else:
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403


Put = namedtuple('Put', ['data', 'valid', 'success', 'status_code'])
_puts = [
    Put(dict(name='Foo bar baz', person_type=1), True, True, 201),
    Put(dict(name='Convoluted long name', comment='Fooooo', time_range='1200-1305', person_type=1), True, True, 201),
    Put(dict(name='Person 11', time_range='1213', person_type=1), True, True, 201),

    Put(dict(name='Person 10', time_range='17th century', person_type=1), True, True, 201),  # (name, time_range) is unique
    Put(dict(name='Person 3', time_range='5th century', person_type=1), True, False, 409),  # (name, time_range) is not unique
    Put(dict(name='Person 1', person_type=1), True, False, 409),  # (name, time_range) is not unique
    Put(dict(name='Foooo bar baz', person_type=1, time_range=None), True, False, 409),  # time_range cannot be null
    Put(dict(name='Foooo bar baz', person_type=2), True, False, 409),  # person_type does not exist
    Put(dict(name='Foooo bar baz'), True, False, 409),  # person_type must be given

    Put(dict(person_type=1), True, False, 400),  # name must be given
    Put(dict(), True, False, 400),  # name and person_type must be given
    Put('', False, False, 400),  # must be JSON
    Put(b'\xff12err\xe0or', False, False, 400),  # must be JSON
        ]

@pytest.fixture(params=_puts)
def put(request):
    return request.param

def test_put_person(client, cursor, headers, minimal_testuser, put):
    '''test putting person'''
    user, _ = minimal_testuser

    data = json.dumps(put.data) if put.valid else put.data
    hdrs = dict(**headers)
    if put.valid:
        hdrs['Content-Type'] = 'application/json'

    old_count = cursor.one('SELECT COUNT(*) FROM person;')
    rv = client.put('/rest/person/0', headers=hdrs, data=data)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == put.status_code, rv.data

        new_count = cursor.one('SELECT COUNT(*) FROM person;')
        if put.success:
            assert new_count == old_count + 1

            j = json.loads(rv.data)
            new_id = j['person_id']
            new_data = cursor.one('SELECT * FROM person WHERE id = %s;', (new_id,))._asdict()
            assert all(map(lambda k: new_data[k] == put.data[k], put.data.keys())), new_data

        else:
            assert new_count == old_count, rv.data

    else:
        assert rv.status_code == 403, rv.data


Delete = namedtuple('Delete', ['id', 'exists', 'success'])
_deletes = []
for person in person_table:
    _deletes.append(Delete(person.id, True, len(list(filter(lambda x: x.person_id == person.id, person_instance_table))) == 0))  # only deletable if no instances

_deletes.append(Delete(0, False, False))
_deletes.append(Delete(2345, False, False))

@pytest.fixture(params=_deletes)
def delete(request):
    return request.param

def test_delete_person(client, cursor, headers, minimal_testuser, delete):
    '''test delete person'''
    user, _ = minimal_testuser

    old_count = cursor.one('SELECT COUNT(*) FROM person;')
    rv = client.delete(F'/rest/person/{delete.id}', headers=headers)
    new_count = cursor.one('SELECT COUNT(*) FROM person;')

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if delete.exists:
            if delete.success:
                assert rv.status_code == 205, rv.data
                assert new_count == old_count - 1
                assert 0 == cursor.one('SELECT COUNT(*) FROM person WHERE id = %s;', (delete.id,))

            else:
                assert rv.status_code == 409, rv.data
                assert new_count == old_count
        else:
            assert rv.status_code == 404, rv.data
            assert new_count == old_count

    else:
        assert rv.status_code == 403, rv.data
        assert new_count == old_count


Patch = namedtuple('Patch', ['id', 'exists', 'data', 'valid', 'success', 'status_code'])
_patches = [
        Patch(1, True, dict(comment='foo bar'), True, True, 205),
        Patch(3, True, dict(name='Person name'), True, True, 205),
        Patch(5, True, dict(time_range='last decade of fifth century', name='Baz'), True, True, 205),

        Patch(2, True, dict(person_type=4), True, False, 409),  # invalid person_type
        Patch(8, True, dict(name='Person 1'), True, False, 409),  # no longer unique
        Patch(6, True, dict(time_range=None), True, False, 409),  # cannot be null
        Patch(6, True, dict(invalid_key=16232), True, False, 400),
        Patch(10, True, dict(person_type='invalid type'), True, False, 422),
        Patch(153, False, dict(name='new'), True, False, 404),
        Patch(1, True, dict(), True, False, 415),
        Patch(1, True, '', False, False, 415),
        Patch(1, True, b'0xdead\xbe\xef', False, False, 415),
        ]

@pytest.fixture(params=_patches)
def patch(request):
    return request.param


def test_patch_person(client, cursor, headers, minimal_testuser, patch):
    '''test patching person'''
    user, _ = minimal_testuser

    data = json.dumps(patch.data) if patch.valid else patch.data
    hdrs = dict(**headers)
    if patch.valid:
        hdrs['Content-Type'] = 'application/json'

    if patch.exists:
        old_data = cursor.one('SELECT * FROM person WHERE id = %s;', (patch.id,))._asdict()

    rv = client.patch(F'/rest/person/{patch.id}', headers=hdrs, data=data)

    if patch.exists:
        new_data = cursor.one('SELECT * FROM person WHERE id = %s;', (patch.id,))._asdict()

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == patch.status_code, rv.data

        if patch.exists:
            if patch.success:
                d = dict(**old_data)
                d.update(**new_data)
                assert json.dumps(d, sort_keys=True) == json.dumps(new_data, sort_keys=True), new_data

            else:
                assert json.dumps(old_data, sort_keys=True) == json.dumps(new_data, sort_keys=True)

    else:
        assert rv.status_code == 403, rv.data




_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, get_route, method):
    '''test without login'''
    rv = client_ro.open(path=get_route, method=method)
    if method not in ('GET', 'HEAD', 'PATCH', 'PUT', 'DELETE'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
