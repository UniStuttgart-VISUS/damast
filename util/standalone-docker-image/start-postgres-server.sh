#!/bin/sh

set -eu

if test "$(whoami)" "!=" "postgres"
then
  echo "Error: $0 must be started under the 'postgres' user!"
  exit 1
fi

nohup /usr/lib/postgresql/11/bin/postgres -D /usr/local/pgsql/data > /tmp/postgresql.log &
echo "Started PostgreSQL 11 server"

while ! pg_isready -h localhost
do
  sleep 1
done