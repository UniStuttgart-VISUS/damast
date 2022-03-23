import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import evidence_table, place_instance_table, place_table, place_type_table, time_instance_table, religion_instance_table, person_instance_table


Target = namedtuple('Target', ['id', 'exists', 'data'])
_targets = []
for p in person_instance_table:
    _targets.append(Target(p.id, True, p))
for n in [0, 216, 404, 21536]:
    _targets.append(Target(n, False, None))

@pytest.fixture(params=_targets)
def target(request):
    return request.param


@pytest.fixture
def url(target):
    return F'/rest/person-instance/{target.id}'


def test_get(client_ro, minimal_testuser, ro_headers, target, url):
    '''test GET /rest/person-instance/<id>'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if target.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is dict
            for k, v in target.data._asdict().items():
                assert k in data
                assert data[k] == v

        else:
            assert rv.status_code == 404, rv.data

    else:
        assert rv.status_code == 403, rv.data


PutData = namedtuple('PutData', ['data', 'valid', 'success', 'return_code'])
_put_data = [
        PutData(dict(person_id=3), True, True, 201),
        PutData(dict(person_id=4, confidence='contested'), True, True, 201),
        PutData(dict(person_id=2, comment='Test comment'), True, True, 201),
        PutData(dict(person_id=2, comment='argh', confidence='certain', annotation_id=40), True, True, 201),

        PutData(dict(comment='test'), True, False, 422),  # no person_id
        PutData(dict(illegal_key=12, person_id=4), True, False, 422),  # illegal field
        PutData(dict(), True, False, 422),  # empty
        PutData(dict(person_id=1, confidence='maybe'), True, False, 422),  # confidence value invalid

        PutData(dict(person_id=91223, comment=None, annotation_id=37), True, False, 409),  # FK person_id invalid
        PutData(dict(person_id=8, comment=None, annotation_id=3790), True, False, 409),  # FK annotation_id invalid
        PutData(dict(person_id=10, annotation_id=16), True, False, 409),  # annotation_id already used

        PutData(b'', False, False, 400),  # invalid payload
        PutData(b'garbage\x07\xc1values', False, False, 400),  # invalid payload
        ]

@pytest.fixture(params=_put_data)
def put_data(request):
    return request.param


@pytest.fixture
def put_url():
    return '/rest/person-instance/0'


def test_put(client, minimal_testuser, cursor, headers, put_data, put_url):
    '''test PUT /rest/person-instance/0'''
    user, _ = minimal_testuser

    hdrs = { **headers }
    if put_data.valid:
        data = json.dumps(put_data.data)
        hdrs['Content-Type'] = 'application/json'
    else:
        data = put_data.data

    rv = client.put(put_url, headers=hdrs, data=data)

    num_instances = cursor.one('select count(*) from person_instance;')

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == put_data.return_code, rv.data

        if put_data.success:
            assert num_instances == len(person_instance_table) + 1

            ret = json.loads(rv.data)
            assert 'person_instance_id' in ret
            assert ret['person_instance_id'] == num_instances
            pass

        else:
            assert num_instances == len(person_instance_table)

    else:
        assert rv.status_code == 403, rv.data
        assert num_instances == len(person_instance_table)


PatchTarget = namedtuple('PatchTarget', ['id', 'data', 'valid', 'success', 'return_code'])
_patch_targets = [
        PatchTarget(1, dict(person_id=9), True, True, 205),
        PatchTarget(2, dict(comment='new'), True, True, 205),
        PatchTarget(3, dict(confidence='certain', annotation_id=38), True, True, 205),
        PatchTarget(21, dict(annotation_id=31), True, True, 205),  # annotation 31 already on 21
        PatchTarget(16, dict(person_id=4, comment=None, confidence='false'), True, True, 205),

        PatchTarget(5, dict(person_id=None), True, False, 409),
        PatchTarget(6, dict(person_id=120), True, False, 409),
        PatchTarget(7, dict(annotation_id=12), True, False, 409),
        PatchTarget(4, dict(confidence='testvalue'), True, False, 422),
        PatchTarget(17, dict(annotation_id=1), True, False, 409),

        PatchTarget(8, b'\xDE\xAD\xBE\xEF', False, False, 400),

        PatchTarget(262, dict(confidence='certain', annotation_id=38), True, False, 404),
        ]

@pytest.fixture(params=_patch_targets)
def patch_target(request):
    return request.param


@pytest.fixture
def patch_url(patch_target):
    return F'/rest/person-instance/{patch_target.id}'


def test_patch(client, minimal_testuser, cursor, headers, patch_target, patch_url):
    '''test PATCH /rest/person-instance/<id>'''
    user, _ = minimal_testuser

    hdrs = { **headers }
    if patch_target.valid:
        data = json.dumps(patch_target.data)
        hdrs['Content-Type'] = 'application/json'
    else:
        data = patch_target.data

    query = 'select * from person_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.patch(patch_url, headers=hdrs, data=data)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == patch_target.return_code, rv.data

        if patch_target.success:
            assert rv.data == b''

            d = cursor.one('select * from person_instance where id = %s;', (patch_target.id,))._asdict()
            assert all(map(lambda k: d[k[0]] == k[1], patch_target.data.items()))

        else:
            assert old == new

    else:
        assert rv.status_code == 403, rv.data
        assert old == new


def test_delete(client, minimal_testuser, cursor, headers, target, url):
    '''test DELETE /rest/person-instance/id'''
    user, _ = minimal_testuser

    query = 'select * from person_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.delete(url, headers=headers)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if target.exists:
            evcount = cursor.one('select count(*) from evidence where person_instance_id = %s;', (target.id,))
            if evcount > 0:
                assert rv.status_code == 409, rv.data
                assert old == new

            else:
                assert rv.status_code == 200, rv.data
                assert old != new
                assert 0 == cursor.one('select count(*) from person_instance where id = %s;', (target.id,))
                assert len(person_instance_table) - 1 == cursor.one('select count(*) from person_instance;')

                d = json.loads(rv.data)
                assert d['person_instance_id'] == target.id

                if target.data.annotation_id is not None:
                    assert d['annotation_id'] == target.data.annotation_id
                    assert 0 == cursor.one('select count(*) from annotation where id = %s;', (target.data.annotation_id,))


        else:
            assert rv.status_code == 404, rv.data
            assert old == new

    else:
        assert rv.status_code == 403, rv.data
        assert old == new


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, url, method):
    '''test without login'''
    rv = client_ro.open(path=url, method=method)
    if method not in ('GET', 'HEAD', 'DELETE', 'PUT', 'PATCH'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401


_disallowed_methods = [ 'POST', 'TRACE', 'CONNECT' ]
@pytest.mark.parametrize('method', _disallowed_methods)
def test_method_not_allowed(client_ro, url, method, ro_headers):
    '''test method not allowed'''
    rv = client_ro.open(path=url, method=method, headers=ro_headers)
    assert rv.status_code == 405
