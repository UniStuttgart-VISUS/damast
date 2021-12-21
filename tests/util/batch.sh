#!/bin/bash

set -uo pipefail

testfiles=$(find tests -name 'test*.py')
mkdir -p testlogs

for tf in $testfiles;
do
  logname="testlogs/$(echo -n $tf | tr -c 'a-zA-Z0-9' '_').log"
  if [[ ! -f $logname ]]
  then
    (
      echo "Testing $tf"
      echo
      source env/bin/activate
      python -m pytest -rf -n6 $tf | tee $logname

      if [[ $? = 0 ]]
      then
        echo "$tf did not produce error, clearing log file."
        rm $logname
      fi
    )
  fi
done

