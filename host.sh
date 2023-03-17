#!/bin/bash

set -euo pipefail

imagename=damast-dev:latest
dbimagename=damast-local-db

run() {
  sudo docker start $dbimagename

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
        --env PGPASSWORD=apipassword \
        --env DAMAST_REPORT_FILE=/data/reports.db \
        --env DAMAST_USER_FILE=/data/users.db \
        --env DAMAST_SECRET_FILE=/data/secrets.json \
        --env DAMAST_VERSION="$version" \
        --env DAMAST_OVERRIDE_PATH="/data/override" \
        --env DAMAST_VISITOR_ROLES="readdb,vis,reporting" \
        --env DAMAST_MAP_STYLES="map-styles.json" \
        --env DAMAST_REPORT_EVICTION_DEFERRAL=1 \
        $imagename

  sudo docker stop $dbimagename
}

build_damast() {
  www_user_id=997
  www_group_id=1001
  env="TESTING"
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

build_database() {
  tmpdir=$(mktemp -d)
  mkdir -p $tmpdir/init.d

  if [[ $dump_gzipped = 1 ]]
  then
    zcat $dump_file > $tmpdir/dump.sql
  else
    cp $dump_file $tmpdir/dump.sql
  fi

  cat > $tmpdir/init.d/init-user-db.sh <<-EOF
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "\$POSTGRES_USER" --dbname "\$POSTGRES_DB" <<-EOSQL
    CREATE USER users;
    CREATE USER api PASSWORD 'apipassword';
    CREATE USER ro_dump;
EOSQL
	EOF

  sudo docker run \
    --detach \
    --name $dbimagename \
    --net=host \
    -e POSTGRES_PASSWORD=postgres \
    -v $tmpdir/init.d/:/docker-entrypoint-initdb.d:z \
    postgis/postgis:10-3.1

  while ! pg_isready -h localhost; do sleep 1; done

  PGPASSWORD=postgres psql \
    -h localhost \
    -U postgres \
    --no-password \
    -f $tmpdir/dump.sql

  PGPASSWORD=postgres psql \
    -h localhost \
    -U postgres \
    --no-password \
    -c "ALTER DATABASE ocn RENAME TO testing;"

  sudo docker stop $dbimagename

  rm -rf $tmpdir
}

build() {
  build_database
  build_damast
}

about() {
  cat 1>&2 <<EOF
Usage: host.sh [-h] [-b [-d dump [-z]]]

Host the Flask server locally. This will run a special variant of the Docker
container, which mounts the local devdata/ directory as the /data volume on the
Docker host, for runtime configuration and logging. The local damast/ source
folder is mounted to the /damast volume.

  -h         Show this help and exit
  -b         Instead of hosting the server, build the necessary Docker images
  -d dump    Use the file "dump" to populate the dev database
  -z         Notify that dump file is GZIP:ed
EOF
}

do_build=0
dump_file=/dev/null
dump_gzipped=0


OPTIND=0
while getopts hbd:z opt
do
  case $opt in
    h)
      about
      exit 0
      ;;
    b)
      do_build=1
      ;;
    z)
      dump_gzipped=1
      ;;
    d)
      dump_file=$OPTARG
      ;;
    *)
      about
      exit 1
      ;;
  esac
done

if [[ $do_build = 1 ]]
then
  build
else
  run
fi
