#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_CONTAINER="zeal-postgres"
REDIS_CONTAINER="zeal-redis"
CRDT_CONTAINER="zeal-crdt-server"

echo -e "${BLUE}🛑 Stopping Zeal Development Environment${NC}"
echo ""

# Stop PostgreSQL container
if [ "$(docker ps -q -f name=^${POSTGRES_CONTAINER}$)" ]; then
    echo -e "${YELLOW}🐘 Stopping PostgreSQL server...${NC}"
    docker stop $POSTGRES_CONTAINER > /dev/null
    echo -e "${GREEN}✅ PostgreSQL stopped${NC}"
else
    echo -e "${YELLOW}ℹ️  PostgreSQL container is not running${NC}"
fi

# Stop Redis container
if [ "$(docker ps -q -f name=^${REDIS_CONTAINER}$)" ]; then
    echo -e "${YELLOW}🔴 Stopping Redis server...${NC}"
    docker stop $REDIS_CONTAINER > /dev/null
    echo -e "${GREEN}✅ Redis stopped${NC}"
else
    echo -e "${YELLOW}ℹ️  Redis container is not running${NC}"
fi

# Stop CRDT server container
if [ "$(docker ps -q -f name=^${CRDT_CONTAINER}$)" ]; then
    echo -e "${YELLOW}🦀 Stopping CRDT server...${NC}"
    docker stop $CRDT_CONTAINER > /dev/null
    echo -e "${GREEN}✅ CRDT server stopped${NC}"
else
    echo -e "${YELLOW}ℹ️  CRDT server container is not running${NC}"
fi

# Ask if user wants to remove the containers
echo ""
read -p "Do you want to remove the containers? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker rm $POSTGRES_CONTAINER > /dev/null 2>&1
    docker rm $REDIS_CONTAINER > /dev/null 2>&1
    docker rm $CRDT_CONTAINER > /dev/null 2>&1
    echo -e "${GREEN}✅ Containers removed${NC}"
fi

# Ask if user wants to remove the data volumes
echo ""
read -p "Do you want to remove the data volumes? This will delete all data! (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker volume rm zeal-postgres-data > /dev/null 2>&1
    docker volume rm zeal-redis-data > /dev/null 2>&1
    echo -e "${GREEN}✅ Data volumes removed${NC}"
else
    echo -e "${BLUE}💾 Data preserved in Docker volumes${NC}"
fi

echo ""
echo -e "${GREEN}✅ Development environment stopped${NC}"