#!/usr/bin/env bash

set -euo pipefail

damast_version="${1:-1.3.2}"

echo "Building Damast image (version $damast_version)"
echo

echo "Clean-building source files"
(
  cd ../..
  make clean
  make prod
)

echo "Copying in tile download script"
cp ../shaded-relief-map-tiles/download_and_extract.sh.gz download-and-extract-tiles.sh.gz

echo "Copying in Damast files"
cp -r ../../damast .

echo "Building image"
sudo docker build -t "damast-standalone:$damast_version" .
