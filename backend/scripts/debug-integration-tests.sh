#!/bin/bash

# Script to debug integration tests
# Usage: ./scripts/debug-integration-tests.sh [test-file-pattern]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$BACKEND_DIR"

# Check if MariaDB is running
if ! docker-compose -f docker-compose.test.yml ps | grep -q "Up"; then
    echo -e "${YELLOW}Starting MariaDB container...${NC}"
    docker-compose -f docker-compose.test.yml up -d
    
    # Wait for MariaDB
    echo -e "${YELLOW}Waiting for MariaDB...${NC}"
    sleep 5
fi

# Run tests with pattern if provided
if [ -n "$1" ]; then
    echo -e "${GREEN}Running tests matching: $1${NC}"
    MEMPOOL_CONFIG_FILE="$BACKEND_DIR/mempool-config.test.json" npx jest --config=jest.integration.config.ts --runInBand --verbose "$1"
else
    echo -e "${GREEN}Running all integration tests${NC}"
    MEMPOOL_CONFIG_FILE="$BACKEND_DIR/mempool-config.test.json" npm run test:integration
fi

echo -e "${GREEN}Tests completed${NC}"

