#!/bin/sh
#
# Script to dump a PostgreSQL database. To be called by a regular cronjob.
#
# Author: Max Franke <Max.Franke@vis.uni-stuttgart.de>
# Created: Tue Apr 23 14:50:02 CEST 2019
# Last updated: Wed Apr 24 10:47:47 CEST 2019

if [ "$1" = "-h" ]
then
  cat 1>&2 <<EOF

  Usage: $0 [-h]

    -h      Show this help

  This script will dump the PostgreSQL database on narcocorrido using a
  special, read-only account. The dump will be stored as a gzip-compressed SQL
  file in the backups/ subfolder of ~/psql.

  Some environment variables will modify the behavior of the script:

    PG_WDIR     Working directory of the script. Default: ~/psql
    PG_DUMP     pg_dump executable path. Default: ./pg_dump
    PG_USER     PostgreSQL (read-only) user. Default: ro_dump
    PG_PASS     PostgreSQL password. Default: dump
    PG_DB       PostgreSQL database name. Default: ocn
    PG_HOST     PostgreSQL host. Default: narcocorrido

EOF
  exit 1
fi

PG_WDIR=${PG_WDIR:-~/psql}
PG_DUMP=${PG_DUMP:-./pg_dump}
PG_USER=${PG_USER:-ro_dump}
PG_PASS=${PG_PASS:-dump}
PG_DB=${PG_DB:-ocn}
PG_HOST=${PG_HOST:-narcocorrido}

cd ${PG_WDIR}

mkdir -p backups
BACKUP_NAME=$(date +"backups/%Y%m%dT%H%M%S.sql")

# redirect stderr to temporary file
TEMPFILE=$(mktemp)
exec 2> $TEMPFILE

# execute dump
PGPASSWORD=${PG_PASS} LD_LIBRARY_PATH="$(pwd)/lib" ${PG_DUMP} \
  -U ${PG_USER} \
  -d ${PG_DB} \
  -h ${PG_HOST} \
  --clean \
  --create \
  --oids \
  --no-password \
  | gzip -9 > "${BACKUP_NAME}.gz"

# create log and clean up temp file
awk '{ print strftime("%y-%m-%dT%H:%M:%S"), "--", $0; }' <$TEMPFILE >> error.log
rm $TEMPFILE
