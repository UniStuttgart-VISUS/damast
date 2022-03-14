import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import person_table

@pytest.fixture
def url():
    return F'/rest/person-list'


def test_get(client_ro, minimal_testuser, ro_headers, url):
    '''test GET /rest/person-list'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 200, rv.data

        data = json.loads(rv.data)
        assert type(data) is list
        assert len(data) == len(person_table)
        assert all(map(lambda x: any(map(lambda y: x['id'] == y.id, person_table)), data))
        assert all(map(lambda x: any(map(lambda y: x.id == y['id'], data)), person_table))

    else:
        assert rv.status_code == 403, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, url, method):
    '''test without login'''
    rv = client_ro.open(path=url, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401


_disallowed_methods = [ 'POST', 'TRACE', 'CONNECT' ]
@pytest.mark.parametrize('method', _disallowed_methods)
def test_method_not_allowed(client_ro, url, method, ro_headers):
    '''test method not allowed'''
    rv = client_ro.open(path=url, method=method, headers=ro_headers)
    assert rv.status_code == 405
