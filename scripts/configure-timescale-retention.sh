#!/bin/bash

# Script to configure TimescaleDB retention policies with environment variables
# Usage: ./configure-timescale-retention.sh

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TimescaleDB Retention Policy Configuration ===${NC}"

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

if [ -f .env.timescaledb ]; then
    export $(cat .env.timescaledb | grep -v '^#' | xargs)
fi

# Set default retention periods if not specified
: ${TIMESCALE_RETENTION_FLOW_TRACES:="30 days"}
: ${TIMESCALE_RETENTION_TRACE_EVENTS:="7 days"}
: ${TIMESCALE_RETENTION_SESSIONS:="90 days"}

# TimescaleDB connection parameters
: ${TIMESCALE_HOST:="localhost"}
: ${TIMESCALE_PORT:="5433"}
: ${TIMESCALE_DATABASE:="zeal_traces"}
: ${TIMESCALE_USER:="zeal_user"}
: ${TIMESCALE_PASSWORD:="zeal_password"}

echo -e "${YELLOW}Retention Policy Settings:${NC}"
echo "  Flow Traces:     ${TIMESCALE_RETENTION_FLOW_TRACES}"
echo "  Trace Events:    ${TIMESCALE_RETENTION_TRACE_EVENTS}"
echo "  Sessions:        ${TIMESCALE_RETENTION_SESSIONS}"
echo ""

# Check if template file exists
if [ ! -f "timescaledb-retention.sql.template" ]; then
    echo -e "${RED}Error: timescaledb-retention.sql.template not found${NC}"
    exit 1
fi

# Process the template and create the SQL file
echo -e "${YELLOW}Processing retention policy template...${NC}"
sed -e "s/\${TIMESCALE_RETENTION_FLOW_TRACES}/$TIMESCALE_RETENTION_FLOW_TRACES/g" \
    -e "s/\${TIMESCALE_RETENTION_TRACE_EVENTS}/$TIMESCALE_RETENTION_TRACE_EVENTS/g" \
    -e "s/\${TIMESCALE_RETENTION_SESSIONS}/$TIMESCALE_RETENTION_SESSIONS/g" \
    timescaledb-retention.sql.template > /tmp/timescale-retention-configured.sql

# Apply the retention policies
echo -e "${YELLOW}Applying retention policies to TimescaleDB...${NC}"
PGPASSWORD=$TIMESCALE_PASSWORD psql \
    -h $TIMESCALE_HOST \
    -p $TIMESCALE_PORT \
    -U $TIMESCALE_USER \
    -d $TIMESCALE_DATABASE \
    -f /tmp/timescale-retention-configured.sql \
    -q

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Retention policies successfully configured${NC}"
    echo ""
    echo -e "${GREEN}Current retention policies:${NC}"
    
    # Show current policies
    PGPASSWORD=$TIMESCALE_PASSWORD psql \
        -h $TIMESCALE_HOST \
        -p $TIMESCALE_PORT \
        -U $TIMESCALE_USER \
        -d $TIMESCALE_DATABASE \
        -c "SELECT hypertable_name, config::json->>'drop_after' as retention_period FROM timescaledb_information.jobs WHERE proc_name = 'policy_retention' ORDER BY hypertable_name;" \
        -t
else
    echo -e "${RED}❌ Failed to configure retention policies${NC}"
    exit 1
fi

# Clean up temporary file
rm -f /tmp/timescale-retention-configured.sql

echo -e "${GREEN}=== Retention policy configuration complete ===${NC}"