# Fixed Category and Subcategory Search Filtering

## Problem
Clicking on categories and subcategories in the search modal sidebar wasn't properly filtering the search results because the subcategory IDs were being transformed instead of using the actual subcategory values.

## Solution

### 1. Fixed Subcategory ID Mapping
Changed the subcategory mapping to use the actual subcategory value as the ID:

```typescript
// Before:
id: sub.toLowerCase().replace(/\s+/g, '-'),

// After:
id: sub, // Use the actual subcategory value
```

### 2. Updated Click Handlers
Added proper state management when clicking categories:
- Clicking "All Categories" clears both category and subcategory selections
- Clicking a category clears the subcategory selection
- This ensures clean state transitions when navigating between categories

### 3. How It Works
- Categories use their `name` field as the ID (e.g., "data-sources", "ai-models")
- Subcategories now use their actual values as IDs
- The `useTemplateSearch` hook already handles these filters properly
- The search API (`/api/nodes`) accepts `category` and `subcategory` parameters

## Testing
1. Open the search modal
2. Click on a category - should filter to only that category
3. Click on a subcategory - should filter to only that subcategory within the category
4. Click "All Categories" - should show all nodes again
5. Search results should update immediately based on the selected filters