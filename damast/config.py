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

_config_entries = [
    ConfigEntry(
        envvar = 'DAMAST_VERSION',
        varname = 'version',
        type = str,
        default = '<unknown>',
        description = 'software version string',
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
