import pytest
import dhimmis
import flask
import json
from database.testdata import place_table

def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}


_places = [ (p.id, True) for p in place_table ]
_places += [ (i, False) for i in (0, 224, 6214, 36) ]

@pytest.fixture(params=_places)
def place(request):
    return request.param

@pytest.mark.parametrize('ids', [False, True])
def test_get_place_evidence(client_ro, minimal_testuser, place, ids):
    '''test getting a list of evidence for a place'''
    user,password = minimal_testuser
    place_id, exists = place

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        rt = F'/rest/place/{place_id}/evidence'
        if ids:
            rt += '-ids'

        rv = client_ro.get(rt, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            if exists:
                evidence_data = json.loads(rv.data)

                assert rv.status_code == 200
                count = c.one('''
                    SELECT count(*)
                    FROM evidence E
                    JOIN place_instance PI
                        ON E.place_instance_id = PI.id
                    JOIN place P
                        ON PI.place_id = P.id
                    WHERE P.id = %s
                    ;''', (place_id,))

                if ids:
                    assert type(evidence_data) == list
                    assert len(evidence_data) == count
                else:
                    assert type(evidence_data) == dict
                    assert 'evidence' in evidence_data
                    assert len(evidence_data['evidence']) == count
            else:
                assert rv.status_code == 404

        else:
            assert rv.status_code == 403


_nouser_routes = [
        '/rest/place/{}/evidence',
        '/rest/place/{}/evidence-ids',
        ]
_nouser_methods = [ 'GET' ]
@pytest.mark.parametrize('route', _nouser_routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method, place):
    place_id, _ = place
    rt = route.format(place_id)
    rv = client_ro.open(path=rt, method=method)
    assert rv.status_code == 401
