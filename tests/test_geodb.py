import pytest
import damast

from conftest import get_headers


_geodb_static = [
    ('/GeoDB-Editor/places', 'text/html', True),
    ('/GeoDB-Editor/persons', 'text/html', True),
    ('/static/public/base.css', 'text/css', False),
    ('/GeoDB-Editor/geodb.css', 'text/css', True),
    ('/GeoDB-Editor/bundle.js', 'application/javascript', True),
    ('/GeoDB-Editor/leaflet.css', 'text/css', True),
    ('/GeoDB-Editor/tabulator.min.css', 'text/css', True),
        ]
for f in [ 'layers-2x', 'layers', 'marker-icon-2x-blue', 'marker-icon-2x-grey', 'marker-icon-2x-red', 'marker-icon-blue', 'marker-icon-grey', 'marker-icon-red', 'marker-shadow']:
    _geodb_static.append((F'/GeoDB-Editor/images/{f}.png', 'image/png', True))
@pytest.fixture(params=_geodb_static)
def geodb_static_file(request):
    return request.param


def test_geodb(client_ro, testuser, geodb_static_file):
    '''Check if geodb files are available for users'''
    user,password = testuser
    path,content_type,private = geodb_static_file
    headers=get_headers(client_ro, user.name, password)

    rv = client_ro.get(path, headers=headers)

    if 'admin' in user.roles or 'geodb' in user.roles or not private:
        assert content_type in rv.content_type
        assert rv.status_code == 200, rv.data

    else:
        assert rv.status_code == 403


def test_geodb_nouser(client_ro, geodb_static_file):
    '''Check if geodb files are not available without logging in'''
    path,content_type,login = geodb_static_file
    rv = client_ro.get(path)

    if login:
        assert rv.status_code == 401
    else:
        assert content_type in rv.content_type
        assert rv.status_code == 200
