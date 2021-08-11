#!/bin/sh

VERSION=$1
IMAGE=""

if [ -z "${VERSION}" ]; then
    echo "no version provided (i.e, v2.2.0), using latest tag"
    VERSION="latest"
fi

for package in backend frontend; do
  PACKAGE=mempool/"$package"
  IMAGE="$PACKAGE":"$VERSION"
  HASH=`docker pull $IMAGE > /dev/null && docker inspect $IMAGE | sed -n '/RepoDigests/{n;p;}' | grep -o '[0-9a-f]\{64\}'`
  if [ -n "${HASH}" ]; then
    echo "$IMAGE" "$HASH"
  fi
done 
