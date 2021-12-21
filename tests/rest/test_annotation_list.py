import pytest
import re
import psycopg2.extras
import dhimmis
from dhimmis.postgres_rest_api.util import NumericRangeEncoder
import flask
import json
from functools import namedtuple

from database.testdata import annotation_table, document_table, evidence_table, person_instance_table, place_instance_table, religion_instance_table, time_group_table
_routes = list(map(lambda x: F'/rest/document/{x.id}/annotation-list', document_table))


def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'DELETE', 'PATCH'])
@pytest.mark.parametrize('route', _routes)
def test_method_not_allowed(client_ro, minimal_testuser, method, route):
    '''check method not allowed with login'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=route, headers=headers, method=method)

    assert rv.status_code == 405, rv.data


_bounds_pattern = re.compile(R'([\[(])\s*(\d*)\s*,\s*(\d*)\s*([\])])')
def get_inclusive_int4range_bounds(val_str):
    m = _bounds_pattern.fullmatch(val_str)
    assert m

    bounds = F'{m[1]}{m[4]}'
    lower = None if m[2] == '' else int(m[2])
    upper = None if m[3] == '' else int(m[3])

    span = psycopg2.extras.NumericRange(lower=lower, upper=upper, bounds=bounds)
    a = span.lower if (span.lower_inc or span.lower is None) else span.lower+1
    b = span.upper if (span.upper_inc or span.upper is None) else span.upper-1

    return a,b


@pytest.mark.parametrize('document', document_table)
def test_get(client_ro, minimal_testuser, document):
    '''test getting an annotation list for a document'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    route = F'/rest/document/{document.id}/annotation-list'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        data = json.loads(rv.data)

        assert rv.status_code == 200
        assert type(data) is list

        anns = list(filter(lambda x: x.document_id == document.id, annotation_table))

        assert len(anns) == len(data)

        for a in data:
            assert type(a) is dict

            a2_ = list(filter(lambda x: x.id == a['id'], anns))
            assert len(a2_) == 1
            a2 = a2_[0]

            assert a2.id == a['id']
            assert a2.document_id == a['document_id']
            assert a2.comment == a['comment']
            assert a2.id == a['id']

            start, end = get_inclusive_int4range_bounds(a2.span)
            rv_start, rv_end = tuple(a['span'])

            assert start == rv_start
            assert end == rv_end

            # check for instances, evidence
            matches_annotation = lambda x: x.annotation_id == a['id']

            evidence_ids = []
            place_instances = list(filter(matches_annotation, place_instance_table))
            if len(place_instances) == 1:
                assert place_instances[0].id == a['place_instance_id']
                eids = list(map(lambda x: x.id, filter(lambda y: y.place_instance_id == place_instances[0].id, evidence_table)))
                for eid in eids:
                    evidence_ids.append(eid)

            else:
                assert a['place_instance_id'] is None

            person_instances = list(filter(matches_annotation, person_instance_table))
            if len(person_instances) == 1:
                assert person_instances[0].id == a['person_instance_id']
                eids = list(map(lambda x: x.id, filter(lambda y: y.person_instance_id == person_instances[0].id, evidence_table)))
                for eid in eids:
                    evidence_ids.append(eid)

            else:
                assert a['person_instance_id'] is None

            religion_instances = list(filter(matches_annotation, religion_instance_table))
            if len(religion_instances) == 1:
                assert religion_instances[0].id == a['religion_instance_id']
                eids = list(map(lambda x: x.id, filter(lambda y: y.religion_instance_id == religion_instances[0].id, evidence_table)))
                for eid in eids:
                    evidence_ids.append(eid)

            else:
                assert a['religion_instance_id'] is None

            time_groups = list(filter(matches_annotation, time_group_table))
            if len(time_groups) == 1:
                assert time_groups[0].id == a['time_group_id']
                eids = list(map(lambda x: x.id, filter(lambda y: y.time_group_id == time_groups[0].id, evidence_table)))
                for eid in eids:
                    evidence_ids.append(eid)

            else:
                assert a['time_group_id'] is None

            if len(evidence_ids) == 0:
                assert a['evidence_ids'] is None
            else:
                assert all(map(lambda x: x in evidence_ids, a['evidence_ids']))
                assert all(map(lambda x: x in a['evidence_ids'], evidence_ids))


    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('document_id', [0, 70, 4501])
def test_get_notfound(client_ro, minimal_testuser, document_id):
    '''test getting an annotation list for non-existing documents'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    route = F'/rest/document/{document_id}/annotation-list'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 404

    else:
        assert rv.status_code == 403


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('route', _routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    '''test without login'''
    rv = client_ro.open(path=route, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
