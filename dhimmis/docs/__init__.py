#!/usr/bin/env python3

import flask
import re
import os
import datetime
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'docs'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

from .index import app as index
app.register_blueprint(index)

from .api_description import app as api_description
app.register_blueprint(api_description)

from .user_log import app as user_log
app.register_blueprint(user_log)

from .postgres_structure_pdf import app as postgres_structure_pdf
app.register_blueprint(postgres_structure_pdf)

from .annotator import app as annotator
app.register_blueprint(annotator)

from .changelog import app as changelog
app.register_blueprint(changelog)

from .vis import app as vis
app.register_blueprint(vis)
