// DEPRECATED: Use the new Icon Library instead
// This file is kept for backward compatibility but should be migrated to @/lib/icons

import { getIconByName as newGetIconByName } from '@/lib/icons'
import { LucideIcon } from 'lucide-react'

/**
 * @deprecated Use the new Icon Library from @/lib/icons instead
 * Get a Lucide icon component by its name
 * @param iconName - The name of the icon (kebab-case, PascalCase, or camelCase)
 * @param fallback - Fallback icon to use if not found (default: Box)
 * @returns The Lucide icon component
 */
export function getIconByName(iconName: string, fallback?: LucideIcon): LucideIcon {
  console.warn(
    '[DEPRECATED] getIconByName from lucide-icon-factory is deprecated. Use the new Icon Library from @/lib/icons instead.'
  )

  // Delegate to the new icon library
  return newGetIconByName(iconName, fallback, 'lucide')
}
