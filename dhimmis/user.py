from dataclasses import dataclass
from typing import List
import os
import logging


@dataclass
class User:
    "Class for storing information about the current user."
    name: str
    roles: List[str]
    visitor: bool = False


_allowed_visitor_roles = set(('user', 'readdb', 'annotator', 'geodb', 'pgadmin', 'reporting', 'vis'))
_disallowed_visitor_roles = set(('writedb', 'dev', 'admin'))

def default_visitor_roles():
    # get default roles for visitors
    roles_str = filter(
            lambda s: len(s) > 0,
            map(
                lambda r: r.strip(),
                os.environ.get('DHIMMIS_VISITOR_ROLES', 'user,readdb,vis').split(',')
                )
            )

    roles = ['visitor']
    for role in roles_str:
        if role in _disallowed_visitor_roles:
            logging.getLogger('flask.error').warning('Cannot assign role %s to visitors: Too many privileges. Skipping.', role)
        elif role not in _allowed_visitor_roles:
            logging.getLogger('flask.error').warning('Cannot assign role %s to visitors: Unknown role. Skipping.', role)
        else:
            roles.append(role)

    logging.getLogger('flask.error').info('Visitors will have the following roles: %s', ', '.join(roles))
    return roles
