#!/usr/bin/env zsh

# Infinite loop
while true; do
  # Run the command with all passed arguments
  echo "Starting lightningd with arguments: $@"
  lightningd "$@"

  # Check the exit code of the command
  exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo "lightningd crashed with exit code $exit_code. Restarting..."
  else
    echo "lightningd exited cleanly. Restarting..."
  fi

  # Wait a bit before restarting to avoid rapid loops
  sleep 30
done
