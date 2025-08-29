#!/bin/bash

# Setup script for AI integrations
# This script builds the GraphRAG knowledge graph and prepares AI features

echo "🚀 Setting up AI integrations for Zeal..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the Zeal root directory"
  exit 1
fi

# Check for required environment variables
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "⚠️ Warning: OPENROUTER_API_KEY not set. AI features will be limited."
  echo "   Set this in your .env.local file to enable full AI capabilities."
else
  echo "✅ OpenRouter API key detected"
fi

# Check if templates are loaded
echo "📚 Checking for node templates..."
TEMPLATE_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM node_templates WHERE status = 'active';" 2>/dev/null || echo "0")

if [ "$TEMPLATE_COUNT" = "0" ] || [ "$TEMPLATE_COUNT" = "" ]; then
  echo "📥 Loading node templates..."
  npm run templates:ingest
else
  echo "✅ Found $TEMPLATE_COUNT active templates"
fi

# Build GraphRAG knowledge graph
echo "🧠 Building GraphRAG knowledge graph..."
if [ "$1" = "--force" ]; then
  echo "   Forcing rebuild of GraphRAG..."
  node scripts/build-graphrag.js --force
else
  node scripts/build-graphrag.js
fi

# Check if GraphRAG was built successfully
if [ -f "data/graphrag-snapshot.json" ]; then
  echo "✅ GraphRAG knowledge graph built successfully"
  
  # Copy to public directory for client access
  if [ ! -d "public" ]; then
    mkdir -p public
  fi
  cp data/graphrag-snapshot.json public/
  echo "📁 GraphRAG snapshot copied to public directory"
else
  echo "❌ Failed to build GraphRAG knowledge graph"
  echo "   AI features may not work correctly"
  exit 1
fi

# Build AI integration servers
echo "🔨 Building AI integration servers..."

# Build OpenAI Functions server
echo "   Building OpenAI Functions server..."
cd ai-integrations/openai-functions
npm install
npm run build 2>/dev/null || echo "   Note: Build step not configured, skipping..."
cd ../..

# Build MCP server
echo "   Building MCP server..."
cd ai-integrations/mcp-server
npm install
npm run build 2>/dev/null || echo "   Note: Build step not configured, skipping..."
cd ../..

echo ""
echo "✅ AI integrations setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Start the OpenAI Functions server:"
echo "      cd ai-integrations/openai-functions && npm run dev"
echo ""
echo "   2. Start the MCP server:"
echo "      cd ai-integrations/mcp-server && npm run dev"
echo ""
echo "   3. Configure your AI clients to use:"
echo "      - OpenAI Functions: http://localhost:3456"
echo "      - MCP Server: http://localhost:3457"
echo ""

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "⚠️ Remember to set OPENROUTER_API_KEY in .env.local for full AI features!"
fi