#!/usr/bin/env python3

import jwt
import flask
from flask_httpauth import HTTPTokenAuth
from werkzeug.datastructures import Authorization

class HTTPCookieTokenAuth(HTTPTokenAuth):
    def __init__(self, *args, **kwargs):
        super(HTTPTokenAuth, self).__init__(*args, **kwargs)

    def get_auth(self):
        if 'jwt_token' in flask.session:
            return Authorization(self.scheme, {'token': flask.session['jwt_token']})
        else:
            return None

    def set_token(self, token):
        flask.session['jwt_token'] = token

    def clear_token(self):
        flask.session.pop('jwt_token', None)
