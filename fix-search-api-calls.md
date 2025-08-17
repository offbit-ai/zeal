# Fixed Search to Use API for All Filtering

## Problem
The search modal was using client-side filtering when categories/subcategories were clicked, instead of making API calls to the `/api/templates` endpoint that has AI-powered semantic search.

## Solution

### Changes to useTemplateSearch hook:

1. **Always call API when filters change**:
   - Modified the debounced search to trigger when there's a query OR category/subcategory filters
   - Previously only triggered on non-empty search query

2. **Removed client-side filtering**:
   - Removed the filter logic that was filtering results after API call
   - Now always uses the results directly from the API

3. **Faster response for category clicks**:
   - Reduced debounce from 300ms to 100ms for quicker feedback

4. **Initial load**:
   - Performs an empty search on mount to load all templates
   - This ensures we're using the API from the start

## How it works now:

1. **On mount**: Calls `/api/templates?q=&limit=200` to get all templates
2. **On search**: Calls `/api/templates?q=<query>&limit=100`
3. **On category click**: Calls `/api/templates?q=<query>&category=<category>&limit=100`
4. **On subcategory click**: Calls `/api/templates?q=<query>&category=<category>&subcategory=<subcategory>&limit=100`

## Benefits:
- All filtering goes through the AI-powered search API
- Category/subcategory filtering uses semantic search
- No more client-side filtering that bypasses the AI
- Consistent results from the template repository

## Testing:
1. Open search modal - should see initial API call
2. Click a category - should see API call with category parameter
3. Click a subcategory - should see API call with both parameters
4. Type in search box - should see API call with query parameter
5. All combinations should trigger API calls, not client-side filtering