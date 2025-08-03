#!/bin/bash
# Load .env.local and run docker-compose with those variables

set -a # automatically export all variables
source .env.local
set +a # stop automatically exporting

docker-compose "$@"