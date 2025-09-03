#!/bin/bash

# Publish Zeal SDKs
# Usage: ./scripts/publish-sdks.sh [patch|minor|major|prerelease]
#
# Environment variables:
#   NPM_TOKEN or NPM_ACCESS_TOKEN - NPM authentication token
#   PYPI_TOKEN - PyPI authentication token (optional, for Python SDK)

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERSION_BUMP=${1:-patch}

# Load .env.npm if it exists
if [ -f ".env.npm" ]; then
    echo -e "${YELLOW}Loading NPM credentials from .env.npm${NC}"
    source .env.npm
fi

# Check for NPM authentication if publishing TypeScript SDKs
check_npm_auth() {
    if [ -n "$NPM_TOKEN" ] || [ -n "$NPM_ACCESS_TOKEN" ]; then
        echo -e "${GREEN}NPM authentication token found${NC}"
        # Export for child processes
        if [ -n "$NPM_TOKEN" ]; then
            export NPM_TOKEN
        fi
        if [ -n "$NPM_ACCESS_TOKEN" ]; then
            export NPM_ACCESS_TOKEN
        fi
    else
        echo -e "${YELLOW}Warning: NPM_TOKEN or NPM_ACCESS_TOKEN not set${NC}"
        echo -e "${YELLOW}You may be prompted to login or the publish may fail${NC}"
        echo -e "\n${BLUE}To set up NPM authentication:${NC}"
        echo -e "  1. Go to https://www.npmjs.com/settings/[username]/tokens"
        echo -e "  2. Generate an access token with publish permissions"
        echo -e "  3. Add to .env.npm: NPM_TOKEN=your_token_here"
        echo -e "     OR set it: export NPM_TOKEN=your_token_here"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  📦 Zeal SDKs Publisher${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Version bump: $VERSION_BUMP${NC}\n"

# Function to publish TypeScript/Node.js package
publish_npm_package() {
    local PACKAGE_NAME=$1
    local PACKAGE_DIR=$2
    
    echo -e "\n${BLUE}────────────────────────────────────────────────${NC}"
    echo -e "${GREEN}Publishing $PACKAGE_NAME (npm)${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────${NC}\n"
    
    cd $PACKAGE_DIR
    
    # Check if publish script exists
    if [ -f "scripts/publish.sh" ]; then
        chmod +x scripts/publish.sh
        ./scripts/publish.sh $VERSION_BUMP
    else
        echo -e "${YELLOW}No publish script found, using npm directly${NC}"
        
        # Run build
        npm run build || (echo -e "${RED}Build failed for $PACKAGE_NAME${NC}" && exit 1)
        
        # Version bump
        npm version $VERSION_BUMP --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        
        # Publish
        npm publish --access public
        
        echo -e "${GREEN}✅ Published $PACKAGE_NAME@$NEW_VERSION${NC}"
    fi
    
    cd - > /dev/null
}

# Function to publish Python package
publish_python_package() {
    local PACKAGE_DIR=$1
    
    echo -e "\n${BLUE}────────────────────────────────────────────────${NC}"
    echo -e "${GREEN}Publishing Python SDK (PyPI)${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────${NC}\n"
    
    cd $PACKAGE_DIR
    
    if [ -f "scripts/publish.sh" ]; then
        chmod +x scripts/publish.sh
        ./scripts/publish.sh $VERSION_BUMP
    else
        echo -e "${RED}No publish script found for Python SDK${NC}"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to publish Go package
publish_go_package() {
    local PACKAGE_DIR=$1
    
    echo -e "\n${BLUE}────────────────────────────────────────────────${NC}"
    echo -e "${GREEN}Publishing Go SDK (pkg.go.dev)${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────${NC}\n"
    
    cd $PACKAGE_DIR
    
    if [ -f "scripts/publish.sh" ]; then
        chmod +x scripts/publish.sh
        ./scripts/publish.sh $VERSION_BUMP
    else
        echo -e "${RED}No publish script found for Go SDK${NC}"
        exit 1
    fi
    
    cd - > /dev/null
}

# Ask which packages to publish
echo -e "${YELLOW}Which SDKs would you like to publish?${NC}"
echo "  1) TypeScript SDK (@offbit-ai/zeal-sdk)"
echo "  2) Embed SDK (@offbit-ai/zeal-embed-sdk)"
echo "  3) Python SDK (zeal-sdk)"
echo "  4) Go SDK"
echo "  5) All TypeScript SDKs (1 & 2)"
echo "  6) All SDKs"
echo -n "Enter choice [1-6]: "
read CHOICE

case $CHOICE in
    1)
        check_npm_auth
        publish_npm_package "@offbit-ai/zeal-sdk" "packages/zeal-sdk"
        ;;
    2)
        check_npm_auth
        publish_npm_package "@offbit-ai/zeal-embed-sdk" "packages/zeal-embed-sdk"
        ;;
    3)
        publish_python_package "packages/zeal-python-sdk"
        ;;
    4)
        publish_go_package "packages/zeal-go-sdk"
        ;;
    5)
        check_npm_auth
        echo -e "${YELLOW}Publishing all TypeScript SDKs...${NC}"
        publish_npm_package "@offbit-ai/zeal-sdk" "packages/zeal-sdk"
        publish_npm_package "@offbit-ai/zeal-embed-sdk" "packages/zeal-embed-sdk"
        ;;
    6)
        check_npm_auth
        echo -e "${YELLOW}Publishing all SDKs...${NC}"
        publish_npm_package "@offbit-ai/zeal-sdk" "packages/zeal-sdk"
        publish_npm_package "@offbit-ai/zeal-embed-sdk" "packages/zeal-embed-sdk"
        publish_python_package "packages/zeal-python-sdk"
        publish_go_package "packages/zeal-go-sdk"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Publishing complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "\n${YELLOW}Don't forget to:${NC}"
echo -e "  1. Push commits: git push origin main"
echo -e "  2. Push tags: git push --tags"
echo -e "\n${YELLOW}Package locations:${NC}"
echo -e "  NPM: https://www.npmjs.com/package/@offbit-ai/zeal-sdk"
echo -e "       https://www.npmjs.com/package/@offbit-ai/zeal-embed-sdk"
echo -e "  PyPI: https://pypi.org/project/zeal-sdk/"
echo -e "  Go: https://pkg.go.dev/github.com/offbit-ai/zeal/packages/zeal-go-sdk"