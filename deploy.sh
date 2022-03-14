#!/bin/bash

set -euo pipefail

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


# print help and exit
function about() {
  cat 1>&2 <<EOF
Usage: deploy.sh [-h] [-bnpr] [-d <timespec>] [-l login] [-H host] [-u <www_uid>] [-g <www_gid>]

Build the client-side assets and bundle the server wheel file. Deploy that to
the server and restart the Flask server. By default, this deploys to the
testing environment and restarts the systemd service immediately.

  -h                Show this help and exit
  -p                Deploy to production environment instead
  -n                No not re-make assets, deploy as-is
  -b                Build only: Only create Docker image, no not deploy
  -r                Remote build: Build Docker image on remote host. This is
                    faster, as the save and load steps are skipped and the tar
                    file with an entire Linux distro does not have to be copied
                    over, but introduces more load on the remote host.
  -d time_arg       Delay the installation and service restart until time. This
                    uses at and recognizes timespecs as specified by at(1p).
  -l login          Set login user on the deployment host.
  -H host           Set the host to deploy to.
  -u uid            User ID of 'www' user on the target machine.
  -g gid            Group ID of 'www' group on the target machine.
EOF
}

OPTIND=0
while getopts hpnd:brl:H:u:g: opt
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
    *)
      about
      exit 1
      ;;
  esac
done

if [[ $remote_build = 1 ]]
then
  build_user="$deploy_user"
  build_server="$deploy_server"
fi


if [[ $deploy = 0 && $remote_build = 1 ]]
then
  cat 1>&2 << EOF
No-deploy flag (-b) and remote build flag (-r) are mutually exclusive.
EOF
  exit 1
fi

tmpdir=$(ssh ${build_user}@${build_server} mktemp -d)

if [[ $deploy = 1 ]]
then
  printf "\033[0;35mDEPLOYING TO \033[1;32m%s\033[0;35m (building as \033[1;36m%s\033[0;35m@\033[1;36m%s\033[0;35m)...\033[0m\n\n" "$env" "$build_user" "$build_server"
else
  printf "\033[0;35mBUILDING \033[1;32m%s\033[0;35m WITHOUT DEPLOY...\033[0m\n\n" "$env"
fi

sleep 1

version=$(echo -n $(git describe --tags) | tr -sc '[a-zA-Z0-9_.\-]' '-')
imagename="damast:$version-$(echo $env | tr '[:upper:]' '[:lower:]')"
filename="$imagename.tgz"

if [[ $remake = 1 ]]
then
  printf "\033[0;36mCleaning previous build artifacts\033[0m\n\n"
  make clean

  printf "\n\033[0;36mStarting clean minimized build\033[0m\n\n"
  make prod
else
  make CHANGELOG LICENSE
fi

printf "\n\033[0;36mSyncing assets for docker image\033[0m\n\n"

fs_hash=$(find dhimmis -type f \
  | xargs sha1sum \
  | awk '{print $1}' \
  | sha1sum - \
  | awk '{print $1}')
cat util/docker/{base,prod}.in \
  | sed "s/@REBUILD_HASH@/$fs_hash/g" \
  | ssh ${build_user}@${build_server} "cat > $tmpdir/Dockerfile"
rsync --info=flist2,misc0,stats0 -iavzz \
  dhimmis \
  ${build_user}@${build_server}:$tmpdir/



printf "\n\033[0;36mBuilding docker image for \033[1;35m%s\033[0;36m on \033[1;36m%s\033[0;35m@\033[1;36m%s\033[0;35m\033[0m\n\n" "$version" "$build_user" "$build_server"

pass ssh/${build_server}/${build_user} \
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


if [[ $deploy = 1 ]]
then

  if [[ $remote_build = 0 ]]
  then
    printf "\n\033[0;36mExporting docker image for \033[1;35m%s\033[0;36m\033[0m\n\n" "$version"

    pass ssh/$(hostname)/$(whoami) \
     | sudo --stdin --prompt='Reading sudo password for %u@%H from stdin...' \
         docker save $imagename \
     | gzip \
     > $tmpdir/$filename

    printf "\n\033[0;36mCopying docker file \033[1;35m%s\033[0;36m to \033[1;35m%s\033[0;36m...\033[0m\n\n" "$filename" "${deploy_user}@${deploy_server}:/tmp"
    scp $tmpdir/$filename "${deploy_user}@${deploy_server}:/tmp"
  fi


  # run_server.sh
  sed "s/!!SYSTEMD_SERVICE_NAME!!/$service/" util/run_server.sh.in \
    | sed "s/!!DOCKER_IMAGE_NAME!!/$imagename/" \
    | ssh ${build_user}@${build_server} "cat > $tmpdir/run_server.sh"
  ssh ${build_user}@${build_server} "chmod +x $tmpdir/run_server.sh"


  printf "\n\033[0;36mSyncing utilities\033[0m\n\n"
  if [[ $remote_build = 1 ]]
  then
    rsync --info=flist2,misc0,stats0 -ivzz \
      util/logstat.awk \
      util/sqlite3-user-file/user_management.py \
      util/list_reports.py \
      "${deploy_user}@${deploy_server}:$basedir"

    ssh ${deploy_user}@${deploy_server} "cp -v $tmpdir/run_server.sh $basedir"
  else
    rsync --info=flist2,misc0,stats0 -ivzz \
      util/logstat.awk \
      util/sqlite3-user-file/user_management.py \
      util/list_reports.py \
      $tmpdir/run_server.sh \
      "${deploy_user}@${deploy_server}:$basedir"
  fi


  printf "\n\033[0;36mScheduling atjob for \033[1;35m%s\033[0;36m\033[0m\n\n" "$delay"
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
    cat >$jobfile <<- EOF
		systemctl stop $service
		docker load < /tmp/$filename && rm /tmp/$filename
		systemctl start $service
    echo Restarted systemd service $service with image $imagename.
		EOF
  fi

  scp $jobfile ${deploy_user}@${deploy_server}:/tmp
  echo $(pass ssh/${deploy_server}/${deploy_user}) \
    | ssh ${deploy_user}@${deploy_server} "sudo --stdin --prompt='Reading sudo password for %u@%H from stdin...' at -m -f /tmp/$jobfile_base $delay"
fi

printf "\n\033[0;36mCleaning up\033[0m\n\n"

if [[ $deploy = 1 ]]
then
  rm $jobfile
  ssh ${deploy_user}@${deploy_server} rm /tmp/$jobfile_base
fi

ssh ${build_user}@${build_server} "rm -r $tmpdir"

printf "\n\n\033[0;35mFINISHED DEPLOYING TO \033[1;32m%s\033[0;35m...\033[0m\n\n" "$env"
