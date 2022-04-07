import datetime
import mimetypes
import flask
import json
import jwt
import logging
import os
import re
import subprocess
import sys
import urllib
import urllib.parse
import yaml
import atexit
import sqlite3
import brotli, gzip
import uuid
import traceback
from contextlib import contextmanager
import werkzeug.exceptions
from .token import HTTPCookieTokenAuth
from .user import User, default_visitor_roles, visitor
from .postgres_rest_api.util import NumericRangeEncoder
from .logging import BlueprintFilter
from functools import lru_cache, partial
from logging.handlers import TimedRotatingFileHandler
from passlib.pwd import genword
from postgres import Postgres
from werkzeug.middleware.proxy_fix import ProxyFix
from apscheduler.schedulers.gevent import GeventScheduler

from .response_compression import compress
from .postgres_database import postgres_database
from .annotator.suggestions import register_scheduler as register_scheduler_for_annotation_suggestions
from .reporting.check_evict import register_scheduler as register_scheduler_for_report_eviction
from .config import get_config


@lru_cache(1)
def get_software_version():
    vs = os.environ.get('DAMAST_VERSION', None)
    if vs is not None:
        return vs

    return '<unknown>'


class FlaskApp(flask.Flask):
    def __init__(self, *args, **kwargs):
        kwargs.update(template_folder=None)
        super().__init__(*args, **kwargs)
        self.json_encoder = NumericRangeEncoder

        self.make_config()

        # get configuration
        self.config.from_file('config.json', load=json.load)
        self.damast_config = get_config()

        # app environment
        is_testing = self.damast_config.environment in ('TESTING', 'PYTEST')
        self.config['TESTING'] = is_testing
        self.config['DAMAST_ENVIRONMENT'] = self.damast_config.environment

        # cookie and session cookie path
        self.cookiepath = self.damast_config.proxyprefix
        self.config['SESSION_COOKIE_PATH'] = self.cookiepath

        self._init_logging()

        # load secrets, or generate them
        try:
            with open(self.damast_config.secret_file) as f:
                logging.getLogger('flask.error').warning('Loading secrets from file %s. This should not happen on a production server.', f.name)
                _secrets = json.load(f)
        except:
            _secrets = dict()

        self.secret_key = _secrets.get('secret_key', genword(entropy='secure', charset='ascii_72'))
        self.config['jwt_secret'] = _secrets.get('jwt_secret', genword(entropy='secure', charset='ascii_72')).encode('ascii')

        # ProxyFix
        proxies_count = self.damast_config.proxycount
        self.wsgi_app = ProxyFix(self.wsgi_app,
                x_for=proxies_count,
                x_proto=proxies_count,
                x_host=proxies_count,
                x_port=proxies_count,
                x_prefix=1)

        self._init_auth()
        self._create_errorhandlers()
        self._init_database()
        self._init_access_log()
        self._init_request_misc()

        self.scheduler = None
        self._init_scheduler()

        self._init_base_blueprints()


    def __del__(self):
        if self.scheduler is not None:
            self.scheduler.shutdown()


    def _init_base_blueprints(self):
        # if a override path is provided, try to load templates from there first
        overpath = self.damast_config.override_path

        if overpath is None:
            logging.getLogger('flask.error').info('No override path provided.')

        else:
            override = flask.Blueprint('override', __name__,
                    template_folder=os.path.join(overpath, 'templates'),
                    static_folder=os.path.join(overpath, 'static'))
            self.register_blueprint(override, url_prefix='/override')
            tpls = sorted(self.jinja_env.list_templates())

            if len(tpls) == 0:
                logging.getLogger('flask.error').warn('Template override path provided, but no templates overridden. This might be an oversight.')

            else:
                for tpl in tpls:
                    logging.getLogger('flask.error').info('Template override path provides template "%s".', tpl)

        # load base templates from here (if not provided from override)
        base = flask.Blueprint('base', __name__, template_folder='templates')
        self.register_blueprint(base)


    def _init_logging(self):
        gunicorn_logger = logging.getLogger('gunicorn.error')
        self.logger.handlers = gunicorn_logger.handlers
        self.logger.setLevel(gunicorn_logger.level)

        access_logger = logging.getLogger('flask.access')
        access_logger.addHandler(TimedRotatingFileHandler(
            self.damast_config.access_log,
            when='midnight',
            interval=1,
            backupCount=10))
        access_logger.setLevel(logging.INFO)

        error_logger = logging.getLogger('flask.error')
        error_logger.addFilter(BlueprintFilter())
        _err_handler = TimedRotatingFileHandler(
            self.damast_config.error_log,
            when='midnight',
            interval=1,
            backupCount=10)
        _err_handler.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] [%(username)s] [%(blueprint)s] %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S %z'))
        error_logger.addHandler(_err_handler)
        error_logger.setLevel(logging.INFO)

        restart_str = datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()
        logmsg = F'''

        =======================================================
        = APPLICATION RESTARTING AT {restart_str            } =
        =======================================================

        '''
        error_logger.info('Application restarting')
        access_logger.info(logmsg)

        if self.debug:
            stderr_handler1 = logging.StreamHandler(sys.stderr)
            stderr_handler2 = logging.StreamHandler(sys.stderr)
            stderr_handler1.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s',
                datefmt='%Y-%m-%dT%H:%M:%S %z'))
            access_logger.addHandler(stderr_handler2)
            error_logger.addHandler(stderr_handler1)


    @contextmanager
    def auth_cursor(self):
        if not self.user_db:
            raise werkzeug.exceptions.InternalServerError('User database was not properly initialized.')

        cursor = self.user_db.cursor()
        yield cursor
        cursor.close()


    def _init_auth(self):
        # init database
        dbfile = self.damast_config.user_file
        self.user_db = sqlite3.connect(dbfile, detect_types=sqlite3.PARSE_DECLTYPES)
        def _onclose():
            if self.user_db:
                self.user_db.close()
        atexit.register(_onclose)

        self.auth = HTTPCookieTokenAuth(scheme='Bearer')

        visitor_roles = default_visitor_roles()

        # VERIFICATION
        @self.auth.verify_token
        def verify_token(token):
            try:
                payload = jwt.decode(token, self.config['jwt_secret'], algorithms=['HS256'])
                if 'role' in payload:
                    # get user from db
                    with self.auth_cursor() as c:
                        c.execute('SELECT id, password, expires, roles FROM users WHERE id = ?;', (payload['role'],))
                        userdata = c.fetchone()
                        if userdata is not None:
                            expiry = userdata[2]
                            if expiry is not None:
                                expires = (userdata[2] - datetime.date.today()).days
                                if expires <= 0:
                                    logging.getLogger('flask.error').info('User %s tried to log in, account expired for %d days.', userdata[0], -expires)
                                    flask.flash('User account expired, please contact administrator', 'error')
                                    return visitor(visitor_roles)

                            # parse roles
                            r = userdata[3]
                            roles = [] if r is None else list(map(lambda x: x.strip(), r.split(',')))
                            return User(name=userdata[0], roles=roles)

                        else:
                            logging.getLogger('flask.error').info('Wrong username or password for user %s.', payload['role'])
                            flask.flash('Wrong username or password', 'error')
                            return visitor(visitor_roles)

            except jwt.PyJWTError:
                return visitor(visitor_roles)


        @self.auth.error_handler
        def auth_error(status):
            if status == 403:
                flask.abort(403)
            else:
                flask.abort(401)


        @self.auth.get_user_roles
        def user_roles(user):
            return user.roles


        @self.after_request
        def _after_request_check_cookie_consent(resp):
            r = flask.request

            cookie_consent = r.cookies.get('cookieConsent')
            if cookie_consent not in ('essential', 'all'):
                sessionkeys = list(flask.session)
                for k in sessionkeys:
                    flask.session.pop(k)

            return resp


        @self.before_request
        def _before_request_check_cookie_consent():
            r = flask.request

            cookie_consent = r.cookies.get('cookieConsent')
            if cookie_consent not in ('essential', 'all'):
                sessionkeys = list(flask.session)
                for k in sessionkeys:
                    flask.session.pop(k)


    def _init_database(self):
        self.pg = postgres_database()


    def _create_errorhandlers(self):
        @self.errorhandler(401)
        def unauthorized_handler(err):
            # go back to requested URL afterwards
            if flask.request.method == 'GET':
                url = flask.url_for(flask.request.endpoint, **flask.request.view_args if flask.request.view_args else dict())
                query = urllib.parse.urlencode(flask.request.args)
                (scheme, loc, path, _, frag) = urllib.parse.urlsplit(url)

                next_ = urllib.parse.urlunsplit((scheme, loc, path, query, frag))
            else:
                next_ = flask.url_for('root-app.root')

            user = self.auth.current_user()
            if user and user.visitor:
                nextx = flask.url_for('root-app.root')
            else:
                nextx = flask.url_for('login.login',
                        _external=True,
                        next=next_)

            return flask.render_template('401.html', next=nextx), 401


        @self.errorhandler(403)
        @self.auth.login_required(optional=True)
        def forbidden_handler(err):
            return flask.render_template('403.html',
                    next=flask.url_for('root-app.root')), 403


        @self.errorhandler(404)
        @self.auth.login_required(optional=True)
        def not_found_handler(err):
            return flask.render_template('404.html'), 404


        def _render_error(err):
            if flask.request.accept_mimetypes['text/html']:
                return err.get_response()

            resp = err.get_response()
            resp.data = err.description
            resp.mime_type = 'text/plain'

            return resp


        @self.errorhandler(400)
        @self.errorhandler(405)
        @self.errorhandler(406)
        @self.errorhandler(408)
        @self.errorhandler(409)
        @self.errorhandler(410)
        @self.errorhandler(411)
        @self.errorhandler(412)
        @self.errorhandler(413)
        @self.errorhandler(414)
        @self.errorhandler(415)
        @self.errorhandler(416)
        @self.errorhandler(417)
        @self.errorhandler(428)
        def _40x_handler(err):
            return _render_error(err)


        @self.errorhandler(500)
        @self.errorhandler(501)
        def _50x_handler(err):
            return _render_error(err)


        @self.errorhandler(Exception)
        def _generic_exception_handler(err):
            u = uuid.uuid1()
            l = logging.getLogger('flask.error')
            tb = traceback.format_exc()
            l.error('%s: %s', u, tb)
            return _50x_handler(werkzeug.exceptions.InternalServerError(F'Something went wrong: {u}'))


    def _init_access_log(self):
        @self.after_request
        def access_log(resp):
            r = flask.request

            # do not log pgadmin accesses (too much spam)
            if r.blueprint == 'pgadmin':
                return resp

            remote_addr = r.remote_addr

            user = self.auth.current_user()
            if user is None:
                username = '-'
            else:
                username = user.name

            logstring = F'''{remote_addr} - {username} [{datetime.datetime.now().astimezone().isoformat()}] "{r.method} {r.path} {r.environ.get("SERVER_PROTOCOL")}" {resp.status_code} {resp.content_length} "{r.referrer if r.referrer is not None else '-'}" "{r.user_agent}" "{flask.request.blueprint or '-'}"'''
            logging.getLogger('flask.access').info(logstring)

            return resp


    def _init_request_misc(self):
        self.version = self.damast_config.version

        @self.context_processor
        def template_context():
            is_testing = self.config.get('TESTING', False)
            cookie_preference = flask.request.cookies.get('cookieConsent', None)
            if cookie_preference not in ('essential', 'all'):
                cookie_preference = None

            return dict(
                    # inject user into every template
                    user=self.auth.current_user(),
                    testing=is_testing,
                    version=self.version,
                    cookie_preference=cookie_preference,
                    environment='TESTING' if is_testing else 'PRODUCTION',
                    cookie_path=self.cookiepath,
                    )


        @self.after_request
        def append_headers(resp):
            is_testing = self.config.get('TESTING', False)
            resp.headers.set('X-Software-Version', self.damast_config.version)
            resp.headers.set('X-Server-Environment', 'TESTING' if is_testing else 'PRODUCTION')

            # content security policy
            resp.headers.add('Content-Security-Policy', self._build_csp())
            resp.headers.add('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
            resp.headers.add('Referrer-Policy', 'origin-when-cross-origin')

            return resp


        # use ETag, not Cache-Control: max-age
        @self.after_request
        def add_header(response):
            response.add_etag()
            return response.make_conditional(flask.request)


        # do conditional compression
        self.register_blueprint(compress)


    def _build_csp(self):
        csps = []
        csps.append("default-src 'self'")
        csps.append("font-src 'self' data:")
        csps.append("style-src 'self' 'unsafe-inline'")
        csps.append("img-src 'self' data: *")
        csps.append("frame-src 'none'")
        csps.append("frame-ancestors 'none'")
        csps.append("object-src 'none'")

        scriptsrc = "'self'"
        if self.config['TESTING']:
            # webpack does eval in test mode
            scriptsrc += " 'unsafe-eval'"

        csps.append(F'script-src {scriptsrc}')

        return '; '.join(csps)


    def serve_static_file(self, directory, filename, download_name=None):
        '''
        Serve a static file. If possible (and present), send a compressed
        version already.
        '''
        if '../' in filename:
            logging.getLogger('flask.error').info('Attempted backtracking detected for static file serving:\n        Blueprint %s\n        Directory %s\n        Filename  %s', flask.request.blueprint, directory, filename)
            raise werkzeug.exceptions.NotFound()

        formats = [('br', '.br', brotli.decompress), ('gzip', '.gz', gzip.decompress)]

        mime, _ = mimetypes.guess_type(filename)

        # fix mimetype
        if mime is None and re.search(r'\.wasm$', filename):
            mime = 'application/wasm'

        for fmt, ext, _ in formats:
            fname = filename + ext

            compressed = os.path.join(directory, fname)
            if fmt in flask.request.accept_encodings and os.path.exists(compressed):
                response = flask.send_file(compressed,
                        mimetype=mime,
                        add_etags=True,
                        conditional=False,
                        download_name=download_name)

                response.headers.set('Content-Encoding', fmt)

                return response

        # no compressed version allowed
        filepath = os.path.join(directory, filename)
        if os.path.exists(filepath):
            return flask.send_file(os.path.join(directory, filename), download_name=download_name)

        # non-compressed file does not exist
        for fmt, ext, decompress in formats:
            fname = os.path.join(directory, filename + ext)
            if os.path.exists(fname):
                with open(fname, 'rb') as f:
                    b = f.read()
                content = decompress(b)
                r = flask.Response(content, mimetype=mime)

                content_filename = download_name if download_name is not None else filename
                r.headers.set('Content-Disposition', F'inline; filename={content_filename}')

                return r

        flask.abort(404)


    def _init_scheduler(self):
        '''
        Create a scheduler that rebuilds the materialized view(s) in the
        database and evicts from the report database regularly. This also
        regularly recreates annotation suggestions.
        '''
        def rebuild_view(self):
            try:
                with self.pg.get_cursor() as c:
                    c.execute('REFRESH MATERIALIZED VIEW place_religion_overview;')
            except Exception as e:
                logging.getLogger('flask.error').warn('Could not rebuild materialized views (%s): %s', str(type(e)), str(e))
        rebuild_fn = partial(rebuild_view, self)

        self.scheduler = GeventScheduler(timezone='Europe/Berlin')
        self.scheduler.add_job(rebuild_fn, trigger='interval', minutes=10, start_date=datetime.datetime.now()+datetime.timedelta(seconds=10))

        register_scheduler_for_annotation_suggestions(self.scheduler)
        register_scheduler_for_report_eviction(self.scheduler)

        self.scheduler.start()
