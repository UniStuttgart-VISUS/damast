#!/usr/bin/env python3

import flask
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import os

def create_app(name, path_env_name, role_spec='user', root_file_name='index.html'):
    '''
    Create a blueprint preparator with the blueprint name `name` that serves a
    specific directory.

    @param name             Blueprint name
    @param path_env_name    Environment variable containing root path to be
                            served
    @param role_spec        A role string, or list of strings. Default: 'user'
    @param root_file_name   Filename to be substituted for the root URL (/).
                            Default: 'index.html'
    '''
    app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)

    @app.route('/', role=role_spec)
    def root():
        return get_file(root_file_name)


    @app.route('/<path:path>', role=role_spec)
    def file(path):
        return get_file(path)


    def get_file(path):
        static_path = os.environ.get(path_env_name, '/dev/null')
        return flask.current_app.serve_static_file(static_path, path)


    return app
