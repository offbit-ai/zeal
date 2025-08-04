#!/bin/bash

# Production build script that disables console logs

echo "🚀 Building Zeal for production..."

# Set environment variables
export NODE_ENV=production
export NEXT_PUBLIC_DISABLE_CONSOLE_LOGS=true

# Run the build
npm run build

echo "✅ Production build complete!"