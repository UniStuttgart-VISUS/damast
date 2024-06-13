#!/bin/sh

set -eu

if test "$(whoami)" "!=" "root"
then
  echo "Error: $0 must be started under the 'root' user!"
  exit 1
fi

# decide which port to run nginx and Damast on via environment variables
port=${NGINX_PORT:-80}
damastport=${DAMAST_PORT:-8000}

if test "$damastport" "=" "$port"
then
  echo "Warning: nginx is set to run on the same port as Damast ($DAMAST_PORT). Changing Damast to run on port 8001 instead."
  DAMAST_PORT=8001
  damastport=${DAMAST_PORT:-8001}
  export DAMAST_PORT
fi

sed "s/@NGINX_PORT@/$port/g;s/@DAMAST_PORT@/$damastport/g" /etc/nginx/templates/default.conf.template > /etc/nginx/sites-available/default

echo "Starting nginx on [::]:$port"
nginx
echo

su postgres -c /start-postgres-server.sh
echo

su www -c /start-damast.sh