import logging

def register_blueprint(app, blueprint, prefix):
    app.register_blueprint(blueprint, url_prefix=prefix)
    logging.getLogger('flask.error').info(F'Routing {prefix} to blueprint {blueprint.name}')
