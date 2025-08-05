#!/bin/bash

# Initialize Zeal Database

echo "🔧 Initializing Zeal database..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please create a .env.local file with your database configuration"
    exit 1
fi

# Source the environment variables
set -a
source .env.local
set +a

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env.local"
    echo "Please add DATABASE_URL to your .env.local file"
    exit 1
fi

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')

echo "📍 Database: $DB_NAME on $DB_HOST"

# Run the init.sql script
echo "🚀 Running init.sql..."
psql "$DATABASE_URL" -f init.sql

if [ $? -eq 0 ]; then
    echo "✅ Database initialized successfully!"
else
    echo "❌ Error initializing database"
    exit 1
fi