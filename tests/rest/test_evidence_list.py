import pytest
import re
import dhimmis
import flask
import json
from functools import namedtuple
from urllib.parse import quote

from database.testdata import evidence_table, place_instance_table, place_table, place_type_table, time_instance_table, religion_instance_table

def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}

@pytest.fixture
def route():
    return '/rest/evidence-list'


@pytest.fixture
def valid_evidence_ids():
    visible_types = list(map(lambda x: x.id, filter(lambda x: x.visible, place_type_table)))
    visible_place_ids = list(map(lambda x: x.id, filter(lambda x: x.visible and x.place_type_id in visible_types, place_table)))
    visible_place_instance_ids = list(map(lambda x: x.id, filter(lambda PI: PI.place_id in visible_place_ids, place_instance_table)))

    ids = []

    def visible_evidence(evidence):
        if not evidence.visible or evidence.place_instance_id is None:
            return False

        return evidence.place_instance_id in visible_place_instance_ids

    visible_evidence = list(filter(visible_evidence, evidence_table))

    for e in visible_evidence:
        if e.time_group_id is None:
            ids.append(e.id)
        else:
            l = list(filter(lambda x: x.time_group_id == e.time_group_id, time_instance_table))
            if len(l) == 0:
                ids.append(e.id)
            else:
                for x in l:
                    ids.append(e.id)

    return ids


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_method_not_allowed(client_ro, minimal_testuser, method, route):
    '''check method not allowed with login'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=route, headers=headers, method=method)

    assert rv.status_code == 405, rv.data


def test_evidence_list(client_ro, minimal_testuser, route, valid_evidence_ids):
    '''test getting the list of evidence'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        data = json.loads(rv.data)
        assert rv.status_code == 200
        assert type(data) is list
        assert len(data) == len(valid_evidence_ids)
        assert json.dumps(sorted(map(lambda x: x['tuple_id'], data))) == json.dumps(sorted(valid_evidence_ids))

    else:
        assert rv.status_code == 403


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    '''test without login'''
    rv = client_ro.open(path=route, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
