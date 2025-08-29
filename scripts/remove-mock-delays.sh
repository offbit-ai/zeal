#!/bin/bash

# Script to remove all mockDelay calls from API endpoints
# These should never be in production code!

echo "🔍 Finding and removing mockDelay calls from API endpoints..."

# Find all TypeScript files in app/api (excluding backups)
files=$(find app/api -name "*.ts" -type f | grep -v ".backup.ts")

count=0
for file in $files; do
  if grep -q "mockDelay" "$file"; then
    echo "  Cleaning: $file"
    
    # Remove mockDelay import from imports
    sed -i '' '/mockDelay,$/d' "$file"
    sed -i '' 's/, mockDelay//g' "$file"
    sed -i '' 's/mockDelay, //g' "$file"
    
    # Remove await mockDelay(...) lines
    sed -i '' '/await mockDelay/d' "$file"
    
    # Remove mockDelay(...) lines without await
    sed -i '' '/mockDelay(/d' "$file"
    
    count=$((count + 1))
  fi
done

echo "✅ Removed mockDelay from $count files"
echo ""
echo "⚠️  Important: mockDelay should ONLY be used in:"
echo "   - Test files (*.test.ts, *.spec.ts)"
echo ""
echo "🚫 NEVER use mockDelay in:"
echo "   - Production API endpoints"
echo "   - Development code"
echo "   - Any runtime code"