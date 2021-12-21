#!/usr/bin/env python3

from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'rest-api'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None, static_folder=None)

# Add children
from .place import app as place
app.register_blueprint(place)

from .religion import app as religion
app.register_blueprint(religion)

from .time import app as time
app.register_blueprint(time)

from .source import app as source
app.register_blueprint(source)

from .evidence import app as evidence
app.register_blueprint(evidence)

from .language import app as language
app.register_blueprint(language)

from .confidence import app as confidence
app.register_blueprint(confidence)

from .dump import app as dump
app.register_blueprint(dump, url_prefix='/dump')

from .document import app as document
app.register_blueprint(document)

from .annotation import app as annotation
app.register_blueprint(annotation)

from .annotation_suggestion import app as annotation_suggestion
app.register_blueprint(annotation_suggestion)

from .place_instance import app as place_instance
app.register_blueprint(place_instance)

from .religion_instance import app as religion_instance
app.register_blueprint(religion_instance)

from .person import app as person
app.register_blueprint(person)

from .person_instance import app as person_instance
app.register_blueprint(person_instance)

from .person_list import app as person_list
app.register_blueprint(person_list)

from .tags import app as tags
app.register_blueprint(tags)

from .person_type_list import app as person_type_list
app.register_blueprint(person_type_list)

from .place_set import app as place_set
app.register_blueprint(place_set)

# URI stuff
uri_url_prefix = '/uri'
from .uri import app as uri_app
app.register_blueprint(uri_app, url_prefix='/uri')

