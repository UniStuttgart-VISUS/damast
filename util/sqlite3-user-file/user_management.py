#!/usr/bin/env python3

import datetime
import sqlite3
import argparse
import sys
import subprocess
import secrets
import string
from passlib.hash import sha256_crypt


def list_users(args, c):
    fmt = '{userid:8s}  {exp:>7s}  {roles:70s}  {comment}'
    c.execute('SELECT  * FROM users;')
    print(fmt.format(userid='USER ID', exp='EXPIRES', roles='ROLES', comment='COMMENT'))
    for username, password, expires, roles, comment in c.fetchall():
        today = datetime.date.today()
        time_left = (expires - today).days if expires is not None else None
        _tls = F'{time_left}' if time_left is not None else 'inf'
        roles = roles or ''
        comment = comment or ''

        print(fmt.format(userid=username, exp=_tls, roles=roles, comment=comment))


def add_user(args, c):
    if args.password is None:
        pw = ''.join(secrets.choice(string.ascii_letters + string.digits) for i in range(32))
        print(F"Created random password: '{pw}'")
    else:
        pw = args.password
    pw_hash = sha256_crypt.hash(pw)

    c.execute('INSERT INTO users (id, password, expires, roles, comment) VALUES (?, ?, ?, ?, ?);', (args.username, pw_hash, args.expires.strftime('%Y-%m-%d') if args.expires is not None else None, args.roles, args.comment))


def remove_user(args, c):
    c.execute('SELECT COUNT(*) FROM users where id = ?;', (args.username,))
    (count,) = c.fetchone()
    if count == 0:
        sys.stderr.write(F"No user with ID '{args.username}'.\n")
        sys.exit(1)

    c.execute('DELETE FROM users WHERE id = ?;', (args.username,))
    print(F"Removed user with ID '{args.username}'.")


def change_expiry(args, c):
    c.execute('SELECT COUNT(*) FROM users where id = ?;', (args.username,))
    (count,) = c.fetchone()
    if count == 0:
        sys.stderr.write(F"No user with ID '{args.username}'.\n")
        sys.exit(1)

    at = args.expires.strftime('%Y-%m-%d')
    delta = (args.expires - datetime.date.today()).days
    c.execute('UPDATE users SET expires = ? WHERE id = ?;', (at, args.username))
    print(F"Set user account '{args.username}' to expire on {at} ({delta} days from now).")


def change_comment(args, c):
    c.execute('SELECT COUNT(*) FROM users where id = ?;', (args.username,))
    (count,) = c.fetchone()
    if count == 0:
        sys.stderr.write(F"No user with ID '{args.username}'.\n")
        sys.exit(1)

    c.execute('UPDATE users SET comment = ? WHERE id = ?;', (args.comment, args.username))
    if args.comment is None:
        print(F"Cleared comment for user account '{args.username}'.")
    else:
        print(F"Set comment for user account '{args.username}' to '{args.comment}'.")


def change_roles(args, c):
    c.execute('SELECT roles FROM users where id = ?;', (args.username,))
    ret = c.fetchone()
    if ret is None:
        sys.stderr.write(F"No user with ID '{args.username}'.\n")
        sys.exit(1)

    (old_roles,) = ret
    if args.action == 'set':
        roles = args.roles
    else:
        old = list(filter(lambda x: len(x)>0, map(lambda y: y.strip(), old_roles.split(',') if old_roles is not None else [])))
        roles = sorted(list(set([*old, *args.roles])))

    rolesstr = ','.join(roles)
    c.execute('UPDATE users SET roles = ? WHERE id = ?;', (rolesstr, args.username))
    print(F"Changed roles for user '{args.username}' from '{old_roles}' to '{rolesstr}'.")


def _parse_day(s):
    try:
        s = subprocess.check_output(['date', '+%Y-%m-%d', '--date', s], encoding='utf-8')
        return datetime.datetime.strptime(s.strip(), '%Y-%m-%d').date()
    except subprocess.CalledProcessError as e:
        sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Manage users and passwords in a SQLite3 database')
    parser.add_argument('db', type=argparse.FileType('r+b'), help='SQLite3 database file')
    subparsers = parser.add_subparsers(title='action', description='Action to do')

    # list
    p_list = subparsers.add_parser('list', help='List all users')
    p_list.set_defaults(func=list_users)

    # add
    p_add = subparsers.add_parser('add', help='Add a new user')
    p_add.add_argument('-r', '--roles', metavar='roles', help='Roles the user is part of', default=None, type=str)
    p_add.add_argument('-c', '--comment', metavar='comment', help='Comment', default=None, type=str)
    p_add.add_argument('-e', '--expires', metavar='date', help='User expiry date', default=None, type=_parse_day)
    p_add.add_argument('username', help='Name of user to be created')
    p_add.add_argument('password', help='Password, omit for auto-generated password', nargs='?', action='store')
    p_add.set_defaults(func=add_user)

    # remove
    p_rm = subparsers.add_parser('remove', help='Remove an existing user')
    p_rm.add_argument('username', help='Name of user')
    p_rm.set_defaults(func=remove_user)

    # expire
    p_exp = subparsers.add_parser('expire', help='Change the expiry date of a user account')
    p_exp.add_argument('username', help='Name of user')
    p_exp.add_argument('expires', help='New expiry date', default='today', type=_parse_day, nargs='?', action='store')
    p_exp.set_defaults(func=change_expiry)

    # comment
    p_comm = subparsers.add_parser('comment', help='Change the comment of a user account')
    p_comm.add_argument('username', help='Name of user')
    p_comm.add_argument('comment', help='New comment', default=None, type=str, nargs='?', action='store')
    p_comm.set_defaults(func=change_comment)

    # roles
    p_roles = subparsers.add_parser('roles', help='Change the roles of a user account')
    p_roles.add_argument('username', help='Name of user')
    p_roles.add_argument('action', help='What to do', choices=['add','set'])
    p_roles.add_argument('roles', help='Roles', type=str, nargs='*', action='store')
    p_roles.set_defaults(func=change_roles)


    parsed = parser.parse_args(sys.argv[1:])
    if 'func' in parsed:
        conn = sqlite3.connect(parsed.db.name, detect_types=sqlite3.PARSE_DECLTYPES)
        c = conn.cursor()

        parsed.func(parsed, c)

        c.close()
        conn.commit()
        conn.close()
    else:
        parser.print_help()
        sys.exit(1)
