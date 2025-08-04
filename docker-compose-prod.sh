#!/bin/bash
# Load .env.local and run docker-compose with production overrides

set -a # automatically export all variables
[ -f .env.local ] && source .env.local
set +a # stop automatically exporting

# Use the base docker-compose.yml with the prod override
docker-compose -f docker-compose.yml -f docker-compose.prod.yml "$@"