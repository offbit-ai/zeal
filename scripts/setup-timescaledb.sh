#!/bin/bash

# Setup script for TimescaleDB flow traces database
# This script creates the database and runs the schema initialization

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default values if not set
TIMESCALE_HOST=${TIMESCALE_HOST:-localhost}
TIMESCALE_PORT=${TIMESCALE_PORT:-5432}
TIMESCALE_DATABASE=${TIMESCALE_DATABASE:-zeal_traces}
TIMESCALE_USER=${TIMESCALE_USER:-postgres}
TIMESCALE_PASSWORD=${TIMESCALE_PASSWORD:-postgres}

echo "🕐 Setting up TimescaleDB for flow traces..."
echo "   Host: $TIMESCALE_HOST:$TIMESCALE_PORT"
echo "   Database: $TIMESCALE_DATABASE"

# Create database if it doesn't exist
echo "📦 Creating database if it doesn't exist..."
PGPASSWORD=$TIMESCALE_PASSWORD psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -c "CREATE DATABASE $TIMESCALE_DATABASE;" 2>/dev/null || echo "Database already exists"

# Run the TimescaleDB schema
echo "🗄️  Initializing TimescaleDB schema..."
PGPASSWORD=$TIMESCALE_PASSWORD psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -d $TIMESCALE_DATABASE -f timescaledb-init.sql

# Verify TimescaleDB extension
echo "✅ Verifying TimescaleDB installation..."
PGPASSWORD=$TIMESCALE_PASSWORD psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -d $TIMESCALE_DATABASE -c "SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'timescaledb';"

# Show hypertables
echo "📊 Hypertables created:"
PGPASSWORD=$TIMESCALE_PASSWORD psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -d $TIMESCALE_DATABASE -c "SELECT hypertable_name, num_chunks FROM timescaledb_information.hypertables;"

# Show retention policies
echo "🗑️  Retention policies:"
PGPASSWORD=$TIMESCALE_PASSWORD psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -d $TIMESCALE_DATABASE -c "SELECT hypertable_name, drop_after FROM timescaledb_information.retention_policies;"

# Show continuous aggregates
echo "📈 Continuous aggregates:"
PGPASSWORD=$TIMESCALE_PASSWORD psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -d $TIMESCALE_DATABASE -c "SELECT view_name FROM timescaledb_information.continuous_aggregates;"

echo "✨ TimescaleDB setup complete!"
echo ""
echo "🔧 To connect to TimescaleDB:"
echo "   psql -h $TIMESCALE_HOST -p $TIMESCALE_PORT -U $TIMESCALE_USER -d $TIMESCALE_DATABASE"
echo ""
echo "📝 Make sure to update your .env file with TimescaleDB settings:"
echo "   cp .env.timescaledb.example .env.timescaledb"
echo "   # Edit .env.timescaledb with your settings"