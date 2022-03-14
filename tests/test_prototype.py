import pytest
import damast

from conftest import get_headers


_static = [
        ("/vis/", "text/html", True),
        ("/vis/style.css", "text/css", True),
        ("/static/public/font-awesome/css/font-awesome.min.css", "text/css", False),
        ("/vis/bundle.js", "application/javascript", True),
        ("/static/public/font-awesome/fonts/fontawesome-webfont.woff2?v=4.7.0", "", False),
        ("/vis/snippet/timeline.html", "text/html", True),
        ("/vis/snippet/religion-hierarchy.html", "text/html", True),
        ("/vis/snippet/tags.html", "text/html", True),
        ("/vis/snippet/map.html", "text/html", True),
        ("/vis/snippet/location-list.html", "text/html", True),
        ("/vis/snippet/source.html", "text/html", True),
        ("/vis/snippet/untimed-data.html", "text/html", True),
        ("/vis/snippet/source.html", "text/html", True),
        ("/static/public/favicon.png", "image/png", False),
        ("/vis/snippet/confidence-hierarchy.html", "text/html", True),
        ]
@pytest.fixture(params=_static)
def static_file(request):
    return request.param


def test_prototype(client_ro, testuser, static_file):
    '''Check if prototype files are available for users'''
    user,password = testuser
    path,content_type,private = static_file
    headers=get_headers(client_ro, user.name, password)

    rv = client_ro.get(path, headers=headers)

    if 'vis' in user.roles or 'admin' in user.roles or not private:
        assert content_type in rv.content_type
        assert rv.status_code == 200

    else:
        assert rv.status_code == 403


def test_prototype_nouser(client_ro, static_file):
    '''Check if prototype files are not available without logging in'''
    path,content_type,login = static_file
    rv = client_ro.get(path)

    if login:
        assert rv.status_code == 401
    else:
        assert content_type in rv.content_type
        assert rv.status_code == 200
