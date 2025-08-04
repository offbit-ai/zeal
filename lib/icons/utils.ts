import { IconLibrary, IconSource } from './index'

/**
 * Icon validation utilities
 */
export class IconUtils {
  private static iconLibrary = IconLibrary.getInstance()

  /**
   * Validate that an icon exists
   */
  static validateIcon(iconName: string, source: IconSource = 'lucide'): boolean {
    return this.iconLibrary.hasIcon(iconName, source)
  }

  /**
   * Validate an array of icons
   */
  static validateIcons(icons: Array<{ name: string; source?: IconSource }>): {
    valid: Array<{ name: string; source: IconSource }>
    invalid: Array<{ name: string; source: IconSource; reason: string }>
  } {
    const valid: Array<{ name: string; source: IconSource }> = []
    const invalid: Array<{ name: string; source: IconSource; reason: string }> = []

    icons.forEach(({ name, source = 'lucide' }) => {
      if (!name) {
        invalid.push({ name, source, reason: 'Empty icon name' })
      } else if (this.validateIcon(name, source)) {
        valid.push({ name, source })
      } else {
        invalid.push({ name, source, reason: 'Icon not found' })
      }
    })

    return { valid, invalid }
  }

  /**
   * Get suggestions for similar icon names
   */
  static getSuggestions(iconName: string, source: IconSource = 'lucide', limit = 5): string[] {
    const available = this.iconLibrary.getAvailableIcons(source)
    const normalizedInput = iconName.toLowerCase()

    // Score icons based on similarity
    const scored = available.map(name => ({
      name,
      score: this.calculateSimilarity(normalizedInput, name.toLowerCase()),
    }))

    // Sort by score and return top suggestions
    return scored
      .filter(item => item.score > 0.3) // Minimum similarity threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.name)
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1]
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1, // deletion
            matrix[j][i - 1] + 1, // insertion
            matrix[j - 1][i - 1] + 1 // substitution
          )
        }
      }
    }

    const distance = matrix[str2.length][str1.length]
    const maxLength = Math.max(str1.length, str2.length)
    return 1 - distance / maxLength
  }

  /**
   * Normalize icon name to different formats
   */
  static normalizeIconName(iconName: string): {
    original: string
    kebabCase: string
    snakeCase: string
    pascalCase: string
    camelCase: string
  } {
    const kebabCase = iconName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace(/[_\s]+/g, '-')

    const snakeCase = kebabCase.replace(/-/g, '_')

    const pascalCase = iconName
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')

    const camelCase = pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1)

    return {
      original: iconName,
      kebabCase,
      snakeCase,
      pascalCase,
      camelCase,
    }
  }

  /**
   * Get icon metadata and information
   */
  static getIconMetadata(
    iconName: string,
    source: IconSource = 'lucide'
  ): {
    name: string
    source: IconSource
    exists: boolean
    variations: string[]
    suggestions: string[]
  } {
    const exists = this.validateIcon(iconName, source)
    const normalized = this.normalizeIconName(iconName)
    const variations = Object.values(normalized)
    const suggestions = exists ? [] : this.getSuggestions(iconName, source)

    return {
      name: iconName,
      source,
      exists,
      variations,
      suggestions,
    }
  }

  /**
   * Generate icon import statements for development
   */
  static generateImports(icons: Array<{ name: string; source?: IconSource }>): {
    lucideImports: string[]
    customImports: string[]
    iconComponents: string
  } {
    const lucideIcons = new Set<string>()
    const customIcons = new Set<string>()

    icons.forEach(({ name, source = 'lucide' }) => {
      if (this.validateIcon(name, source)) {
        if (source === 'lucide') {
          // Convert to PascalCase for Lucide imports
          const normalized = this.normalizeIconName(name)
          lucideIcons.add(normalized.pascalCase)
        } else {
          customIcons.add(name)
        }
      }
    })

    const lucideImports = Array.from(lucideIcons)
    const customImports = Array.from(customIcons)

    const iconComponents = `// Icon components usage:
${icons
  .map(({ name, source = 'lucide' }) => `<Icon name="${name}" source="${source}" />`)
  .join('\n')}`

    return {
      lucideImports,
      customImports,
      iconComponents,
    }
  }

  /**
   * Find all icons used in a codebase (for auditing)
   */
  static findIconUsage(codeContent: string): Array<{
    name: string
    source: IconSource
    line?: number
    context?: string
  }> {
    const iconUsages: Array<{ name: string; source: IconSource; line?: number; context?: string }> =
      []
    const lines = codeContent.split('\n')

    // Regex patterns for different icon usage patterns
    const patterns = [
      // <Icon name="..." source="..." />
      /<Icon\s+name=["']([^"']+)["']\s+source=["']([^"']+)["']/g,
      // <Icon name="..." />
      /<Icon\s+name=["']([^"']+)["']/g,
      // getIconByName("...")
      /getIconByName\(["']([^"']+)["']/g,
      // icon: "..."
      /icon:\s*["']([^"']+)["']/g,
    ]

    lines.forEach((line, lineIndex) => {
      patterns.forEach(pattern => {
        let match
        while ((match = pattern.exec(line)) !== null) {
          const name = match[1]
          const source = (match[2] as IconSource) || 'lucide'

          iconUsages.push({
            name,
            source,
            line: lineIndex + 1,
            context: line.trim(),
          })
        }
      })
    })

    return iconUsages
  }

  /**
   * Generate icon documentation
   */
  static generateDocumentation(): {
    lucideCount: number
    customCount: number
    totalCount: number
    lucideIcons: string[]
    customIcons: string[]
    examples: string
  } {
    const lucideIcons = this.iconLibrary.getAvailableIcons('lucide')
    const customIcons = this.iconLibrary.getAvailableIcons('custom')

    const examples = `
// Basic usage
<Icon name="plus" />
<Icon name="search" source="lucide" />
<Icon name="workflow" source="custom" />

// With props
<Icon name="settings" size={20} className="text-blue-500" />
<Icon name="close" strokeWidth={1.5} />

// Using the hook
const iconLibrary = useIconLibrary()
const hasIcon = iconLibrary.hasIcon('my-icon', 'custom')
const suggestions = iconLibrary.searchIcons('search')

// Direct component access
import { Plus, Search } from '@/lib/icons'
<Plus className="w-4 h-4" />
`

    return {
      lucideCount: lucideIcons.length,
      customCount: customIcons.length,
      totalCount: lucideIcons.length + customIcons.length,
      lucideIcons: lucideIcons.slice(0, 20), // Sample
      customIcons,
      examples,
    }
  }
}
