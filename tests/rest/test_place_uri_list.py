import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import uri_namespace_table, external_place_uri_table, place_table


Place = namedtuple('Place', ['id', 'exists'])
_places = []
for p in place_table:
    _places.append(Place(p.id, True))
_places.append(Place(2567, False))
_places.append(Place(0, False))

@pytest.fixture(params=_places)
def place(request):
    return request.param


@pytest.fixture
def url(place):
    return F'/rest/place/{place.id}/external-uri-list'


@pytest.fixture
def uri_list(place):
    if place.exists:
        return list(map(lambda x: x._asdict(), filter(lambda y: y.place_id == place.id, external_place_uri_table)))



def test_get(client_ro, minimal_testuser, ro_headers, place, url, uri_list):
    '''test GET list'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if place.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is list
            assert len(data) == len(uri_list)

            reply_str = json.dumps(data, sort_keys=True)
            data_str = json.dumps(uri_list, sort_keys=True)

            assert data_str == reply_str

        else:
            assert rv.status_code == 404, rv.data

    else:
        assert rv.status_code == 403, rv.data


@pytest.fixture(params=['/rest/place/12/external-uri-list', '/rest/place/124653/external-uri-list'])
def short_url(request):
    return request.param


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, short_url, method):
    '''test without login'''
    rv = client_ro.open(path=short_url, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401


_disallowed_methods = [ 'POST', 'TRACE', 'CONNECT', 'PATCH', 'PUT', 'DELETE' ]
@pytest.mark.parametrize('method', _disallowed_methods)
def test_method_not_allowed(client_ro, short_url, method, ro_headers):
    '''test method not allowed'''
    rv = client_ro.open(path=short_url, method=method, headers=ro_headers)
    assert rv.status_code == 405
