import pytest
import dhimmis

@pytest.fixture(params=['a', 'b', 'c'])
def dummy(request):
    return request.param

def test_database_working(client_ro, dummy):
    assert True
