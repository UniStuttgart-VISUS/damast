import sys
sys.path= sys.path[1:]

import os
import json
from dataclasses import dataclass, field, make_dataclass
from typing import List
from functools import namedtuple
import logging

logging.basicConfig()
logger = logging.getLogger('flask.error')

ConfigEntry = namedtuple(
        'ConfigEntry',
        'envvar,varname,type,default,description,parse_func',
        defaults=[ None ],
        )

NO_VALUE = make_dataclass('NoValue', [])()

_valid_environments = ('PRODUCTION', 'TESTING', 'PYTEST')
def _check_environment_valid(raw_value):
    if raw in _valid_environments:
        return raw

    _vs = ", ".join(map(lambda x: F'"{x}"', _valid_environments))
    raise ValueError(F'DAMAST_ENVIRONMENT must be one of {_vs}.')


_config_entries = [
        ConfigEntry(
            envvar = 'PGHOST',
            varname = 'pghost',
            type = str,
            default = 'localhost',
            description = 'PostgreSQL hostname'
            ),
        ConfigEntry(
            envvar = 'PGPASSWORD',
            varname = 'pgpassword',
            type = str,
            default = NO_VALUE,
            description = 'PostgreSQL password'
            ),
        ConfigEntry(
            envvar = 'PGPORT',
            varname = 'pgport',
            type = int,
            default = 5432,
            description = 'PostgreSQL port'
            ),
        ConfigEntry(
            envvar = 'PGUSER',
            varname = 'pguser',
            type = str,
            default = 'api',
            description = 'PostgreSQL user'
            ),

        ConfigEntry(
            envvar = 'DAMAST_VERSION',
            varname = 'version',
            type = str,
            default = '<unknown>',
            description = 'software version string',
            ),
        ConfigEntry(
            envvar = 'DAMAST_ENVIRONMENT',
            varname = 'environment',
            type = str,
            parse_func = _check_environment_valid,
            default = 'PRODUCTION',
            description = 'damast server environment'
            ),

        ConfigEntry(
            envvar = 'DAMAST_PORT',
            varname = 'port',
            type = int,
            default = 8000,
            description = 'port at which `gunicorn` serves the content'
            ),
        ConfigEntry(
            envvar = 'DAMAST_PROXYCOUNT',
            varname = 'proxycount',
            type = int,
            default = 1,
            description = 'number of reverse proxies in front of the server',
            ),
        ConfigEntry(
            envvar = 'DAMAST_PROXYPREFIX',
            varname = 'proxyprefix',
            type = str,
            default = '/',
            description = 'reverse proxy prefix.'
            ),

        ConfigEntry(
            envvar = 'FLASK_ACCESS_LOG',
            varname = 'access_log',
            type = str,
            default = '/data/access_log',
            description = 'path to `access_log` (for logging)'
            ),
        ConfigEntry(
            envvar = 'FLASK_ERROR_LOG',
            varname = 'error_log',
            type = str,
            default = '/data/error_log',
            description = 'path to `error_log` (for logging)'
            ),
        ConfigEntry(
            envvar = 'DAMAST_SECRET_FILE',
            varname = 'secret_file',
            type = str,
            default = '/dev/null',
            description = 'file with JWT and app secret keys'
            ),
        ConfigEntry(
            envvar = 'DAMAST_USER_FILE',
            varname = 'user_file',
            type = str,
            default = '/data/users.db',
            description = 'path to SQLite3 file with users, passwords, roles'
            ),
        ConfigEntry(
            envvar = 'DAMAST_VISITOR_ROLES',
            varname = 'visitor_roles',
            type = List[str],
            parse_func=lambda raw: list(
                filter(
                    lambda s: len(s) > 0,
                    map(
                        lambda r: r.strip(),
                        raw.split(',')
                        )
                    )
                ),
            default = None,
            description = 'visitor roles',
            ),

        ConfigEntry(
            envvar = 'DAMAST_REPORT_FILE',
            varname = 'report_file',
            type = str,
            default = '/data/reports.db',
            description = 'file to which reports are stored during generation'
            ),

        ConfigEntry(
            envvar = 'DAMAST_MAP_STYLES',
            varname = 'map_styles',
            type = str,
            default = None,
            description = 'relative filename (under `/data`) on the Docker filesystem to a JSON with map styles'
            ),
        ConfigEntry(
            envvar = 'DAMAST_OVERRIDE_PATH',
            varname = 'override_path',
            type = str,
            default = None,
            description = 'path to override templates and provide extra static files'
            ),

        ConfigEntry(
            envvar = 'DAMAST_REPORT_EVICTION_DEFERRAL',
            varname = 'report_eviction_deferral',
            type = int,
            default = None,
            description = 'number of days of not being accessed before report contents are evicted',
            ),
        ConfigEntry(
            envvar = 'DAMAST_REPORT_EVICTION_MAXSIZE',
            varname = 'report_eviction_maxsize',
            type = int,
            default = None,
            description = 'file size in megabytes (MB) of report contents above which reports will be evicted',
            ),
        ConfigEntry(
            envvar = 'DAMAST_ANNOTATION_SUGGESTION_REBUILD',
            varname = 'annotation_suggestion_rebuild',
            type = int,
            default = None,
            description = 'number of days between annotation suggestion rebuilds',
            ),
        ]

_cfgs = []
for c in _config_entries:
    if c.default is NO_VALUE:
        _cfgs.append((c.varname, c.type))
    else:
        _cfgs.append((c.varname, c.type, field(default=c.default)))

_Config = make_dataclass('Config', _cfgs, frozen=True, kw_only=True)


def get_config():
    ''' get configuration with all values '''
    vals = dict()

    # TODO: load from config JSON/... file as well
    config_from_file = dict()

    for entry in _config_entries:
        preprocess = entry.parse_func if entry.parse_func is not None else entry.type

        # environment variable has precedence
        if entry.envvar in os.environ:
            vals[entry.varname] = preprocess(os.environ.get(entry.envvar))

        # then the config file's value
        elif entry.varname in config_from_file:
            vals[entry.varname] = preprocess(config_from_file[entry.varname])

        # then the default value, if set
        elif entry.default is not NO_VALUE:
            vals[entry.varname] = entry.default

        # otherwise, fail
        else:
            logger.critical('No value passed for "%s" via environment variable "%s" or configuration file entry "%s" (type %s), and no default given. Aborting.',
                    entry.description,
                    entry.envvar,
                    entry.varname,
                    entry.type.__name__)
            sys.exit(1)



    c = _Config(**vals)
    print(c)


get_config()
