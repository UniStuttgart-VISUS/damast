#!/usr/bin/env python3

import yaml
import sys

with open(sys.argv[1]) as f:
    users = yaml.safe_load(f)

    uid = 1

    for user, props in users.items():
        if 'user' in props['roles']:
            print(F"INSERT INTO users (id, name, comment) VALUES ({uid}, '{user}', 'pytest test user');")
            uid += 1

    print(F"SELECT pg_catalog.setval('public.users_id_seq', {uid}, true);")
