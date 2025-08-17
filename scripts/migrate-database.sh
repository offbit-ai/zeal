#!/bin/bash

# Database Migration Script for Zeal
# This script helps migrate existing databases to include new features

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Zeal Database Migration Script${NC}"
echo -e "${BLUE}=================================${NC}"
echo

# Function to prompt for confirmation
confirm() {
    local prompt=$1
    echo -e "${YELLOW}$prompt${NC} (y/N): "
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to check if .env.local exists
check_env_file() {
    if [ ! -f .env.local ]; then
        echo -e "${RED}❌ Error: .env.local file not found${NC}"
        echo "Please create a .env.local file with your database configuration"
        echo "You can use start-dev.sh or copy from .env.local.example"
        exit 1
    fi
}

# Function to source environment variables
load_env() {
    echo -e "${BLUE}📋 Loading environment variables...${NC}"
    set -a
    source .env.local
    set +a
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ Error: DATABASE_URL not found in .env.local${NC}"
        echo "Please add DATABASE_URL to your .env.local file"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment loaded${NC}"
}

# Function to test database connection
test_connection() {
    echo -e "${BLUE}🔌 Testing database connection...${NC}"
    
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Failed to connect to database${NC}"
        echo "Please check your DATABASE_URL and ensure the database is running"
        exit 1
    fi
}

# Function to backup database
backup_database() {
    if confirm "Would you like to create a backup before migration?"; then
        echo -e "${BLUE}💾 Creating database backup...${NC}"
        
        # Extract database name for backup filename
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
        
        if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
            echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
        else
            echo -e "${RED}❌ Backup failed${NC}"
            if ! confirm "Continue without backup?"; then
                exit 1
            fi
        fi
    fi
}

# Function to check what migrations are needed
check_migrations_needed() {
    echo -e "${BLUE}🔍 Checking what migrations are needed...${NC}"
    
    local migrations_needed=()
    
    # Check for node template repository tables
    if ! psql "$DATABASE_URL" -c "SELECT 1 FROM node_templates LIMIT 1;" > /dev/null 2>&1; then
        migrations_needed+=("Node Template Repository")
    fi
    
    # Check for embed API tables
    if ! psql "$DATABASE_URL" -c "SELECT 1 FROM embed_api_keys LIMIT 1;" > /dev/null 2>&1; then
        migrations_needed+=("Embed API")
    fi
    
    # Check for pgvector extension
    if ! psql "$DATABASE_URL" -c "SELECT 1 FROM pg_extension WHERE extname = 'vector';" | grep -q "1"; then
        migrations_needed+=("Vector Extension (optional)")
    fi
    
    if [ ${#migrations_needed[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ Database is up to date - no migrations needed${NC}"
        return 1
    else
        echo -e "${YELLOW}📋 Migrations needed:${NC}"
        for migration in "${migrations_needed[@]}"; do
            echo -e "   • $migration"
        done
        echo
        return 0
    fi
}

# Function to apply migrations
apply_migrations() {
    echo -e "${BLUE}🚀 Applying database migrations...${NC}"
    
    # Determine which init file to use
    local init_file
    if [ -f "supabase-init.sql" ]; then
        init_file="supabase-init.sql"
        echo -e "${BLUE}Using Supabase-compatible schema: $init_file${NC}"
    elif [ -f "init.sql" ]; then
        init_file="init.sql"
        echo -e "${BLUE}Using standard schema: $init_file${NC}"
    else
        echo -e "${RED}❌ No initialization file found (init.sql or supabase-init.sql)${NC}"
        exit 1
    fi
    
    # Apply the migrations
    if psql "$DATABASE_URL" -f "$init_file"; then
        echo -e "${GREEN}✅ Migrations applied successfully${NC}"
    else
        echo -e "${RED}❌ Migration failed${NC}"
        echo "Please check the error messages above and fix any issues"
        exit 1
    fi
}

# Function to verify migrations
verify_migrations() {
    echo -e "${BLUE}🔍 Verifying migrations...${NC}"
    
    local tables=("workflows" "workflow_versions" "node_templates" "template_repository" "embed_api_keys")
    local missing_tables=()
    
    for table in "${tables[@]}"; do
        if ! psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
            missing_tables+=("$table")
        fi
    done
    
    if [ ${#missing_tables[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All expected tables are present${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tables are missing:${NC}"
        for table in "${missing_tables[@]}"; do
            echo -e "   • $table"
        done
    fi
    
    # Check extensions
    local extensions=("uuid-ossp")
    echo -e "${BLUE}📦 Checking extensions...${NC}"
    for ext in "${extensions[@]}"; do
        if psql "$DATABASE_URL" -c "SELECT 1 FROM pg_extension WHERE extname = '$ext';" | grep -q "1"; then
            echo -e "${GREEN}✅ Extension $ext is installed${NC}"
        else
            echo -e "${YELLOW}⚠️  Extension $ext is not installed${NC}"
        fi
    done
    
    # Check vector extension separately (optional)
    if psql "$DATABASE_URL" -c "SELECT 1 FROM pg_extension WHERE extname = 'vector';" | grep -q "1"; then
        echo -e "${GREEN}✅ Vector extension is installed (semantic search enabled)${NC}"
    else
        echo -e "${YELLOW}ℹ️  Vector extension not installed (semantic search will use fallback)${NC}"
    fi
}

# Function to show post-migration instructions
show_instructions() {
    echo
    echo -e "${GREEN}🎉 Migration completed successfully!${NC}"
    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Update your environment variables if needed"
    echo "2. Restart your application services"
    echo "3. Test the new features:"
    echo "   • Node Template Repository"
    echo "   • Embed API functionality"
    echo
    echo -e "${BLUE}Environment variables to check in .env.local:${NC}"
    echo "   USE_TEMPLATE_REPOSITORY=true"
    echo "   AUTO_INGEST_TEMPLATES=true"
    echo "   EMBEDDING_VENDOR=mock"
    echo "   NEXT_PUBLIC_EMBED_ENABLED=true"
    echo
}

# Main migration flow
main() {
    echo -e "${BLUE}This script will upgrade your Zeal database with the latest schema changes.${NC}"
    echo
    
    # Check prerequisites
    check_env_file
    load_env
    test_connection
    
    # Check if migrations are needed
    if ! check_migrations_needed; then
        echo -e "${GREEN}✅ No migrations needed. Database is up to date.${NC}"
        exit 0
    fi
    
    # Confirm migration
    if ! confirm "Proceed with database migration?"; then
        echo "Migration cancelled."
        exit 0
    fi
    
    # Perform migration
    backup_database
    apply_migrations
    verify_migrations
    show_instructions
}

# Handle command line arguments
case "${1:-migrate}" in
    "migrate"|"")
        main
        ;;
    "check")
        check_env_file
        load_env
        test_connection
        check_migrations_needed
        ;;
    "verify")
        check_env_file
        load_env
        test_connection
        verify_migrations
        ;;
    "--help"|"-h")
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  migrate (default) - Run full migration process"
        echo "  check            - Check what migrations are needed"
        echo "  verify           - Verify current database state"
        echo "  --help           - Show this help message"
        echo
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 --help' for usage information"
        exit 1
        ;;
esac