import pytest
import re
import dhimmis
import flask
import psycopg2.extras
import json
from functools import namedtuple
from urllib.parse import quote
from dhimmis.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import time_group_table, time_instance_table


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


_extra_tgids = (1, 12, 404)
Target = namedtuple('Target', ['id', 'time_group_id', 'exists', 'data'])
_targets = []
for p in time_instance_table:
    _targets.append(Target(p.id, p.time_group_id, True, p))
    for etgid in _extra_tgids:
        _targets.append(Target(p.id, etgid, etgid == p.time_group_id, p))
for n in [0, 216, 404, 21536]:
    for etgid in _extra_tgids:
        _targets.append(Target(n, etgid, False, None))

@pytest.fixture(params=_targets)
def target(request):
    return request.param


@pytest.fixture
def url(target):
    return F'/rest/time-group/{target.time_group_id}/time-instance/{target.id}'


def test_get(client_ro, minimal_testuser, ro_headers, target, url):
    '''test GET time instance'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if target.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is dict
            assert data['confidence'] == target.data.confidence
            assert data['comment'] == target.data.comment

            lower, upper = get_inclusive_int4range_bounds(target.data.span)
            assert data['start'] == lower
            assert data['end'] == upper

        else:
            assert rv.status_code == 404, rv.data

    else:
        assert rv.status_code == 403, rv.data


PutData = namedtuple('PutData', ['time_group_id', 'data', 'valid', 'success', 'return_code'])
_put_data = [
        PutData(1, dict(), True, True, 201),
        PutData(2, dict(start=122, end=441), True, True, 201),
        PutData(3, dict(start=500, end=800, comment='test', confidence='uncertain'), True, True, 201),
        PutData(4, dict(start=200, end=None, confidence='probable'), True, True, 201),
        PutData(5, dict(comment='test', confidence='uncertain'), True, True, 201),
        PutData(6, dict(start=500, end=800, comment='test', confidence='uncertain'), True, True, 201),

        PutData(165, dict(start=500, end=800, comment='test', confidence='uncertain'), True, False, 404),
        PutData(0, dict(comment='Uncomment', confidence='uncertain'), True, False, 404),

        PutData(7, dict(comment='Uncomment', confidence='triad'), True, False, 422),  # invalid confidence
        PutData(19, dict(comment='qw', start=6), True, False, 422),  # imbalanced time span
        PutData(19, dict(comment='qw', end=1245), True, False, 422),  # imbalanced time span
        PutData(8, dict(end=1245, start=4672), True, False, 422),  # start after end

        PutData(17, b'', False, False, 400),  # invalid payload
        PutData(12, b'\xDE\xAD payload', False, False, 400),  # invalid payload
        ]

@pytest.fixture(params=_put_data)
def put_data(request):
    return request.param


@pytest.fixture
def put_url(put_data):
    return F'/rest/time-group/{put_data.time_group_id}/time-instance/0'


def test_put(client, minimal_testuser, cursor, headers, put_data, put_url):
    '''test PUT time instance'''
    user, _ = minimal_testuser

    hdrs = { **headers }
    if put_data.valid:
        data = json.dumps(put_data.data)
        hdrs['Content-Type'] = 'application/json'
    else:
        data = put_data.data

    rv = client.put(put_url, headers=hdrs, data=data)

    num_instances = cursor.one('select count(*) from time_instance;')

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == put_data.return_code, rv.data

        if put_data.success:
            assert num_instances == len(time_instance_table) + 1

            ret = json.loads(rv.data)
            assert 'time_instance_id' in ret
            assert ret['time_instance_id'] == num_instances

        else:
            assert num_instances == len(time_instance_table)

    else:
        assert rv.status_code == 403, rv.data
        assert num_instances == len(time_instance_table)


PatchData = namedtuple('PatchData', ['data', 'valid', 'success', 'return_code'])
_patch_data = [
        PatchData(dict(start=122, end=441), True, True, 205),
        PatchData(dict(start=500, end=800, comment='test', confidence='uncertain'), True, True, 205),
        PatchData(dict(start=200, end=None, confidence='probable'), True, True, 205),
        PatchData(dict(comment='test', confidence='uncertain'), True, True, 205),
        PatchData(dict(start=500, end=800, comment='test', confidence='uncertain'), True, True, 205),

        PatchData(dict(comment='Uncomment', confidence='triad'), True, False, 422),  # invalid confidence
        PatchData(dict(comment='qw', start=6), True, False, 422),  # imbalanced time span
        PatchData(dict(comment='qw', end=1245), True, False, 422),  # imbalanced time span
        PatchData(dict(end=1245, start=4672), True, False, 422),  # start after end

        PatchData(dict(), True, False, 400),
        PatchData( b'', False, False, 400),  # invalid payload
        PatchData( b'\xDE\xAD payload', False, False, 400),  # invalid payload
        ]

PatchTargetCombination = namedtuple('PatchTargetCombination', ['id', 'time_group_id', 'exists'])
_patch_target = [
        PatchTargetCombination(1, 1, True),
        PatchTargetCombination(5, 2, True),
        PatchTargetCombination(6, 2, True),
        PatchTargetCombination(13, 4, True),
        PatchTargetCombination(18, 6, True),
        PatchTargetCombination(47, 21, True),
        PatchTargetCombination(516, 21, False),
        PatchTargetCombination(15, 236, False),
        PatchTargetCombination(23, 12, False),
        PatchTargetCombination(7, 15, False),
        ]

@pytest.fixture(params=_patch_target)
def patch_target_combination(request):
    return request.param


PatchTarget = namedtuple('PatchTarget', ['id', 'time_group_id', 'exists', 'data', 'valid', 'success', 'return_code'])

@pytest.fixture(params=_patch_data)
def patch_target(request, patch_target_combination):
    return PatchTarget(*patch_target_combination, *request.param)


@pytest.fixture
def patch_url(patch_target_combination):
    return F'/rest/time-group/{patch_target_combination.time_group_id}/time-instance/{patch_target_combination.id}'


def test_patch(client, minimal_testuser, cursor, headers, patch_target, patch_url):
    '''test PATCH time instance'''
    user, _ = minimal_testuser

    hdrs = { **headers }
    if patch_target.valid:
        data = json.dumps(patch_target.data)
        hdrs['Content-Type'] = 'application/json'
    else:
        data = patch_target.data

    query = 'select * from time_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True, cls=NumericRangeEncoder)

    rv = client.patch(patch_url, headers=hdrs, data=data)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True, cls=NumericRangeEncoder)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if patch_target.exists:
            assert rv.status_code == patch_target.return_code, rv.data

            if patch_target.success:
                assert rv.data == b''

                d = cursor.one('select * from time_instance where id = %s;', (patch_target.id,))

                if 'comment' in patch_target.data:
                    assert patch_target.data['comment'] == d.comment

                if 'confidence' in patch_target.data:
                    assert patch_target.data['confidence'] == d.confidence

                if 'start' in patch_target.data or 'end' in patch_target.data:
                    span = psycopg2.extras.NumericRange(lower=patch_target.data['start'],
                            upper=patch_target.data['end'],
                            bounds='[]')

                    n = NumericRangeEncoder()
                    lower1, upper1 = tuple(json.loads(n.encode(span)))
                    lower2, upper2 = tuple(json.loads(n.encode(d.span)))

                    assert lower1 == lower2
                    assert upper1 == upper2

            else:
                assert old == new

        else:
            assert rv.status_code == 404, rv.data
            assert old == new

    else:
        assert rv.status_code == 403, rv.data
        assert old == new


def test_delete(client, minimal_testuser, cursor, headers, target, url):
    '''test DELETE time instance'''
    user, _ = minimal_testuser

    query = 'select * from time_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True, cls=NumericRangeEncoder)

    rv = client.delete(url, headers=headers)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True, cls=NumericRangeEncoder)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if target.exists:
            assert rv.status_code == 200, rv.data
            assert old != new
            assert 0 == cursor.one('select count(*) from time_instance where id = %s;', (target.id,))
            assert len(time_instance_table) - 1 == cursor.one('select count(*) from time_instance;')

            d = json.loads(rv.data)
            assert d['deleted']['time_instance'] == target.id

        else:
            assert rv.status_code == 404, rv.data
            assert old == new

    else:
        assert rv.status_code == 403, rv.data
        assert old == new


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, patch_url, method):
    '''test without login'''
    rv = client_ro.open(path=patch_url, method=method)
    if method not in ('GET', 'HEAD', 'DELETE', 'PUT', 'PATCH'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401


_disallowed_methods = [ 'POST', 'TRACE', 'CONNECT' ]
@pytest.mark.parametrize('method', _disallowed_methods)
def test_method_not_allowed(client_ro, patch_url, method, ro_headers):
    '''test method not allowed'''
    rv = client_ro.open(path=patch_url, method=method, headers=ro_headers)
    assert rv.status_code == 405
