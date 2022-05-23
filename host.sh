#!/bin/bash

imagename=damast-dev:latest

port() {
  ssh -NfL ${1}:localhost:${1} narcocorrido
  echo "Tunnelling localhost:$1 to narcocorrido:$1"
}

run() {
  port 5432     # postgresql
  set -euo pipefail

  version=$(echo -n $(git describe --tags) | tr -sc '[a-zA-Z0-9_.-]' '-')

  sudo docker run \
        --name damast-dev-server \
        -it \
        --init \
        --rm \
        --volume="$(pwd)/damast:/damast:z" \
        --volume="$(pwd)/devdata:/data/:z" \
        --net=host \
        --env FLASK_DEBUG=1 \
        --env FLASK_ACCESS_LOG=/data/access_log \
        --env FLASK_ERROR_LOG=/data/error_log \
        --env PGPASSWORD=$(pass db/narcocorrido.visus.uni-stuttgart.de/api) \
        --env DAMAST_REPORT_FILE=/data/reports.db \
        --env DAMAST_USER_FILE=/data/users.db \
        --env DAMAST_SECRET_FILE=/data/secrets.json \
        --env DAMAST_VERSION="$version" \
        --env DAMAST_OVERRIDE_PATH="/data/override" \
        --env DAMAST_VISITOR_ROLES="readdb,vis,reporting" \
        --env DAMAST_MAP_STYLES="map-styles.json" \
        --env DAMAST_REPORT_EVICTION_DEFERRAL=1 \
        $imagename
}

build() {
  www_user_id=997
  www_group_id=1001
  env="TESTING"
  basedir="/www"
  service="damast"
  port=8000

  cat util/docker/{base,dev}.in > Dockerfile

  sudo docker build \
          -t $imagename \
          --build-arg=USER_ID=$www_user_id \
          --build-arg=GROUP_ID=$www_group_id \
          --build-arg=DAMAST_ENVIRONMENT=$env \
          --build-arg=DAMAST_PORT=$port \
          --build-arg=OWN_USER_ID=$(id -u) \
          --build-arg=OWN_USER_NAME=$(whoami) \
          .
}

about() {
  cat 1>&2 <<EOF
Usage: host.sh [-h] [-b]

Host the Flask server locally. This will run a special variant of the Docker
container, which mounts the local devdata/ directory as the /data volume on the
Docker host, for runtime configuration and logging. The local damast/ source
folder is mounted to the /damast volume.

  -h    Show this help and exit
  -b    Instead of hosting the server, build the necessary Docker image
EOF
}

OPTIND=0
while getopts hb opt
do
  case $opt in
    h)
      about
      exit 0
      ;;
    b)
      build
      exit 0
      ;;
    *)
      about
      exit 1
      ;;
  esac
done

run
