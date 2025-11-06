#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting integration tests with MariaDB...${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$BACKEND_DIR"

# Function to cleanup on exit
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  # Kill the backend server if it's running
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
  fi
  # Stop containers and remove volumes, but don't fail on network errors
  docker-compose -f docker-compose.test.yml down -v 2>&1 | grep -v "Resource is still in use" || true
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Stop any existing test containers
echo -e "${YELLOW}Stopping any existing test containers...${NC}"
docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true

# Start MariaDB container
echo -e "${GREEN}Starting MariaDB container...${NC}"
docker-compose -f docker-compose.test.yml up -d

# Wait for MariaDB to be ready
echo -e "${YELLOW}Waiting for MariaDB to be ready...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if docker-compose -f docker-compose.test.yml exec -T db-test mysqladmin ping -h localhost -u mempool_test -pmempool_test --silent 2>/dev/null; then
    echo -e "${GREEN}MariaDB is ready!${NC}"
    break
  fi
  attempt=$((attempt + 1))
  echo -e "${YELLOW}Attempt $attempt/$max_attempts - waiting for MariaDB...${NC}"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo -e "${RED}MariaDB did not start in time${NC}"
  exit 1
fi

# Additional wait to ensure MariaDB is fully initialized
sleep 3

# Build the backend
echo -e "${GREEN}Building backend...${NC}"
npm run build

# Run integration tests with absolute path to config
echo -e "${GREEN}Running integration tests...${NC}"
MEMPOOL_CONFIG_FILE="$BACKEND_DIR/mempool-config.test.json" npm run test:integration

# Start the backend server in the background
echo -e "${GREEN}Starting backend server...${NC}"
MEMPOOL_CONFIG_FILE="$BACKEND_DIR/mempool-config.test.json" node dist/index.js &
SERVER_PID=$!

# Wait for server to start and verify connection
echo -e "${YELLOW}Waiting for server to start and connect to database...${NC}"
sleep 10

# Check if server is still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
  echo -e "${GREEN}Server started successfully and connected to database!${NC}"
  
  # Kill the server (it will be in the cleanup function too, but do it here as well)
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  SERVER_PID=""
else
  echo -e "${RED}Server failed to start or exited prematurely${NC}"
  exit 1
fi

echo -e "${GREEN}All tests passed successfully!${NC}"

