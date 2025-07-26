/**
 * Node color variant system that works at runtime without Tailwind compilation
 * This ensures nodes always have proper background colors
 */

export interface ColorVariant {
  background: string
  border: string
  text: string
  hover: {
    background: string
    border: string
  }
}

// Define all color variants with actual color values (not Tailwind classes)
export const COLOR_VARIANTS: Record<string, ColorVariant> = {
  // Grays
  'gray-50': {
    background: '#f9fafb',
    border: '#e5e7eb',
    text: '#111827',
    hover: {
      background: '#f3f4f6',
      border: '#d1d5db'
    }
  },
  'gray-100': {
    background: '#f3f4f6',
    border: '#d1d5db',
    text: '#111827',
    hover: {
      background: '#e5e7eb',
      border: '#9ca3af'
    }
  },
  'gray-200': {
    background: '#e5e7eb',
    border: '#d1d5db',
    text: '#111827',
    hover: {
      background: '#d1d5db',
      border: '#9ca3af'
    }
  },
  'gray-300': {
    background: '#d1d5db',
    border: '#9ca3af',
    text: '#111827',
    hover: {
      background: '#9ca3af',
      border: '#6b7280'
    }
  },
  'gray-400': {
    background: '#9ca3af',
    border: '#6b7280',
    text: '#111827',
    hover: {
      background: '#6b7280',
      border: '#4b5563'
    }
  },
  'gray-500': {
    background: '#6b7280',
    border: '#4b5563',
    text: '#ffffff',
    hover: {
      background: '#4b5563',
      border: '#374151'
    }
  },
  'gray-600': {
    background: '#4b5563',
    border: '#374151',
    text: '#ffffff',
    hover: {
      background: '#374151',
      border: '#1f2937'
    }
  },
  'gray-700': {
    background: '#374151',
    border: '#1f2937',
    text: '#ffffff',
    hover: {
      background: '#1f2937',
      border: '#111827'
    }
  },
  'gray-800': {
    background: '#1f2937',
    border: '#111827',
    text: '#ffffff',
    hover: {
      background: '#111827',
      border: '#000000'
    }
  },
  'gray-900': {
    background: '#111827',
    border: '#000000',
    text: '#ffffff',
    hover: {
      background: '#000000',
      border: '#000000'
    }
  },
  
  // Blues
  'blue-50': {
    background: '#eff6ff',
    border: '#dbeafe',
    text: '#1e40af',
    hover: {
      background: '#dbeafe',
      border: '#bfdbfe'
    }
  },
  'blue-100': {
    background: '#dbeafe',
    border: '#bfdbfe',
    text: '#1e40af',
    hover: {
      background: '#bfdbfe',
      border: '#93c5fd'
    }
  },
  'blue-200': {
    background: '#bfdbfe',
    border: '#93c5fd',
    text: '#1e40af',
    hover: {
      background: '#93c5fd',
      border: '#60a5fa'
    }
  },
  'blue-300': {
    background: '#93c5fd',
    border: '#60a5fa',
    text: '#1e40af',
    hover: {
      background: '#60a5fa',
      border: '#3b82f6'
    }
  },
  'blue-400': {
    background: '#60a5fa',
    border: '#3b82f6',
    text: '#1e3a8a',
    hover: {
      background: '#3b82f6',
      border: '#2563eb'
    }
  },
  'blue-500': {
    background: '#3b82f6',
    border: '#2563eb',
    text: '#ffffff',
    hover: {
      background: '#2563eb',
      border: '#1d4ed8'
    }
  },
  'blue-600': {
    background: '#2563eb',
    border: '#1d4ed8',
    text: '#ffffff',
    hover: {
      background: '#1d4ed8',
      border: '#1e40af'
    }
  },
  'blue-700': {
    background: '#1d4ed8',
    border: '#1e40af',
    text: '#ffffff',
    hover: {
      background: '#1e40af',
      border: '#1e3a8a'
    }
  },
  'blue-800': {
    background: '#1e40af',
    border: '#1e3a8a',
    text: '#ffffff',
    hover: {
      background: '#1e3a8a',
      border: '#172554'
    }
  },
  'blue-900': {
    background: '#1e3a8a',
    border: '#172554',
    text: '#ffffff',
    hover: {
      background: '#172554',
      border: '#172554'
    }
  },
  
  // Greens
  'green-50': {
    background: '#f0fdf4',
    border: '#dcfce7',
    text: '#166534',
    hover: {
      background: '#dcfce7',
      border: '#bbf7d0'
    }
  },
  'green-100': {
    background: '#dcfce7',
    border: '#bbf7d0',
    text: '#166534',
    hover: {
      background: '#bbf7d0',
      border: '#86efac'
    }
  },
  'green-200': {
    background: '#bbf7d0',
    border: '#86efac',
    text: '#166534',
    hover: {
      background: '#86efac',
      border: '#4ade80'
    }
  },
  'green-300': {
    background: '#86efac',
    border: '#4ade80',
    text: '#166534',
    hover: {
      background: '#4ade80',
      border: '#22c55e'
    }
  },
  'green-400': {
    background: '#4ade80',
    border: '#22c55e',
    text: '#166534',
    hover: {
      background: '#22c55e',
      border: '#16a34a'
    }
  },
  'green-500': {
    background: '#22c55e',
    border: '#16a34a',
    text: '#ffffff',
    hover: {
      background: '#16a34a',
      border: '#15803d'
    }
  },
  'green-600': {
    background: '#16a34a',
    border: '#15803d',
    text: '#ffffff',
    hover: {
      background: '#15803d',
      border: '#166534'
    }
  },
  'green-700': {
    background: '#15803d',
    border: '#166534',
    text: '#ffffff',
    hover: {
      background: '#166534',
      border: '#14532d'
    }
  },
  'green-800': {
    background: '#166534',
    border: '#14532d',
    text: '#ffffff',
    hover: {
      background: '#14532d',
      border: '#052e16'
    }
  },
  'green-900': {
    background: '#14532d',
    border: '#052e16',
    text: '#ffffff',
    hover: {
      background: '#052e16',
      border: '#052e16'
    }
  },
  
  // Reds
  'red-50': {
    background: '#fef2f2',
    border: '#fee2e2',
    text: '#991b1b',
    hover: {
      background: '#fee2e2',
      border: '#fecaca'
    }
  },
  'red-100': {
    background: '#fee2e2',
    border: '#fecaca',
    text: '#991b1b',
    hover: {
      background: '#fecaca',
      border: '#fca5a5'
    }
  },
  'red-200': {
    background: '#fecaca',
    border: '#fca5a5',
    text: '#991b1b',
    hover: {
      background: '#fca5a5',
      border: '#f87171'
    }
  },
  'red-300': {
    background: '#fca5a5',
    border: '#f87171',
    text: '#991b1b',
    hover: {
      background: '#f87171',
      border: '#ef4444'
    }
  },
  'red-400': {
    background: '#f87171',
    border: '#ef4444',
    text: '#7f1d1d',
    hover: {
      background: '#ef4444',
      border: '#dc2626'
    }
  },
  'red-500': {
    background: '#ef4444',
    border: '#dc2626',
    text: '#ffffff',
    hover: {
      background: '#dc2626',
      border: '#b91c1c'
    }
  },
  'red-600': {
    background: '#dc2626',
    border: '#b91c1c',
    text: '#ffffff',
    hover: {
      background: '#b91c1c',
      border: '#991b1b'
    }
  },
  'red-700': {
    background: '#b91c1c',
    border: '#991b1b',
    text: '#ffffff',
    hover: {
      background: '#991b1b',
      border: '#7f1d1d'
    }
  },
  'red-800': {
    background: '#991b1b',
    border: '#7f1d1d',
    text: '#ffffff',
    hover: {
      background: '#7f1d1d',
      border: '#450a0a'
    }
  },
  'red-900': {
    background: '#7f1d1d',
    border: '#450a0a',
    text: '#ffffff',
    hover: {
      background: '#450a0a',
      border: '#450a0a'
    }
  },
  
  // Yellows
  'yellow-50': {
    background: '#fefce8',
    border: '#fef3c7',
    text: '#854d0e',
    hover: {
      background: '#fef3c7',
      border: '#fde68a'
    }
  },
  'yellow-100': {
    background: '#fef3c7',
    border: '#fde68a',
    text: '#854d0e',
    hover: {
      background: '#fde68a',
      border: '#fcd34d'
    }
  },
  'yellow-200': {
    background: '#fde68a',
    border: '#fcd34d',
    text: '#854d0e',
    hover: {
      background: '#fcd34d',
      border: '#fbbf24'
    }
  },
  'yellow-300': {
    background: '#fcd34d',
    border: '#fbbf24',
    text: '#854d0e',
    hover: {
      background: '#fbbf24',
      border: '#f59e0b'
    }
  },
  'yellow-400': {
    background: '#fbbf24',
    border: '#f59e0b',
    text: '#713f12',
    hover: {
      background: '#f59e0b',
      border: '#d97706'
    }
  },
  'yellow-500': {
    background: '#f59e0b',
    border: '#d97706',
    text: '#ffffff',
    hover: {
      background: '#d97706',
      border: '#b45309'
    }
  },
  'yellow-600': {
    background: '#d97706',
    border: '#b45309',
    text: '#ffffff',
    hover: {
      background: '#b45309',
      border: '#92400e'
    }
  },
  'yellow-700': {
    background: '#b45309',
    border: '#92400e',
    text: '#ffffff',
    hover: {
      background: '#92400e',
      border: '#713f12'
    }
  },
  'yellow-800': {
    background: '#92400e',
    border: '#713f12',
    text: '#ffffff',
    hover: {
      background: '#713f12',
      border: '#451a03'
    }
  },
  'yellow-900': {
    background: '#713f12',
    border: '#451a03',
    text: '#ffffff',
    hover: {
      background: '#451a03',
      border: '#451a03'
    }
  },
  
  // Purples
  'purple-50': {
    background: '#faf5ff',
    border: '#f3e8ff',
    text: '#6b21a8',
    hover: {
      background: '#f3e8ff',
      border: '#e9d5ff'
    }
  },
  'purple-100': {
    background: '#f3e8ff',
    border: '#e9d5ff',
    text: '#6b21a8',
    hover: {
      background: '#e9d5ff',
      border: '#d8b4fe'
    }
  },
  'purple-200': {
    background: '#e9d5ff',
    border: '#d8b4fe',
    text: '#6b21a8',
    hover: {
      background: '#d8b4fe',
      border: '#c084fc'
    }
  },
  'purple-300': {
    background: '#d8b4fe',
    border: '#c084fc',
    text: '#6b21a8',
    hover: {
      background: '#c084fc',
      border: '#a855f7'
    }
  },
  'purple-400': {
    background: '#c084fc',
    border: '#a855f7',
    text: '#581c87',
    hover: {
      background: '#a855f7',
      border: '#9333ea'
    }
  },
  'purple-500': {
    background: '#a855f7',
    border: '#9333ea',
    text: '#ffffff',
    hover: {
      background: '#9333ea',
      border: '#7c3aed'
    }
  },
  'purple-600': {
    background: '#9333ea',
    border: '#7c3aed',
    text: '#ffffff',
    hover: {
      background: '#7c3aed',
      border: '#6b21a8'
    }
  },
  'purple-700': {
    background: '#7c3aed',
    border: '#6b21a8',
    text: '#ffffff',
    hover: {
      background: '#6b21a8',
      border: '#581c87'
    }
  },
  'purple-800': {
    background: '#6b21a8',
    border: '#581c87',
    text: '#ffffff',
    hover: {
      background: '#581c87',
      border: '#3b0764'
    }
  },
  'purple-900': {
    background: '#581c87',
    border: '#3b0764',
    text: '#ffffff',
    hover: {
      background: '#3b0764',
      border: '#3b0764'
    }
  },
  
  // Oranges
  'orange-50': {
    background: '#fff7ed',
    border: '#fed7aa',
    text: '#9a3412',
    hover: {
      background: '#fed7aa',
      border: '#fdba74'
    }
  },
  'orange-100': {
    background: '#fed7aa',
    border: '#fdba74',
    text: '#9a3412',
    hover: {
      background: '#fdba74',
      border: '#fb923c'
    }
  },
  'orange-200': {
    background: '#fdba74',
    border: '#fb923c',
    text: '#9a3412',
    hover: {
      background: '#fb923c',
      border: '#f97316'
    }
  },
  'orange-300': {
    background: '#fb923c',
    border: '#f97316',
    text: '#9a3412',
    hover: {
      background: '#f97316',
      border: '#ea580c'
    }
  },
  'orange-400': {
    background: '#f97316',
    border: '#ea580c',
    text: '#7c2d12',
    hover: {
      background: '#ea580c',
      border: '#dc2626'
    }
  },
  'orange-500': {
    background: '#ea580c',
    border: '#dc2626',
    text: '#ffffff',
    hover: {
      background: '#dc2626',
      border: '#c2410c'
    }
  },
  'orange-600': {
    background: '#dc2626',
    border: '#c2410c',
    text: '#ffffff',
    hover: {
      background: '#c2410c',
      border: '#9a3412'
    }
  },
  'orange-700': {
    background: '#c2410c',
    border: '#9a3412',
    text: '#ffffff',
    hover: {
      background: '#9a3412',
      border: '#7c2d12'
    }
  },
  'orange-800': {
    background: '#9a3412',
    border: '#7c2d12',
    text: '#ffffff',
    hover: {
      background: '#7c2d12',
      border: '#431407'
    }
  },
  'orange-900': {
    background: '#7c2d12',
    border: '#431407',
    text: '#ffffff',
    hover: {
      background: '#431407',
      border: '#431407'
    }
  },
  
  // Special variants
  'white': {
    background: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    hover: {
      background: '#f9fafb',
      border: '#d1d5db'
    }
  },
  'black': {
    background: '#000000',
    border: '#111827',
    text: '#ffffff',
    hover: {
      background: '#111827',
      border: '#1f2937'
    }
  },
  'transparent': {
    background: 'transparent',
    border: '#e5e7eb',
    text: '#111827',
    hover: {
      background: 'rgba(0, 0, 0, 0.05)',
      border: '#d1d5db'
    }
  }
}

// Default variant if none specified or not found
export const DEFAULT_VARIANT: ColorVariant = COLOR_VARIANTS['gray-100']

/**
 * Get color variant by name with fallback to default
 */
export function getColorVariant(variantName?: string): ColorVariant {
  if (!variantName) return DEFAULT_VARIANT
  
  // Handle compound variants like "blue-600"
  const variant = COLOR_VARIANTS[variantName]
  if (variant) return variant
  
  // If not found, try to extract color and shade
  const match = variantName.match(/^(.*?)[-]?(\d+)?$/)
  if (match) {
    const [, color, shade = '500'] = match
    const attemptedVariant = COLOR_VARIANTS[`${color}-${shade}`]
    if (attemptedVariant) return attemptedVariant
  }
  
  return DEFAULT_VARIANT
}

/**
 * Get inline styles for a node based on its variant
 */
export function getNodeStyles(variant?: string, isHovered: boolean = false): React.CSSProperties {
  const colorVariant = getColorVariant(variant)
  
  return {
    backgroundColor: isHovered ? colorVariant.hover.background : colorVariant.background,
    borderColor: isHovered ? colorVariant.hover.border : colorVariant.border,
    color: colorVariant.text,
    borderWidth: '1px',
    borderStyle: 'solid',
    transition: 'all 0.2s ease'
  }
}

/**
 * Get text color for a variant
 */
export function getTextColor(variant?: string): string {
  const colorVariant = getColorVariant(variant)
  return colorVariant.text
}

/**
 * Check if a variant uses dark text (for contrast)
 */
export function usesDarkText(variant?: string): boolean {
  const colorVariant = getColorVariant(variant)
  return colorVariant.text === '#111827' || colorVariant.text.includes('1b') || colorVariant.text.includes('0e')
}