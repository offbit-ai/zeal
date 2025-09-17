#!/bin/bash

# Zeal Railway Deployment Script
# This script deploys all services to Railway using railway.json configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Function to print colored output
log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Check Railway CLI is installed
check_railway() {
    if ! command -v railway &> /dev/null; then
        log $RED "❌ Railway CLI not found. Please install it first:"
        log $YELLOW "   brew install railway (macOS)"
        log $YELLOW "   curl -fsSL https://railway.app/install.sh | sh (Linux)"
        exit 1
    fi
    log $GREEN "✅ Railway CLI found"
}

# Login to Railway
login_railway() {
    log $BLUE "🔐 Checking Railway login..."
    if ! railway whoami &> /dev/null; then
        log $YELLOW "Please login to Railway:"
        railway login
    else
        log $GREEN "✅ Already logged into Railway"
    fi
}

# Initialize or link Railway project
init_project() {
    log $BLUE "📦 Initializing Railway project..."
    
    # Check if already linked
    if railway status &> /dev/null 2>&1; then
        log $YELLOW "⚠️  Project already linked"
        railway status
    else
        read -p "Enter project name (default: zeal-production): " PROJECT_NAME
        PROJECT_NAME="${PROJECT_NAME:-zeal-production}"
        
        log $CYAN "Initializing new Railway project: $PROJECT_NAME"
        railway init --name "$PROJECT_NAME"
    fi
    
    log $GREEN "✅ Railway project initialized"
}

# Provision databases and services first
provision_infrastructure() {
    log $BLUE "🏗️ Provisioning infrastructure services..."
    
    # Check if railway.json exists
    if [ ! -f "$SCRIPT_DIR/railway.json" ]; then
        log $RED "❌ railway.json not found at $SCRIPT_DIR/railway.json"
        exit 1
    fi
    
    log $CYAN "Creating databases and services from railway.json..."
    
    # Note: Railway will automatically provision databases when deploying with railway.json
    # But we need to ensure they exist before setting up environment variables
    
    log $YELLOW "Railway will provision the following services:"
    log $CYAN "  • PostgreSQL with pgvector"
    log $CYAN "  • TimescaleDB (PostgreSQL instance)"
    log $CYAN "  • Redis"
    log $CYAN "  • Web application"
    log $CYAN "  • CRDT server"
    
    log $GREEN "✅ Infrastructure provisioning configured"
}

# Set build-time environment variables BEFORE deployment
set_build_environment() {
    log $BLUE "🔧 Setting build-time environment variables..."
    
    # These are needed for Next.js build process
    # Railway will use these during docker build
    
    # Get Railway domain if available
    RAILWAY_DOMAIN=$(railway vars get RAILWAY_PUBLIC_DOMAIN 2>/dev/null || echo "")
    
    if [ -z "$RAILWAY_DOMAIN" ]; then
        log $YELLOW "⚠️  RAILWAY_PUBLIC_DOMAIN not yet available"
        log $CYAN "Using placeholder values for initial build"
        RAILWAY_DOMAIN="app.railway.app"
    fi
    
    # Set essential build-time variables
    log $CYAN "Setting build-time environment variables..."
    railway vars set \
        NODE_ENV=production \
        NEXT_PUBLIC_APP_URL="https://${RAILWAY_DOMAIN}" \
        NEXT_PUBLIC_API_URL="https://${RAILWAY_DOMAIN}" \
        NEXT_PUBLIC_BASE_URL="https://${RAILWAY_DOMAIN}" \
        NEXT_PUBLIC_CRDT_SERVER_URL="wss://${RAILWAY_DOMAIN}/crdt" \
        NEXT_PUBLIC_RUST_CRDT_URL="wss://${RAILWAY_DOMAIN}/crdt" \
        NEXT_PUBLIC_ENABLE_COLLABORATION=true \
        NEXT_PUBLIC_ENABLE_FLOW_TRACING=true \
        NEXT_PUBLIC_ENABLE_VERSION_HISTORY=true \
        NEXT_PUBLIC_EMBED_ENABLED=true \
        NEXT_PUBLIC_EMBED_URL="https://${RAILWAY_DOMAIN}/embed" \
        NEXT_PUBLIC_DEBUG_CRDT=false \
        NEXT_PUBLIC_VERBOSE_LOGGING=false \
        NEXT_PUBLIC_DISABLE_CONSOLE_LOGS=true
    
    # Generate secrets needed for build
    NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "temp-secret-$(date +%s)")
    ZEAL_SECRET_KEY=$(openssl rand -base64 32 2>/dev/null || echo "temp-secret-$(date +%s)")
    
    railway vars set \
        NEXTAUTH_URL="https://${RAILWAY_DOMAIN}" \
        NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        ZEAL_SECRET_KEY="${ZEAL_SECRET_KEY}" \
        JWT_SECRET="${ZEAL_SECRET_KEY}"
    
    log $GREEN "✅ Build-time environment variables set"
}

# Configure full environment after deployment
configure_environment() {
    log $BLUE "🔧 Configuring full environment..."
    
    # Check if env-config.sh exists
    if [ ! -f "$SCRIPT_DIR/env-config.sh" ]; then
        log $RED "❌ env-config.sh not found at $SCRIPT_DIR/env-config.sh"
        log $RED "This file is required for proper environment configuration."
        log $YELLOW "Please ensure deployments/railway/env-config.sh exists."
        exit 1
    fi
    
    log $CYAN "Running env-config.sh for comprehensive environment setup..."
    bash "$SCRIPT_DIR/env-config.sh"
    
    log $GREEN "✅ Full environment configuration complete"
}

# Deploy using railway.json configuration
deploy_with_config() {
    log $BLUE "🚀 Deploying services with railway.json..."
    
    # Deploy using railway up with config file
    cd "$PROJECT_ROOT"
    log $CYAN "Deploying from project root with railway.json configuration..."
    railway up --config "$SCRIPT_DIR/railway.json" --detach
    
    log $GREEN "✅ Deployment initiated"
}

# Setup database initialization
setup_databases() {
    log $BLUE "🗄️ Setting up databases..."
    
    # Wait for services to be ready
    log $CYAN "Waiting for services to be ready..."
    sleep 15
    
    # Run PostgreSQL initialization
    if [ -f "$PROJECT_ROOT/init.sql" ]; then
        log $YELLOW "Running PostgreSQL initialization..."
        
        # Get the database URL for main postgres
        DATABASE_URL=$(railway vars get DATABASE_URL --service postgres 2>/dev/null || echo "")
        
        if [ -z "$DATABASE_URL" ]; then
            log $YELLOW "⚠️  Could not get DATABASE_URL automatically"
            log $CYAN "Please run manually after deployment:"
            log $CYAN "  railway run --service postgres psql \$DATABASE_URL < init.sql"
        else
            railway run --service postgres psql "$DATABASE_URL" < "$PROJECT_ROOT/init.sql" || {
                log $YELLOW "⚠️  Database init failed - may already be initialized"
            }
        fi
    fi
    
    # Run TimescaleDB initialization
    if [ -f "$PROJECT_ROOT/timescaledb-init.sql" ]; then
        log $YELLOW "Running TimescaleDB initialization..."
        
        # For TimescaleDB service
        TIMESCALE_URL=$(railway vars get DATABASE_URL --service timescaledb 2>/dev/null || echo "")
        
        if [ -z "$TIMESCALE_URL" ]; then
            log $YELLOW "⚠️  Could not get TimescaleDB URL automatically"
            log $CYAN "Please run manually after deployment:"
            log $CYAN "  railway run --service timescaledb psql \$DATABASE_URL < timescaledb-init.sql"
        else
            railway run --service timescaledb psql "$TIMESCALE_URL" < "$PROJECT_ROOT/timescaledb-init.sql" || {
                log $YELLOW "⚠️  TimescaleDB init failed - may already be initialized"
            }
        fi
    fi
    
    log $GREEN "✅ Database setup complete"
}

# Show deployment status
show_status() {
    log $BLUE "📊 Deployment Status..."
    
    railway status
    
    log $CYAN ""
    log $CYAN "Services deployed:"
    railway service || log $YELLOW "Use 'railway service' to list services"
    
    log $CYAN ""
    log $CYAN "To view logs:"
    log $CYAN "  • Web app: railway logs --service web"
    log $CYAN "  • CRDT server: railway logs --service crdt-server"
    log $CYAN "  • All services: railway logs"
    
    log $CYAN ""
    log $CYAN "To open dashboard:"
    log $CYAN "  • railway open"
    
    # Get public domain if available
    PUBLIC_DOMAIN=$(railway vars get RAILWAY_PUBLIC_DOMAIN --service web 2>/dev/null || echo "")
    if [ -n "$PUBLIC_DOMAIN" ]; then
        log $GREEN ""
        log $GREEN "🌐 Your app should be available at: https://$PUBLIC_DOMAIN"
    fi
}

# Run post-deployment tasks
post_deployment() {
    log $BLUE "📝 Running post-deployment tasks..."
    
    # Ingest templates if configured
    AUTO_INGEST=$(railway vars get AUTO_INGEST_TEMPLATES 2>/dev/null || echo "false")
    if [ "$AUTO_INGEST" = "true" ]; then
        log $YELLOW "Ingesting node templates..."
        railway run --service web npm run templates:ingest || {
            log $YELLOW "⚠️  Template ingestion failed - run manually later"
        }
    fi
    
    log $GREEN "✅ Post-deployment tasks complete"
}

# Main deployment flow
main() {
    log $MAGENTA "
╔══════════════════════════════════════════════════════════════╗
║           🚂 Zeal Railway Deployment 🚂                      ║
╚══════════════════════════════════════════════════════════════╝"
    
    # Preliminary checks
    check_railway
    login_railway
    
    log $CYAN "This script will deploy Zeal to Railway with:"
    log $CYAN "  • Next.js web application"
    log $CYAN "  • CRDT collaboration server"
    log $CYAN "  • PostgreSQL with pgvector"
    log $CYAN "  • TimescaleDB for traces"
    log $CYAN "  • Redis for caching"
    echo
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log $YELLOW "Deployment cancelled"
        exit 0
    fi
    
    # IMPORTANT: Order of operations
    # 1. Initialize project
    init_project
    
    # 2. Provision infrastructure
    provision_infrastructure
    
    # 3. Set build-time environment variables BEFORE deployment
    set_build_environment
    
    # 4. Deploy with railway.json (this will provision databases and build apps)
    deploy_with_config
    
    # 5. Wait for initial deployment
    log $CYAN "Waiting for initial deployment to complete..."
    log $YELLOW "This may take several minutes for first deployment..."
    sleep 30
    
    # 6. Configure full environment (after services exist)
    read -p "Configure full environment now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        configure_environment
    fi
    
    # 7. Setup databases (after they're provisioned)
    read -p "Initialize databases? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        setup_databases
    fi
    
    # 8. Trigger rebuild with full environment
    log $CYAN "Triggering rebuild with full environment variables..."
    read -p "Redeploy services with complete configuration? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        railway up --config "$SCRIPT_DIR/railway.json" --detach
    fi
    
    # 9. Run post-deployment tasks
    post_deployment
    
    # 10. Show deployment status
    show_status
    
    log $GREEN "
╔══════════════════════════════════════════════════════════════╗
║                 ✅ Deployment Complete! ✅                    ║
╚══════════════════════════════════════════════════════════════╝"
    
    log $CYAN "Next steps:"
    log $CYAN "1. Monitor deployment: railway logs -f"
    log $CYAN "2. Check service health: railway open"
    log $CYAN "3. Configure custom domain (optional): railway domain"
    
    log $YELLOW ""
    log $YELLOW "⚠️  Important Security Notes:"
    log $YELLOW "• Auth is ENABLED by default"
    log $YELLOW "• Configure JWT settings for production use"
    log $YELLOW "• Update AUTH_JWT_* environment variables"
    log $YELLOW "• Review auth-policies.json for access control"
    
    log $RED ""
    log $RED "🔐 SECURITY: Ensure all auth settings are configured before exposing to internet!"
}

# Handle script arguments
case "${1:-}" in
    status)
        check_railway
        login_railway
        show_status
        ;;
    logs)
        check_railway
        login_railway
        shift
        railway logs "$@"
        ;;
    redeploy)
        check_railway
        login_railway
        deploy_with_config
        ;;
    env)
        check_railway
        login_railway
        configure_environment
        ;;
    build-env)
        check_railway
        login_railway
        set_build_environment
        ;;
    *)
        main
        ;;
esac