#!/bin/bash

set -euo pipefail

# print help and exit
function about() {
  cat 1>&2 <<EOF
Usage: deploy.sh [-h] [-bnpr] [-d <timespec>] [-l login] [-H host] [-u <www_uid>] [-g <www_gid>]

Build the client-side assets and bundle the server Docker image. Deploy that to
the server and restart the Flask server. By default, this deploys to the
testing environment and restarts the systemd service immediately. Additional
flags allow to build the Docker image on the deploy server instead (less file
transmission, faster), to not rebuild assets, or to not deploy the image.

  -h                Show this help and exit
  -p                Deploy to production environment instead
  -n                No not re-make assets, deploy as-is
  -b                Build only: Only create Docker image, no not deploy
  -r                Remote build: Build Docker image on remote host. This is
                    faster, as the save and load steps are skipped and the tar
                    file with an entire Linux distro does not have to be copied
                    over, but introduces more load on the remote host.
  -d timespec       Delay the installation and service restart until time. This
                    uses at and recognizes timespecs as specified by at(1p).
  -l login          Set login user on the deployment host.
  -H host           Set the host to deploy to.
  -u uid            User ID of 'www' user on the target machine.
  -g gid            Group ID of 'www' group on the target machine.
  -a                Ask for passwords, instead of using pass(1) with the
                    following schema with the FQDN and login name of the
                    respective host and user: pass ssh/<fqdn>/<login>
EOF
}

# log messages
log() {
  clr_reset=$(tput sgr0)

  ask="\n\n"

  case "$1" in
    major)
      clr_main=$(tput sgr0; tput setaf 5)
      clr_important=$(tput setaf 6; tput bold)
      ;;
    minor)
      clr_main=$(tput sgr0; tput setaf 3)
      clr_important=$(tput setaf 2; tput bold)
      ;;
    ask)
      clr_main=$(tput sgr0; tput setaf 3)
      clr_important=$(tput setaf 2; tput bold)
      ask=" "  # no newline, answer on same line
      ;;
    *)
      1>&2 echo "Log messages must have major or minor level, or \"ask\"!"
      exit 1
      ;;
  esac
  shift

  msg="\n$clr_main$1$clr_reset$ask"

  shift
  args=()
  for arg in "$@"
  do
    args+=("$clr_important$arg$clr_main")
  done

  printf "$msg" "${args[@]}"
}

## default values
# environment
env="TESTING"

# file directory on server
basedir="/www-testing"

# systemd service name
service="damast-testing"

# server port
port=8001

# install and restart service
delay="now"

# www user id
www_user_id=997

# www group id
www_group_id=1001

# remake assets
remake=1

# deploy to remote host
deploy=1

# build Docker image locally by default
remote_build=0
build_server="$(hostname)"
build_user="$(whoami)"

# deploy to max@narcocorrido.visus.uni-stuttgart.de by default
deploy_server="narcocorrido.visus.uni-stuttgart.de"
deploy_user="max"

# do not ask for passwords by default
password_ask=0

## values passed via command-line arguments

OPTIND=0
while getopts hpnd:brl:H:u:g:a opt
do
  case $opt in
    h)
      about
      exit 0
      ;;
    p)
      # deploy to production
      env="PRODUCTION"
      basedir="/www"
      service="damast"
      port=8000
      ;;
    d)
      # do not install on server, instead do this later via at job
      delay="$OPTARG"
      ;;
    n)
      # deploy as-is, without running Make first
      remake=0
      ;;
    b)
      # do not deploy
      deploy=0
      ;;
    r)
      # build remotely
      remote_build=1
      ;;
    l)
      # deploy as other user
      deploy_user="$OPTARG"
      ;;
    H)
      # deploy to other server
      deploy_server="$OPTARG"
      ;;
    u)
      # set www user ID
      www_user_id="$OPTARG"
      ;;
    g)
      # set www group ID
      www_group_id="$OPTARG"
      ;;
    a)
      # ask for passwords
      password_ask=1
      ;;
    *)
      about
      exit 1
      ;;
  esac
done

# set this afterwards, so that it depends on deploy_user and deploy_server
if [[ $remote_build = 1 ]]
then
  build_user="$deploy_user"
  build_server="$deploy_server"
fi

# check that no-deploy flag is not used together with remote build
if [[ $deploy = 0 && $remote_build = 1 ]]
then
  cat 1>&2 << EOF
No-deploy flag (-b) and remote build flag (-r) are mutually exclusive.
EOF
  exit 1
fi

if [[ $deploy = 1 ]]
then
  log major "DEPLOYING TO %s (building as %s@%s)..." "$env" "$build_user" "$build_server"
else
  log major "BUILDING %s WITHOUT DEPLOY..." "$env"
fi

# collect required passwords
log major "Collecting required passwords"

if [[ $password_ask = 1 ]]
then
  stty -echo

  if [[ $deploy = 1 ]]
  then
    log ask "Please enter the password for the deploy server user (%s@%s):" "$deploy_user" "$deploy_server"
    read deploypassword
  fi

  if [[ $remote_build = 0 ]]
  then
    log ask "Please enter your local user password for Docker image build (%s@%s):" "$(whoami)" "$(hostname)"
    read localpassword

    buildpassword="$localpassword"
  else
    buildpassword="$deploypassword"
  fi

  stty echo
else
  if [[ $deploy = 1 ]]
  then
    deploypassword=$(pass ssh/$deploy_server/$deploy_user)
  fi

  if [[ $remote_build = 0 ]]
  then
    localpassword=$(pass ssh/$(hostname)/$(whoami))
    buildpassword="$localpassword"
  else
    buildpassword="$deploypassword"
  fi
fi

# create a temporary directory for build files
tmpdir=$(ssh ${build_user}@${build_server} mktemp -d)

# version: git tag, plus optionally a divergence, but only allow a certain set of characters
version=$(echo -n $(git describe --tags) | tr -sc '[a-zA-Z0-9_.\-]' '-')

# check if version is not empty (#196)
if [[ -z "$version" ]]
then
  1>&2 cat <<EOF

ERROR! Version string is empty.

The version string is derived from the output of "git describe --tags". If it
is empty, that probably means there are no tags in the repository. That should
never be the case! If you are on a forked repository, please make sure to fetch
the tags of the upstream repository by adding it as a remote (here:
"upstream"), and then calling "git fetch upstream --tags".
EOF
  exit 1
fi

# name of Docker image, e.g.: damast:v1.6.2rc1-testing
imagename="damast:$version-$(echo $env | tr '[:upper:]' '[:lower:]')"
filename="$imagename.tgz"

if [[ $remake = 1 ]]
then
  log major "Rebuilding targets for deploy"
  log minor "Cleaning previous build artifacts"
  make clean

  log minor "Starting clean minimized build"
  make prod
else
  # always ensure these are copied into the damast/ directory
  make CHANGELOG LICENSE
fi

log major "Building docker image for %s on %s@%s" "$version" "$build_user" "$build_server"
log minor "Syncing assets for docker image"

# create hash from damast/ file contents
fs_hash=$(find damast -type f \
  | xargs sha1sum \
  | awk '{print $1}' \
  | sha1sum - \
  | awk '{print $1}')

# use hash to ensure new files are copied into the Docker image
cat util/docker/{base,prod}.in \
  | sed "s/@REBUILD_HASH@/$fs_hash/g" \
  | ssh ${build_user}@${build_server} "cat > $tmpdir/Dockerfile"

# copy files to build server (can be local machine)
rsync --info=flist2,misc0,stats0 -iavzz \
  damast \
  ${build_user}@${build_server}:$tmpdir/


log minor "Building docker image"

echo "$buildpassword" \
  | ssh ${build_user}@${build_server} "cd ${tmpdir} && \
      sudo --stdin --prompt='Reading sudo password for %u@%H from stdin...' \
        docker build \
          -t $imagename \
          --build-arg=USER_ID=$www_user_id \
          --build-arg=GROUP_ID=$www_group_id \
          --build-arg=DAMAST_ENVIRONMENT=$env \
          --build-arg=DAMAST_VERSION=$version \
          --build-arg=DAMAST_PORT=$port \
          ."


log major "Deploying to %s on %s" "$env" "$deploy_server"

if [[ $deploy = 1 ]]
then
  # local build: save docker image, copy it over
  if [[ $remote_build = 0 ]]
  then
    log minor "Exporting docker image for %s" "$version"

    echo "$localpassword" \
     | sudo --stdin --prompt='Reading sudo password for %u@%H from stdin...' \
         docker save $imagename \
     | gzip \
     > $tmpdir/$filename

    log minor "Copying docker file %s to %s@%s:%s..." "$filename" "${deploy_user}" "${deploy_server}" "/tmp"
    scp $tmpdir/$filename "${deploy_user}@${deploy_server}:/tmp"
  fi


  # create run script, which needs the systemd service name and the image name
  sed "s/!!SYSTEMD_SERVICE_NAME!!/$service/" util/run_server.sh.in \
    | sed "s/!!DOCKER_IMAGE_NAME!!/$imagename/" \
    | ssh ${build_user}@${build_server} "cat > $tmpdir/run_server.sh"
  ssh ${build_user}@${build_server} "chmod +x $tmpdir/run_server.sh"


  log minor "Syncing utilities"
  if [[ $remote_build = 1 ]]
  then
    rsync --info=flist2,misc0,stats0 -ivzz \
      util/logstat.awk \
      util/sqlite3-user-file/user_management.py \
      util/list_reports.py \
      "${deploy_user}@${deploy_server}:$basedir"

    # on remote build, copy run script to correct directory
    ssh ${deploy_user}@${deploy_server} "cp -v $tmpdir/run_server.sh $basedir"
  else
    # on local build, also copy run script

    rsync --info=flist2,misc0,stats0 -ivzz \
      util/logstat.awk \
      util/sqlite3-user-file/user_management.py \
      util/list_reports.py \
      $tmpdir/run_server.sh \
      "${deploy_user}@${deploy_server}:$basedir"
  fi


  log minor "Scheduling atjob for %s" "$delay"
  jobfile=$(mktemp atjob.XXXXXXXX)
  jobfile_base=$(basename $jobfile)

  if [[ $remote_build = 1 ]]
  then
    # image already on server, only restart (with new run_server.sh)
    cat >$jobfile <<- EOF
		systemctl restart $service
		echo Restarted systemd service $service with image $imagename.
		EOF

  else
    # load image, then restart
    cat >$jobfile <<- EOF
		systemctl stop $service
		docker load < /tmp/$filename && rm /tmp/$filename
		systemctl start $service
		echo Restarted systemd service $service with image $imagename.
		EOF
  fi

  scp $jobfile ${deploy_user}@${deploy_server}:/tmp
  echo "$deploypassword" \
    | ssh ${deploy_user}@${deploy_server} "sudo --stdin --prompt='Reading sudo password for %u@%H from stdin...' at -m -f /tmp/$jobfile_base $delay"
fi

log minor "Cleaning up"

if [[ $deploy = 1 ]]
then
  rm $jobfile
  ssh ${deploy_user}@${deploy_server} rm /tmp/$jobfile_base
fi

ssh ${build_user}@${build_server} "rm -r $tmpdir"

log major "Finished deploying to %s on %s" "$env" "$deploy_server"
