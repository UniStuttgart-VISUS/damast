#!/bin/sh

set -eu

if test "$(whoami)" "!=" "www"
then
  echo "Error: $0 must be started under the 'www' user!"
  exit 1
fi

cat <<-EOF
Starting Damast Flask server on [::]:$DAMAST_PORT (inside of Docker container) ...

Damast will be available through the nginx reverse proxy on [::]:${NGINX_PORT:-80} as well.
This address and port should be exposed to the outside of the container (by
passing "-p ${NGINX_PORT:-80}:${NGINX_PORT:-80}" to "docker run") to ensure that all internal links and
redirects work as desired. The internal nginx port can be changed through the
environment variable NGINX_PORT, and is 80 by default. To change it, pass the
new value to "docker run" as "-e NGINX_PORT=<new value>.

Keep in mind that the respective port should be exposed outside of the
container with the "-p <external>:<internal>" flag as well. The internal and
external flag MUST match so that redirects and internal links in Damast work
properly. Mapping the internal port to a different external port will break
already on the redirect to the login page.

The internal port for the Damast Flask server can be exposed as well. This will
break the map tiles hosted via the internal nginx server, but otherwise work.
By default, the Flask server listens on [::]:8000. This can be changed by
setting a new port via "-e DAMAST_PORT=<new port>". Note that if the nginx and
Damast internal ports are the same, the Damast port is changed to 8001.
EOF

/usr/bin/env python3 \
  -m gunicorn \
  -b "[::]:$DAMAST_PORT" \
  'damast:create_app()' \
  --worker-class=gevent \
  --workers=1 \
  --threads=4 \
  --timeout 0