# Development Environment Setup

This guide helps you set up a local development environment for the Zeal workflow application.

## Prerequisites

- Node.js 18+ and npm
- Docker Desktop installed and running
- Git

## Quick Start

### Option 1: Using the Bash Script (Recommended)

1. Make the scripts executable:

```bash
chmod +x start-dev.sh stop-dev.sh
```

2. Start the development environment:

```bash
./start-dev.sh
```

This script will:

- ✅ Check if Docker is running
- 🌐 Create a Docker network for inter-container communication
- 🐘 Start PostgreSQL in a Docker container
- 🔴 Start Redis in a Docker container
- 📝 Create `.env.local` with database and Redis configuration
- 📦 Install npm dependencies (if needed)
- 🔄 Check for database setup (custom migrations if configured)
- 🔥 Start Next.js development server with HMR

3. Access the application at: `http://localhost:3000`

4. To stop the environment:

```bash
./stop-dev.sh
```

### Option 2: Using Docker Compose

1. Start services:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. Create `.env.local`:

```bash
cp .env.local.example .env.local
```

3. Run any custom database setup (if needed):

```bash
# Add your database initialization commands here
# For example: psql commands, SQL scripts, etc.
```

4. Start Next.js:

```bash
npm run dev
```

5. Stop services:

```bash
docker-compose -f docker-compose.dev.yml down
```

## Service Access

### PostgreSQL Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: zeal_db
- **Username**: zeal_user
- **Password**: zeal_password
- **URL**: `postgresql://zeal_user:zeal_password@localhost:5432/zeal_db?schema=public`

### Redis Connection Details

- **Host**: localhost
- **Port**: 6379
- **Password**: redispass123
- **URL**: `redis://:redispass123@localhost:6379`

### GUI Access (if using docker-compose)

- Adminer: `http://localhost:8090`
  - System: PostgreSQL
  - Server: postgres
  - Username: zeal_user
  - Password: zeal_password
  - Database: zeal_db

## Environment Variables

The `.env.local` file is created automatically with:

```env
DATABASE_URL="postgresql://zeal_user:zeal_password@localhost:5432/zeal_db?schema=public"
REDIS_URL="redis://:redispass123@localhost:6379"
REDIS_PASSWORD="redispass123"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_RUST_CRDT_URL="ws://localhost:8080"
```

## Troubleshooting

### Port Already in Use

If port 5432 is already in use:

```bash
# Find process using port
lsof -i :5432

# Or change the port in the script/docker-compose
```

### Docker Not Running

Make sure Docker Desktop is running before starting the scripts.

### Database Connection Failed

1. Check if container is running:

```bash
docker ps
```

2. Check container logs:

```bash
docker logs zeal-postgres
```

### Clean Start

To completely reset all services:

```bash
docker stop zeal-postgres zeal-redis
docker rm zeal-postgres zeal-redis
docker volume rm zeal-postgres-data zeal-redis-data
```

## Development Workflow

1. **Start the environment**: `./start-dev.sh`
2. **Make code changes** - Next.js HMR will auto-reload
3. **Database changes**:
   - Modify database schema in `init.sql`
   - Apply changes manually to your database
4. **Stop when done**: `./stop-dev.sh` or `Ctrl+C`

## Additional Commands

```bash
# View database logs
docker logs -f zeal-postgres

# View Redis logs
docker logs -f zeal-redis

# Access PostgreSQL CLI
docker exec -it zeal-postgres psql -U zeal_user -d zeal_db

# Access Redis CLI
docker exec -it zeal-redis redis-cli -a redispass123

# Run custom SQL scripts
docker exec -i zeal-postgres psql -U zeal_user -d zeal_db < scripts/init.sql

# Backup database
docker exec zeal-postgres pg_dump -U zeal_user zeal_db > backup.sql
```

## Data Persistence

Data is stored in Docker volumes that persist between container restarts:

- PostgreSQL: `zeal-postgres-data`
- Redis: `zeal-redis-data`

To remove all data:

```bash
docker volume rm zeal-postgres-data zeal-redis-data
```
