#!/usr/bin/env python3

import os

# Server
def create_app():
    from .app import FlaskApp
    app = FlaskApp(__name__, template_folder='templates')

    with app.app_context():
        app.config['auth'] = app.auth

        from . import docs, vis, geodb_editor, login, root, generic_directory_serve
        root.app.register(app, url_prefix='/')
        login.app.register(app, url_prefix='/')
        docs.app.register(app, url_prefix='/docs')
        vis.app.register(app, url_prefix='/vis')
        geodb_editor.app.register(app, url_prefix='/GeoDB-Editor')

        # generic dirs
        from . import postgres_rest_api
        postgres_rest_api.app.register(app, url_prefix='/rest')

        from . import annotator
        annotator.app.register(app, url_prefix='/annotator')

        from . import recogito
        recogito.app.register(app, url_prefix='/recogito')

        from . import reporting
        reporting.app.register(app, url_prefix='/reporting')

        from . import uri
        uri.app.register(app, url_prefix='/')

        from . import questionnaire
        questionnaire.app.register(app, url_prefix='/questionnaire')

    return app

