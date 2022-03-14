import pytest
import re
import damast
import flask
import psycopg2.extras
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import evidence_table, place_instance_table, place_table, place_type_table, time_instance_table, religion_instance_table, person_instance_table, time_group_table, time_instance_table


_bounds_pattern = re.compile(R'([\[(])\s*(\d*)\s*,\s*(\d*)\s*([\])])')
def get_inclusive_int4range_bounds(val_str):
    if val_str == 'empty':
        return None, None
    m = _bounds_pattern.fullmatch(val_str)
    assert m

    bounds = F'{m[1]}{m[4]}'
    lower = None if m[2] == '' else int(m[2])
    upper = None if m[3] == '' else int(m[3])

    span = psycopg2.extras.NumericRange(lower=lower, upper=upper, bounds=bounds)
    a = span.lower if (span.lower_inc or span.lower is None) else span.lower+1
    b = span.upper if (span.upper_inc or span.upper is None) else span.upper-1

    return a,b


Target = namedtuple('Target', ['id', 'exists', 'data', 'time_instances'])
_targets = []
for p in time_group_table:
    time_instances = list(filter(lambda x: x.time_group_id == p.id, time_instance_table))
    _targets.append(Target(p.id, True, p, time_instances))
for n in [0, 216, 404, 21536]:
    _targets.append(Target(n, False, None, []))

@pytest.fixture(params=_targets)
def target(request):
    return request.param


@pytest.fixture
def url(target):
    return F'/rest/time-group/{target.id}'


def test_get(client_ro, minimal_testuser, ro_headers, target, url):
    '''test GET /rest/time-group/<id>'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if target.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is dict
            assert data['annotation_id'] == target.data.annotation_id

            assert 'time_spans' in data
            assert len(data['time_spans']) == len(target.time_instances)
            for ts in data['time_spans']:
                tsx = next(filter(lambda x: x.id == ts['id'], target.time_instances))
                assert ts['confidence'] == tsx.confidence
                assert ts['comment'] == tsx.comment

                lower, upper = get_inclusive_int4range_bounds(tsx.span)
                assert ts['start'] == lower
                assert ts['end'] == upper

        else:
            assert rv.status_code == 404, rv.data

    else:
        assert rv.status_code == 403, rv.data


PutData = namedtuple('PutData', ['data', 'valid', 'success', 'return_code'])
_put_data = [
        PutData(dict(annotation_id=40), True, True, 201),
        PutData(dict(), True, True, 201),

        PutData(dict(annotation_id=3790), True, False, 409),  # FK annotation_id invalid

        PutData(dict(annotation_id=16), True, False, 409),  # annotation_id already used
        PutData(dict(illegal_key=12), True, False, 422),  # illegal field

        PutData(b'', False, False, 400),  # invalid payload
        PutData([], True, False, 400),  # invalid payload
        PutData(b'garbage\x07\xc1values', False, False, 400),  # invalid payload
        ]

@pytest.fixture(params=_put_data)
def put_data(request):
    return request.param


@pytest.fixture
def put_url():
    return '/rest/time-group/0'


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

    num_instances = cursor.one('select count(*) from time_group;')

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == put_data.return_code, rv.data

        if put_data.success:
            assert num_instances == len(time_group_table) + 1

            ret = json.loads(rv.data)
            assert 'time_group_id' in ret
            assert ret['time_group_id'] == num_instances

        else:
            assert num_instances == len(time_group_table)

    else:
        assert rv.status_code == 403, rv.data
        assert num_instances == len(time_group_table)


PatchTarget = namedtuple('PatchTarget', ['id', 'data', 'valid', 'success', 'return_code'])
_patch_targets = [
        PatchTarget(1, dict(), True, True, 204),
        PatchTarget(5, dict(annotation_id=36), True, True, 204),
        PatchTarget(9, dict(annotation_id=None), True, True, 204),
        PatchTarget(17, dict(annotation_id=None), True, True, 204),

        PatchTarget(5, dict(person_id=None), True, False, 422),
        PatchTarget(5, dict(annotation_id=40, test=False), True, False, 422),
        PatchTarget(7, dict(annotation_id=12), True, False, 409),
        PatchTarget(17, dict(annotation_id=123456), True, False, 409),

        PatchTarget(8, b'\xDE\xAD\xBE\xEF', False, False, 400),

        PatchTarget(262, dict(annotation_id=38), True, False, 404),
        ]

@pytest.fixture(params=_patch_targets)
def patch_target(request):
    return request.param


@pytest.fixture
def patch_url(patch_target):
    return F'/rest/time-group/{patch_target.id}'


def test_patch(client, minimal_testuser, cursor, headers, patch_target, patch_url):
    '''test PATCH /rest/time-group/<id>'''
    user, _ = minimal_testuser

    hdrs = { **headers }
    if patch_target.valid:
        data = json.dumps(patch_target.data)
        hdrs['Content-Type'] = 'application/json'
    else:
        data = patch_target.data

    query = 'select * from time_group order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.patch(patch_url, headers=hdrs, data=data)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == patch_target.return_code, rv.data

        if patch_target.success:
            assert rv.data == b''

            d = cursor.one('select * from time_group where id = %s;', (patch_target.id,))._asdict()
            assert all(map(lambda k: d[k[0]] == k[1], patch_target.data.items()))

        else:
            assert old == new

    else:
        assert rv.status_code == 403, rv.data
        assert old == new


def test_delete(client, minimal_testuser, cursor, headers, target, url):
    '''test DELETE time group'''
    user, _ = minimal_testuser

    query = 'select * from time_group order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.delete(url, headers=headers)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if target.exists:
            evcount = cursor.one('select count(*) from evidence where time_group_id = %s;', (target.id,))
            if evcount > 0:
                assert rv.status_code == 409, rv.data
                assert old == new

            else:
                assert rv.status_code == 200, rv.data
                assert old != new
                assert 0 == cursor.one('select count(*) from time_group where id = %s;', (target.id,))
                assert len(time_group_table) - 1 == cursor.one('select count(*) from time_group;')

                d = json.loads(rv.data)
                assert 'deleted' in d
                d = d['deleted']
                assert d['time_group'] == target.id, rv.data

                if target.data.annotation_id is not None:
                    assert d['annotation'] == target.data.annotation_id, rv.data
                    assert 0 == cursor.one('select count(*) from annotation where id = %s;', (target.data.annotation_id,))

                for ti in target.time_instances:
                    assert ti.id in d['time_instance'], rv.data
                    assert 0 == cursor.one('select count(*) from time_instance where id = %s;', (ti.id,))


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
