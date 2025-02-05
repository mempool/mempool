#!/bin/bash
# hotfix-launch.sh
# This script fixes the erroneous NODE_OPTIONS configuration and launches the Node.js application

echo "Starting hotfix: Removing '<node_internals>' references from NODE_OPTIONS..."

# Remove any occurrences of '<node_internals>' in the NODE_OPTIONS environment variable
if [[ -n "$NODE_OPTIONS" ]]; then
  export NODE_OPTIONS=$(echo "$NODE_OPTIONS" | sed 's/<node_internals>//g')
  echo "NODE_OPTIONS fixed: $NODE_OPTIONS"
else
  echo "NODE_OPTIONS is not set; no fix needed."
fi

# Launch the application using the correct entry point (adjust if necessary)
echo "Launching application..."
node index.js
