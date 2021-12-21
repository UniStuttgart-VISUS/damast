from ...authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'uri'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None, static_folder=None)

from .external_database import app as external_database
app.register_blueprint(external_database)

from .uri_namespace import app as uri_namespace
app.register_blueprint(uri_namespace)

from .external_place_uri import app as external_place_uri
app.register_blueprint(external_place_uri)

from .external_person_uri import app as external_person_uri
app.register_blueprint(external_person_uri)

from .person_uri_list import app as person_uri_list
app.register_blueprint(person_uri_list)
