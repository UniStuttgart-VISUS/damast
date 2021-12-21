import pytest
import re
import dhimmis
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from dhimmis.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import tag_table

@pytest.fixture
def url():
    return F'/rest/tag-list'


def test_get(client_ro, minimal_testuser, ro_headers, url):
    '''test GET tag list'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 200, rv.data

        data = json.loads(rv.data)
        assert type(data) is list

        assert len(data) == len(tag_table)
        assert all(map(lambda datum: any(map(lambda tag: json.dumps(tag._asdict(), sort_keys=True) == json.dumps(datum, sort_keys=True), tag_table)), data))

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'DELETE', 'PUT', 'PATCH'])
def test_method_not_allowed(client_ro, minimal_testuser, method, ro_headers, url):
    '''check method not allowed with login'''
    rv = client_ro.open(path=url, headers=ro_headers, method=method)

    assert rv.status_code == 405, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, url, method):
    '''test without login'''
    rv = client_ro.open(path=url, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
