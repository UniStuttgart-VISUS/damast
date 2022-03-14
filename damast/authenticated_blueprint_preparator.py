from functools import namedtuple
import flask


Route = namedtuple('Route', ['function', 'rule', 'login', 'login_role_options', 'blueprint_args'])


login_options = ['role', 'optional']

class AuthenticatedBlueprintPreparator():
    def __init__(self, *args, **kwargs):
        self.routes = []
        self.blueprints = []
        self.app_template_filters = []
        self.args = args
        self.kwargs = kwargs
        self.blueprint = None

    def route(self, rule, **options):
        def decorator(f):
            login_role_options = dict()
            for opt in login_options:
                v = options.pop(opt, None)
                if v is not None:
                    # login role: admin always allowed
                    if opt == 'role':
                        if not isinstance(v, (tuple, list)):
                            v = [v]

                        v = list({'admin', *v})

                    login_role_options[opt] = v

            login = bool(login_role_options) or options.pop('login', False)

            self.routes.append(Route(f, rule, login, login_role_options, options))
        return decorator

    def register(self, app, root_app=None, *args, **kwargs):
        blueprint = flask.Blueprint(*self.args, **self.kwargs)

        root_app = app if isinstance(app, flask.Flask) else root_app

        url_prefix=kwargs.get('url_prefix', '')

        for route in self.routes:
            fn = root_app.auth.login_required(**(route.login_role_options))(route.function) \
                    if route.login \
                    else route.function

            blueprint.route(route.rule, **route.blueprint_args)(fn)

        for fn in self.app_template_filters:
            blueprint.add_app_template_filter(fn)

        for bp, bpargs, bpkwargs in self.blueprints:
            bp.register(blueprint, root_app=root_app, *bpargs, **bpkwargs)

        app.register_blueprint(blueprint, *args, **kwargs)
        self.blueprint = blueprint


    def register_blueprint(self, blueprint, *args, **kwargs):
        self.blueprints.append((blueprint, args, kwargs))

    def app_template_filter(self):
        return lambda fn: self.app_template_filters.append(fn)
