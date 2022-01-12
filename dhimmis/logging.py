import flask
import logging

class BlueprintFilter(logging.Filter):
    def filter(self, record):
        try:
            bp = flask.request.blueprint
            user = flask.current_app.auth.current_user()
            username = user.name if user and not user.visitor else '-'
        except RuntimeError:
            bp = '-'
            username = '-'

        record.blueprint = bp
        record.username = username
        return True
