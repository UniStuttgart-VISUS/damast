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
    roles_str = os.environ.get('DHIMMIS_VISITOR_ROLES')
    if roles_str is None:
        logging.getLogger('flask.error').info('Visitor handling is disabled.')
        return None

    roles_in = filter(
            lambda s: len(s) > 0,
            map(
                lambda r: r.strip(),
                roles_str.split(',')
                )
            )

    roles = ['visitor']
    for role in roles_in:
        if role in _disallowed_visitor_roles:
            logging.getLogger('flask.error').warning('Cannot assign role %s to visitors: Too many privileges. Skipping.', role)
        elif role not in _allowed_visitor_roles:
            logging.getLogger('flask.error').warning('Cannot assign role %s to visitors: Unknown role. Skipping.', role)
        else:
            roles.append(role)

    logging.getLogger('flask.error').info('Visitors will have the following roles: %s', ', '.join(roles))
    return roles

def visitor(roles):
    if roles is None:
        return None

    return User(name=None, roles=roles, visitor=True)
