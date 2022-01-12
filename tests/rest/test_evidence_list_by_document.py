import pytest
import re
import psycopg2.extras
import dhimmis
from dhimmis.postgres_rest_api.util import NumericRangeEncoder
import flask
import json
from functools import namedtuple

from conftest import get_headers
from database.testdata import annotation_table, document_table, evidence_table, person_instance_table, place_instance_table, religion_instance_table, time_group_table
_routes = list(map(lambda x: F'/rest/document/{x.id}/evidence-list', document_table))


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'DELETE', 'PATCH'])
@pytest.mark.parametrize('route', _routes)
def test_method_not_allowed(client_ro, minimal_testuser, method, route):
    '''check method not allowed with login'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=route, headers=headers, method=method)

    assert rv.status_code == 405, rv.data


@pytest.mark.parametrize('document', document_table)
def test_get(client_ro, minimal_testuser, document):
    '''test getting an evidence list for a document'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    route = F'/rest/document/{document.id}/evidence-list'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        data = json.loads(rv.data)

        assert rv.status_code == 200
        assert type(data) is list

        # collect evidence
        ann_ids = set(map(lambda x: x.id, filter(lambda y: y.document_id == document.id, annotation_table)))
        matches_annotation = lambda x: x.annotation_id in ann_ids

        evidence_ids = set()
        for p in filter(matches_annotation, place_instance_table):
            eids = map(lambda x: x.id, filter(lambda y: y.place_instance_id == p.id, evidence_table))
            for eid in eids:
                evidence_ids.add(eid)
        for p in filter(matches_annotation, person_instance_table):
            eids = map(lambda x: x.id, filter(lambda y: y.person_instance_id == p.id, evidence_table))
            for eid in eids:
                evidence_ids.add(eid)
        for p in filter(matches_annotation, religion_instance_table):
            eids = map(lambda x: x.id, filter(lambda y: y.religion_instance_id == p.id, evidence_table))
            for eid in eids:
                evidence_ids.add(eid)
        for p in filter(matches_annotation, time_group_table):
            eids = map(lambda x: x.id, filter(lambda y: y.time_group_id == p.id, evidence_table))
            for eid in eids:
                evidence_ids.add(eid)

        evidence = list(filter(lambda x: x.id in evidence_ids, evidence_table))
        assert len(evidence) == len(data), (evidence, data)

        for e in evidence:
            evs = list(filter(lambda x: x['id'] == e.id, data))
            assert len(evs) == 1
            ev = evs[0]
            for k, v in e._asdict().items():
                assert k in ev
                assert ev[k] == v

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('document_id', [0, 70, 4501])
def test_get_notfound(client_ro, minimal_testuser, document_id):
    '''test getting an evidence list for non-existing documents'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    route = F'/rest/document/{document_id}/evidence-list'
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
