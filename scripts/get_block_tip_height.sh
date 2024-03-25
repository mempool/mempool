BASE_HEIGHT=$(curl -sk https://node202.tk7.mempool.space/api/v1/blocks/tip/height)
IN_SYNC=true
echo "Base height (node202.tk7): $BASE_HEIGHT"

for LOCATION in fmt va1 fra tk7
do
  for NODE in 201 202 203 204 205 206
  do
    NODE_HEIGHT=$(curl -sk https://node$NODE.$LOCATION.mempool.space/api/v1/blocks/tip/height)
    echo $(echo node$NODE.$LOCATION.mempool.space) - $NODE_HEIGHT
    if [ "$NODE_HEIGHT" -ne "$BASE_HEIGHT" ]; then
      COUNT=$((BASE_HEIGHT-NODE_HEIGHT))
      echo $(echo node$NODE.$LOCATION.mempool.space) is not in sync. delta: $COUNT
      IN_SYNC=false
    fi
  done
done

if [ "$IN_SYNC" = false ]; then
  echo "One or more servers are out of sync. Check the logs."
  exit -1
else
  echo "All servers are in sync."
fi

