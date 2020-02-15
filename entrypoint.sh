#!/bin/bash
## Start SQL
mysqld_safe&
sleep 5
## http server:
nginx

## Set up some files:
cd /mempool.space/backend 
rm -f cache.json
touch cache.json

## Build mempool-config.json file ourseleves.
## We used to use jq for this but that produced output which caused bugs,
## specifically numbers were surrounded by quotes, which breaks things.
## Old command was jq -n env > mempool-config.json
## This way is more complex, but more compatible with the backend functions.

## Define a function to allow us to easily get indexes of the = string in from the env output:
strindex() { 
  x="${1%%$2*}"
  [[ "$x" = "$1" ]] && echo -1 || echo "${#x}"
}
## Regex to check if we have a number or not:
NumberRegEx='^[0-9]+$'
## Delete the old file, and start a new one:
rm -f mempool-config.json
echo "{" >> mempool-config.json
## For each env we add into the mempool-config.json file in one of two ways.
## Either:
## "Variable": "Value",
## if a string, or
## "Variable": Value,
## if a integer
for e in `env`; do
    if [[ ${e:`strindex "$e" "="`+1} =~ $NumberRegEx ]] ; then
        ## Integer add:
        echo "\""${e:0:`strindex "$e" "="`}"\": "${e:`strindex "$e" "="`+1}","  >> mempool-config.json
    else
        ## String add:
        echo "\""${e:0:`strindex "$e" "="`}"\": \""${e:`strindex "$e" "="`+1}$"\","  >> mempool-config.json
    fi
done
## Take out the trailing , from the last entry.
## This means replacing the file with one that is missing the last character
echo `sed '$ s/.$//' mempool-config.json` > mempool-config.json
## And finally finish off:
echo "}" >> mempool-config.json

## Start mempoolspace:
node dist/index.js
