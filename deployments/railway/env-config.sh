#!/bin/bash

# Railway Environment Variables Reference & Configuration Script
# ==============================================================
# 
# IMPORTANT: How Railway handles environment variables:
# 
# 1. AUTOMATIC INJECTION: Railway automatically injects all environment 
#    variables into your Docker containers at runtime. You don't need 
#    .env files or to source this script in your container.
#
# 2. SERVICE VARIABLES: When you add Railway services (PostgreSQL, Redis),
#    Railway automatically provides:
#    - DATABASE_URL: Full PostgreSQL connection string
#    - REDIS_URL: Redis connection string with auth
#    - PORT: The port your app should bind to
#    - RAILWAY_PUBLIC_DOMAIN: Your app's public URL
#
# 3. SETTING VARIABLES: You can set variables in 3 ways:
#    a) Railway Dashboard: Project Settings > Variables
#    b) Railway CLI: railway variables set KEY=value
#    c) Using this script: ./env-config.sh (for bulk setup)
#
# 4. This script can be used for initial setup or documentation.
#    Your containers will receive these vars automatically.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Generate secure secrets
generate_secret() {
    openssl rand -base64 32 2>/dev/null || echo "change-in-production-$(date +%s)"
}

log $BLUE "🔧 Railway Environment Variables Setup"
log $YELLOW "This script helps configure environment variables for Railway deployment."
log $YELLOW "Note: Railway automatically injects these into your containers."
echo

# Get Railway-provided variables
RAILWAY_DOMAIN=$(railway vars get RAILWAY_PUBLIC_DOMAIN 2>/dev/null || echo "")
DATABASE_URL=$(railway vars get DATABASE_URL 2>/dev/null || echo "")
REDIS_URL=$(railway vars get REDIS_URL 2>/dev/null || echo "")

if [ -z "$RAILWAY_DOMAIN" ]; then
    log $RED "❌ Not connected to Railway project. Run 'railway link' first"
    exit 1
fi

log $GREEN "✅ Connected to Railway project"
log $CYAN "   Domain: $RAILWAY_DOMAIN"
echo

# ============================================
# CORE DATABASE CONFIGURATION
# ============================================
log $BLUE "📊 Database Configuration"

# Main PostgreSQL (Railway provides DATABASE_URL automatically)
railway vars set \
    DATABASE_URL="$DATABASE_URL" \
    USE_SUPABASE="false"

# TimescaleDB - Need manual input as it's a separate service
log $YELLOW "Enter TimescaleDB connection details from Railway dashboard:"
read -p "   TIMESCALE_HOST (e.g., timescaledb.railway.internal): " TIMESCALE_HOST
read -p "   TIMESCALE_PORT (default 5432): " TIMESCALE_PORT
read -p "   TIMESCALE_USER (default postgres): " TIMESCALE_USER
read -s -p "   TIMESCALE_PASSWORD: " TIMESCALE_PASSWORD
echo

railway vars set \
    TIMESCALE_HOST="${TIMESCALE_HOST}" \
    TIMESCALE_PORT="${TIMESCALE_PORT:-5432}" \
    TIMESCALE_DATABASE="zeal_traces" \
    TIMESCALE_USER="${TIMESCALE_USER:-postgres}" \
    TIMESCALE_PASSWORD="${TIMESCALE_PASSWORD}" \
    TIMESCALE_POOL_MIN="5" \
    TIMESCALE_POOL_MAX="20" \
    TIMESCALE_STATEMENT_TIMEOUT="30000" \
    TIMESCALE_SSL="false" \
    TIMESCALE_RETENTION_FLOW_TRACES="30 days" \
    TIMESCALE_RETENTION_TRACE_EVENTS="7 days" \
    TIMESCALE_RETENTION_SESSIONS="90 days" \
    TIMESCALE_POOL_MIN="5" \
    TIMESCALE_POOL_MAX="20" \
    TIMESCALE_STATEMENT_TIMEOUT="30000"

# ============================================
# REDIS CONFIGURATION
# ============================================
log $BLUE "🔴 Redis Configuration"

railway vars set \
    REDIS_URL="$REDIS_URL" \
    REDIS_CONNECTION_POOL_SIZE="10" \
    REDIS_MAX_RETRIES="3" \
    REDIS_RETRY_DELAY="1000"

# ============================================
# CRDT SERVER CONFIGURATION
# ============================================
log $BLUE "🦀 CRDT Server Configuration"

railway vars set \
    NEXT_PUBLIC_CRDT_SERVER_URL="wss://${RAILWAY_DOMAIN}/crdt" \
    NEXT_PUBLIC_RUST_CRDT_URL="wss://${RAILWAY_DOMAIN}/crdt" \
    CRDT_INTERNAL_URL="http://crdt-server.railway.internal:8080" \
    CRDT_MAX_CLIENTS_PER_ROOM="100" \
    CRDT_CLIENT_TIMEOUT_MINUTES="30" \
    CRDT_DISABLE_REDIS_PERSISTENCE="false"

# ============================================
# APPLICATION URLs
# ============================================
log $BLUE "🌐 Application URLs"

railway vars set \
    NODE_ENV="production" \
    NEXT_PUBLIC_APP_URL="https://${RAILWAY_DOMAIN}" \
    NEXT_PUBLIC_API_URL="https://${RAILWAY_DOMAIN}" \
    NEXT_PUBLIC_BASE_URL="https://${RAILWAY_DOMAIN}" \
    NEXT_PUBLIC_API_BASE="https://${RAILWAY_DOMAIN}" \
    NEXTAUTH_URL="https://${RAILWAY_DOMAIN}" \
    PORT="${PORT:-3000}"

# ============================================
# SECURITY KEYS
# ============================================
log $BLUE "🔐 Security Configuration"

NEXTAUTH_SECRET=$(generate_secret)
ZEAL_SECRET_KEY=$(generate_secret)

railway vars set \
    NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
    ZEAL_SECRET_KEY="${ZEAL_SECRET_KEY}" \
    JWT_SECRET="${ZEAL_SECRET_KEY}"

# ============================================
# FEATURE FLAGS
# ============================================
log $BLUE "🚀 Feature Flags"

railway vars set \
    NEXT_PUBLIC_ENABLE_COLLABORATION="true" \
    NEXT_PUBLIC_ENABLE_FLOW_TRACING="true" \
    NEXT_PUBLIC_ENABLE_VERSION_HISTORY="true" \
    NEXT_PUBLIC_EMBED_ENABLED="true" \
    NEXT_PUBLIC_DEBUG_CRDT="false" \
    NEXT_PUBLIC_VERBOSE_LOGGING="false" \
    NEXT_PUBLIC_DISABLE_CONSOLE_LOGS="true" \
    USE_TEMPLATE_REPOSITORY="true" \
    AUTO_INGEST_TEMPLATES="true"

# ============================================
# EMBED API CONFIGURATION
# ============================================
log $BLUE "🔗 Embed Configuration"

railway vars set \
    NEXT_PUBLIC_EMBED_URL="https://${RAILWAY_DOMAIN}/embed" \
    EMBED_MAX_API_KEYS_PER_WORKFLOW="10" \
    EMBED_DEFAULT_RATE_LIMIT="1000"

# ============================================
# STORAGE CONFIGURATION (S3-Compatible)
# ============================================
log $BLUE "💾 Storage Configuration (S3-Compatible)"
log $CYAN "Zeal supports both AWS S3 and MinIO/S3-compatible storage."
log $CYAN "The s3-client automatically detects which provider to use."

read -p "Configure S3-compatible storage? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    read -p "Storage provider (minio/aws/other) [minio]: " PROVIDER
    PROVIDER="${PROVIDER:-minio}"
    
    case $PROVIDER in
        minio)
            read -p "   MinIO Endpoint (e.g., minio.railway.internal:9000): " MINIO_ENDPOINT
            read -p "   Access Key [minioadmin]: " MINIO_ACCESS_KEY
            read -s -p "   Secret Key: " MINIO_SECRET_KEY
            echo
            read -p "   Bucket Name [zeal-uploads]: " MINIO_BUCKET
            read -p "   Use SSL? (true/false) [false]: " MINIO_USE_SSL
            
            railway vars set \
                MINIO_ENDPOINT="${MINIO_ENDPOINT}" \
                MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}" \
                MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
                MINIO_BUCKET="${MINIO_BUCKET:-zeal-uploads}" \
                MINIO_USE_SSL="${MINIO_USE_SSL:-false}" \
                NEXT_PUBLIC_MINIO_URL="http${MINIO_USE_SSL:+s}://${RAILWAY_DOMAIN}/storage"
            ;;
        aws)
            log $CYAN "For AWS S3, you can use either AWS or MinIO variables:"
            read -p "   S3 Bucket Name: " AWS_S3_BUCKET
            read -p "   AWS Region [us-east-1]: " AWS_REGION
            read -p "   AWS Access Key ID (leave empty for IAM role): " AWS_ACCESS_KEY_ID
            if [ -n "$AWS_ACCESS_KEY_ID" ]; then
                read -s -p "   AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
                echo
            fi
            
            railway vars set \
                AWS_S3_BUCKET="${AWS_S3_BUCKET}" \
                AWS_REGION="${AWS_REGION:-us-east-1}" \
                ${AWS_ACCESS_KEY_ID:+AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"} \
                ${AWS_SECRET_ACCESS_KEY:+AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"}
            ;;
        other)
            log $CYAN "Configure your S3-compatible storage:"
            read -p "   Endpoint (without protocol): " MINIO_ENDPOINT
            read -p "   Access Key: " MINIO_ACCESS_KEY
            read -s -p "   Secret Key: " MINIO_SECRET_KEY
            echo
            read -p "   Bucket Name: " MINIO_BUCKET
            read -p "   Use SSL? (true/false) [true]: " MINIO_USE_SSL
            
            railway vars set \
                MINIO_ENDPOINT="${MINIO_ENDPOINT}" \
                MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
                MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
                MINIO_BUCKET="${MINIO_BUCKET}" \
                MINIO_USE_SSL="${MINIO_USE_SSL:-true}" \
                NEXT_PUBLIC_MINIO_URL="http${MINIO_USE_SSL:+s}://${MINIO_ENDPOINT}"
            ;;
    esac
else
    log $YELLOW "⚠️  No S3 storage configured. File uploads will not work."
    log $YELLOW "   You can configure storage later with: railway vars set"
fi

# ============================================
# AI SERVICES (OPTIONAL)
# ============================================
log $BLUE "🤖 AI Services Configuration (Optional)"

read -p "Configure AI services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Embeddings
    read -p "   Embedding vendor (openai/mock) [mock]: " EMBEDDING_VENDOR
    EMBEDDING_VENDOR="${EMBEDDING_VENDOR:-mock}"
    
    railway vars set EMBEDDING_VENDOR="${EMBEDDING_VENDOR}"
    
    if [ "$EMBEDDING_VENDOR" = "openai" ]; then
        read -s -p "   OpenAI API Key: " EMBEDDING_API_KEY
        echo
        railway vars set \
            EMBEDDING_API_KEY="${EMBEDDING_API_KEY}" \
            EMBEDDING_MODEL="text-embedding-3-small" \
            EMBEDDING_DIMENSIONS="1536" \
            EMBEDDING_BATCH_SIZE="100" \
            EMBEDDING_RATE_LIMIT_DELAY="100"
    else
        railway vars set \
            EMBEDDING_DIMENSIONS="1536" \
            EMBEDDING_BATCH_SIZE="100"
    fi
    
    # OpenRouter
    read -p "   Configure OpenRouter? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -s -p "   OpenRouter API Key: " OPENROUTER_API_KEY
        echo
        read -p "   OpenRouter Model [anthropic/claude-3.5-sonnet]: " OPENROUTER_MODEL
        
        railway vars set \
            OPENROUTER_API_KEY="${OPENROUTER_API_KEY}" \
            OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-3.5-sonnet}"
    fi
fi

# ============================================
# AUTHORIZATION (PRODUCTION DEFAULT: ENABLED)
# ============================================
log $BLUE "🔐 Authorization Configuration"
log $YELLOW "⚠️  Authorization is ENABLED by default for production."
log $YELLOW "   You can configure JWT settings now or update them later."

read -p "Configure authorization now? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    # Default to production mode for Railway
    ZEAL_AUTH_MODE="production"
    log $CYAN "   Using production auth mode (recommended for Railway)"
    
    # Load auth policies content for container to use
    AUTH_POLICIES_CONTENT=$(cat "$SCRIPT_DIR/auth-policies.json" 2>/dev/null || echo '{}')
    
    railway vars set \
        ZEAL_AUTH_ENABLED="true" \
        ZEAL_AUTH_MODE="${ZEAL_AUTH_MODE}" \
        ZEAL_AUTH_USE_WORKFLOW_DB="true" \
        ZEAL_AUTH_SCHEMA_NAME="zeal_auth" \
        ZEAL_AUTH_CACHE_ENABLED="true" \
        ZEAL_AUTH_CACHE_TTL="300" \
        ZEAL_AUTH_AUDIT_ENABLED="false" \
        ZEAL_AUTH_AUDIT_LEVEL="info" \
        ZEAL_AUTH_POLICIES_PATH="/app/config/auth-policies.json" \
        ZEAL_AUTH_POLICIES_FORMAT="json" \
        ZEAL_AUTH_POLICIES_WATCH="false" \
        ZEAL_AUTH_POLICIES_CONTENT="${AUTH_POLICIES_CONTENT}" \
        ZEAL_AUTH_DEFAULT_EFFECT="deny"
    
    if [ "$ZEAL_AUTH_MODE" = "development" ]; then
        railway vars set \
            ZEAL_DEV_USER_ID="dev-user" \
            ZEAL_DEV_TENANT_ID="dev-tenant" \
            ZEAL_DEV_ORG_ID="dev-org" \
            ZEAL_DEV_ROLES="user,developer" \
            ZEAL_DEV_ALLOW_ALL="false"
    else
        read -p "   JWT Issuer URL: " AUTH_JWT_ISSUER
        read -p "   JWT Audience: " AUTH_JWT_AUDIENCE
        read -p "   JWKS URI: " AUTH_JWT_JWKS_URI
        
        railway vars set \
            AUTH_JWT_ISSUER="${AUTH_JWT_ISSUER}" \
            AUTH_JWT_AUDIENCE="${AUTH_JWT_AUDIENCE}" \
            AUTH_JWT_JWKS_URI="${AUTH_JWT_JWKS_URI}" \
            AUTH_CLAIM_SUBJECT_ID="sub" \
            AUTH_CLAIM_TENANT="tenant_id" \
            AUTH_CLAIM_ORGANIZATION="org_id" \
            AUTH_CLAIM_ROLES="roles" \
            AUTH_CLAIM_PERMISSIONS="permissions"
    fi
else
    # Still enable auth but with minimal configuration
    log $YELLOW "⚠️  Auth is still enabled but using default configuration."
    log $YELLOW "   Update JWT settings later with: railway vars set"
    
    # Load default auth policies as environment variable for container to use
    AUTH_POLICIES_CONTENT=$(cat "$SCRIPT_DIR/auth-policies.json" 2>/dev/null || echo '{}')
    
    railway vars set \
        ZEAL_AUTH_ENABLED="true" \
        ZEAL_AUTH_MODE="production" \
        ZEAL_AUTH_USE_WORKFLOW_DB="true" \
        ZEAL_AUTH_SCHEMA_NAME="zeal_auth" \
        ZEAL_AUTH_CACHE_ENABLED="true" \
        ZEAL_AUTH_CACHE_TTL="300" \
        ZEAL_AUTH_AUDIT_ENABLED="true" \
        ZEAL_AUTH_AUDIT_LEVEL="info" \
        ZEAL_AUTH_POLICIES_PATH="/app/config/auth-policies.json" \
        ZEAL_AUTH_POLICIES_FORMAT="json" \
        ZEAL_AUTH_POLICIES_WATCH="false" \
        ZEAL_AUTH_POLICIES_CONTENT="${AUTH_POLICIES_CONTENT}" \
        ZEAL_AUTH_DEFAULT_EFFECT="deny" \
        ZEAL_AUTH_ENABLE_RLS="false" \
        ZEAL_AUTH_SESSION_TIMEOUT="3600" \
        ZEAL_AUTH_REFRESH_WINDOW="300" \
        AUTH_JWT_ISSUER="https://please-configure-your-idp.com" \
        AUTH_JWT_AUDIENCE="https://api.your-app.com" \
        AUTH_JWT_JWKS_URI="https://please-configure-your-idp.com/.well-known/jwks.json"
    
    log $RED "⚠️  IMPORTANT: Update JWT configuration before going live!"
    log $YELLOW "   Run: railway vars set AUTH_JWT_ISSUER=<your-issuer>"
    log $YELLOW "        railway vars set AUTH_JWT_AUDIENCE=<your-audience>"
    log $YELLOW "        railway vars set AUTH_JWT_JWKS_URI=<your-jwks-uri>"
fi

# ============================================
# CRDT SERVER VARIABLES (Separate Service)
# ============================================
log $YELLOW "
⚠️  IMPORTANT: CRDT Server Environment Variables

The CRDT server runs as a separate service. You need to:
1. Switch to the crdt-server service in Railway dashboard
2. Set these environment variables:"

echo "
railway vars set --service crdt-server \\
    REDIS_URL=\"${REDIS_URL}\" \\
    RUST_LOG=\"info\" \\
    CORS_ORIGIN=\"https://${RAILWAY_DOMAIN}\" \\
    MAX_CLIENTS_PER_ROOM=\"100\" \\
    CLIENT_TIMEOUT_MINUTES=\"30\" \\
    DISABLE_REDIS_PERSISTENCE=\"false\"
"

# ============================================
# SUMMARY
# ============================================
log $GREEN "
╔══════════════════════════════════════════════════════════════╗
║              ✅ Environment Configuration Complete!            ║
╚══════════════════════════════════════════════════════════════╝"

log $CYAN "Next steps:"
log $CYAN "1. Set CRDT server variables (see above)"
log $CYAN "2. Add storage volume if using local storage"
log $CYAN "3. Deploy with: railway up"
log $CYAN "4. Check deployment: railway logs"

log $YELLOW ""
log $YELLOW "To view all variables: railway vars"
log $YELLOW "To edit a variable: railway vars set KEY=value"