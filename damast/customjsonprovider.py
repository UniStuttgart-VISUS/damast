import json
from flask.json.provider import JSONProvider

from .postgres_rest_api.util import NumericRangeEncoder


class CustomJSONProvider(JSONProvider):
    """
    Enhances the stock Flask JSONProvider with the facilities to encode psycopg2
    NumericRange objects.
    """
    def dumps(self, obj, **kwargs):
        return json.dumps(obj, **kwargs, cls=NumericRangeEncoder)

    def loads(self, s, **kwargs):
        return json.loads(s, **kwargs)