#!/bin/bash

if [ "$EUID" -ne 0 ]; then
	cat 1>&2 <<-EOM
	The test script needs to be run with superuser privileges. It needs to start a
	series of Docker containers.
	EOM

  exit 1
fi


set -euo pipefail

run() {
  (
    source pyenv/bin/activate
    PYTHONPATH=$(pwd):$(pwd)/tests:${PYTHONPATH:-} \
      pytest --color=yes $@ \
      | tee pytest.log
  )
}


build() {
  (
    cd tests/database
    sudo -u ${SUDO_USER:-root} make Dockerfile
    docker build -t damast-pytest-testdb .
  )

  if [ ! -d pyenv ]
  then
    python3 -m venv pyenv
    (
      source pyenv/bin/activate
      pip install --upgrade pip
      pip install wheel
      pip install 'flask==2.3.2' 'gunicorn[gevent]' 'requests' 'Flask-HTTPAuth' \
      'passlib[bcrypt]' 'pyjwt>=2' 'pyyaml' 'postgres' 'password-strength' \
      'brotli' 'apscheduler' 'html5lib' 'jsonschema==3.2.0' 'python-dateutil' \
      'beautifulsoup4' 'python-Levenshtein==0.12.2' 'wheel' 'pytest' \
      'pytest-xdist' 'pytest-timeout'
    )
  fi
}

about() {
  cat 1>&2 <<EOF
Usage: test.sh [-h] [-b]

Run pytest tests.

  -h    Show this help and exit.
  -b    Instead of testing, build the necessary Docker image and create the
        virtualenv.
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

run $@
