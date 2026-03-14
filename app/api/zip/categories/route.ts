/**
 * GET  /api/zip/categories — List all node template categories (DB + canonical fallback)
 * POST /api/zip/categories — Register new categories and subcategories
 *
 * External runtimes can register their own top-level categories and
 * subcategories so their nodes appear with proper grouping in the palette.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCategoryOperations } from '@/lib/database-category-operations'
import { NODE_CATEGORIES } from '@/lib/node-categories'
import { withZIPAuthorization, getAuthenticatedUserId } from '@/lib/auth/zip-middleware'

/**
 * GET /api/zip/categories
 * Returns categories from DB. Falls back to canonical constants if DB is unavailable.
 */
export async function GET() {
  try {
    const ops = await getCategoryOperations()
    const dbCategories = await ops.getCategoriesWithCounts()

    if (dbCategories.length > 0) {
      return NextResponse.json({
        categories: dbCategories,
        count: dbCategories.length,
        source: 'database',
      })
    }
  } catch {
    // DB unavailable — fall back to canonical constants
  }

  return NextResponse.json({
    categories: NODE_CATEGORIES,
    count: NODE_CATEGORIES.length,
    source: 'canonical',
  })
}

/**
 * POST /api/zip/categories
 * Register new categories and/or subcategories. Upserts by name — if a category
 * with the same name exists, its subcategories are merged (new ones added).
 */

const subcategorySchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Subcategory name must be lowercase kebab-case'),
  displayName: z.string(),
  description: z.string().optional().default(''),
})

const categorySchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Category name must be lowercase kebab-case'),
  displayName: z.string(),
  description: z.string().optional().default(''),
  icon: z.string().optional().default('folder'),
  subcategories: z.array(subcategorySchema).optional().default([]),
})

const registerCategoriesSchema = z.object({
  categories: z.array(categorySchema).min(1),
})

export const POST = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const body = await request.json()

    const validation = registerCategoriesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        },
      }, { status: 400 })
    }

    const { categories } = validation.data
    const ops = await getCategoryOperations()
    const userId = getAuthenticatedUserId(request)

    const results: Array<{
      name: string
      status: 'created' | 'exists' | 'updated' | 'error'
      subcategoriesAdded: number
      error?: string
    }> = []

    for (const cat of categories) {
      try {
        // Check if category already exists
        let existing = await ops.getCategoryByName(cat.name)

        if (!existing) {
          // Create new category
          existing = await ops.createCategory({
            name: cat.name,
            displayName: cat.displayName,
            description: cat.description,
            icon: cat.icon,
            isActive: true,
            createdBy: userId,
            updatedBy: userId,
          })
        }

        // Add new subcategories (skip existing ones)
        let subcategoriesAdded = 0
        if (cat.subcategories.length > 0 && existing.id) {
          for (const sub of cat.subcategories) {
            try {
              await ops.createSubcategory(existing.id, {
                name: sub.name,
                displayName: sub.displayName,
                description: sub.description,
              })
              subcategoriesAdded++
            } catch {
              // Likely duplicate — skip silently
            }
          }
        }

        results.push({
          name: cat.name,
          status: existing ? (subcategoriesAdded > 0 ? 'updated' : 'exists') : 'created',
          subcategoriesAdded,
        })
      } catch (error) {
        results.push({
          name: cat.name,
          status: 'error',
          subcategoriesAdded: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      registered: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      categories: results,
    })
  } catch (error) {
    console.error('Error registering categories:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register categories',
      },
    }, { status: 500 })
  }
}, {
  resourceType: 'templates',
  action: 'create',
})
