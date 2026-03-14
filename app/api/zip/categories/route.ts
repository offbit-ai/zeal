/**
 * GET /api/zip/categories — List available node template categories
 *
 * Returns the canonical list of categories and subcategories.
 * External runtimes should use these when registering templates via ZIP
 * so their nodes appear in the correct palette section.
 */

import { NextResponse } from 'next/server'
import { NODE_CATEGORIES } from '@/lib/node-categories'

export async function GET() {
  return NextResponse.json({
    categories: NODE_CATEGORIES,
    count: NODE_CATEGORIES.length,
  })
}
