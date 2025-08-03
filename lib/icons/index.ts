import React from 'react'
import * as LucideIcons from 'lucide-react'
import { 
  LucideIcon, 
  LucideProps,
  // All icons that need to be explicitly imported for export
  // Navigation & UI
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Menu, Search, Settings,
  // Actions  
  Edit, Trash, Save, Upload, Download,
  // Status & Feedback
  Check, AlertCircle, Info, AlertTriangle,
  // Workflow & Nodes
  Play, Pause, Square, Box, Circle,
  // Data & Content
  Database, File, Folder, Code,
  // Communication
  Mail, MessageSquare,
  // Math & Logic
  Calculator, Plus, Minus, X, Divide, Percent, Equal, Radical, Sigma, ChartArea, AreaChart, PlusCircle, MinusCircle
} from 'lucide-react'

// Custom SVG icons
import { CustomSVGIcons } from './custom-svgs'
// Brand icons
import { FlatBrandIconRegistry, getBrandIcon } from './brand-icons'

/**
 * Icon source types
 */
export type IconSource = 'lucide' | 'custom' | 'brand'

/**
 * Icon component props
 */
export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string
  source?: IconSource
  fallback?: string
  className?: string
}

/**
 * Icon registry for mapping icon names to components
 */
interface IconRegistry {
  lucide: Record<string, LucideIcon>
  custom: Record<string, React.ComponentType<any>>
  brand: Record<string, React.ComponentType<any>>
}

/**
 * Icon library class for managing all application icons
 */
export class IconLibrary {
  private static instance: IconLibrary
  private registry: IconRegistry

  private constructor() {
    this.registry = {
      lucide: this.buildLucideRegistry(),
      custom: CustomSVGIcons,
      brand: FlatBrandIconRegistry
    }
    // // console.log removed.length,
    //   custom: Object.keys(this.registry.custom).length,
    //   brand: Object.keys(this.registry.brand).length
    // });
  }

  static getInstance(): IconLibrary {
    if (!IconLibrary.instance) {
      IconLibrary.instance = new IconLibrary()
    }
    return IconLibrary.instance
  }

  /**
   * Build the Lucide icon registry with name variations
   */
  private buildLucideRegistry(): Record<string, LucideIcon> {
    // // console.log removed
    // // console.log removed
    
    const registry: Record<string, LucideIcon> = {}
    const uniqueNames = new Set<string>()
    
    // Manually add the commonly used icons that we know work
    const knownIcons: Record<string, LucideIcon> = {
      'Activity': LucideIcons.Activity,
      'Airplay': LucideIcons.Airplay,
      'AlertCircle': LucideIcons.AlertCircle,
      'AlertTriangle': LucideIcons.AlertTriangle,
      'Archive': LucideIcons.Archive,
      'ArrowDown': LucideIcons.ArrowDown,
      'ArrowLeft': LucideIcons.ArrowLeft,
      'ArrowRight': LucideIcons.ArrowRight,
      'ArrowUp': LucideIcons.ArrowUp,
      'BarChart': LucideIcons.BarChart,
      'Bell': LucideIcons.Bell,
      'Book': LucideIcons.Book,
      'Bookmark': LucideIcons.Bookmark,
      'Box': LucideIcons.Box,
      'Calculator': LucideIcons.Calculator,
      'Calendar': LucideIcons.Calendar,
      'Camera': LucideIcons.Camera,
      'Check': LucideIcons.Check,
      'ChevronDown': LucideIcons.ChevronDown,
      'ChevronLeft': LucideIcons.ChevronLeft,
      'ChevronRight': LucideIcons.ChevronRight,
      'ChevronUp': LucideIcons.ChevronUp,
      'Circle': LucideIcons.Circle,
      'Clock': LucideIcons.Clock,
      'Cloud': LucideIcons.Cloud,
      'Code': LucideIcons.Code,
      'Coffee': LucideIcons.Coffee,
      'Command': LucideIcons.Command,
      'Copy': LucideIcons.Copy,
      'Cpu': LucideIcons.Cpu,
      'CreditCard': LucideIcons.CreditCard,
      'Database': LucideIcons.Database,
      'Download': LucideIcons.Download,
      'Edit': LucideIcons.Edit,
      'Eye': LucideIcons.Eye,
      'File': LucideIcons.File,
      'FileCode': LucideIcons.FileCode,
      'FileText': LucideIcons.FileText,
      'Filter': LucideIcons.Filter,
      'Folder': LucideIcons.Folder,
      'GitBranch': LucideIcons.GitBranch,
      'Globe': LucideIcons.Globe,
      'Grid': LucideIcons.Grid,
      'HardDrive': LucideIcons.HardDrive,
      'Heart': LucideIcons.Heart,
      'Home': LucideIcons.Home,
      'Image': LucideIcons.Image,
      'Inbox': LucideIcons.Inbox,
      'Info': LucideIcons.Info,
      'Key': LucideIcons.Key,
      'Layers': LucideIcons.Layers,
      'Layout': LucideIcons.Layout,
      'Link': LucideIcons.Link,
      'List': LucideIcons.List,
      'Lock': LucideIcons.Lock,
      'Mail': LucideIcons.Mail,
      'Map': LucideIcons.Map,
      'Menu': LucideIcons.Menu,
      'MessageCircle': LucideIcons.MessageCircle,
      'MessageSquare': LucideIcons.MessageSquare,
      'Mic': LucideIcons.Mic,
      'Monitor': LucideIcons.Monitor,
      'Moon': LucideIcons.Moon,
      'Music': LucideIcons.Music,
      'Network': LucideIcons.Network,
      'Package': LucideIcons.Package,
      'Pause': LucideIcons.Pause,
      'Phone': LucideIcons.Phone,
      'Play': LucideIcons.Play,
      'Plus': LucideIcons.Plus,
      'PlusCircle': LucideIcons.PlusCircle,
      'Power': LucideIcons.Power,
      'Printer': LucideIcons.Printer,
      'RefreshCw': LucideIcons.RefreshCw,
      'Repeat': LucideIcons.Repeat,
      'Save': LucideIcons.Save,
      'Search': LucideIcons.Search,
      'Send': LucideIcons.Send,
      'Server': LucideIcons.Server,
      'Settings': LucideIcons.Settings,
      'Share': LucideIcons.Share,
      'Shield': LucideIcons.Shield,
      'Shuffle': LucideIcons.Shuffle,
      'SkipBack': LucideIcons.SkipBack,
      'SkipForward': LucideIcons.SkipForward,
      'Smartphone': LucideIcons.Smartphone,
      'Square': LucideIcons.Square,
      'Star': LucideIcons.Star,
      'Sun': LucideIcons.Sun,
      'Tag': LucideIcons.Tag,
      'Target': LucideIcons.Target,
      'Terminal': LucideIcons.Terminal,
      'Trash': LucideIcons.Trash,
      'TrendingUp': LucideIcons.TrendingUp,
      'Truck': LucideIcons.Truck,
      'Tv': LucideIcons.Tv,
      'Type': LucideIcons.Type,
      'Unlock': LucideIcons.Unlock,
      'Upload': LucideIcons.Upload,
      'User': LucideIcons.User,
      'Users': LucideIcons.Users,
      'Video': LucideIcons.Video,
      'Volume2': LucideIcons.Volume2,
      'Wifi': LucideIcons.Wifi,
      'X': LucideIcons.X,
      'Zap': LucideIcons.Zap,
      'ZoomIn': LucideIcons.ZoomIn,
      'ZoomOut': LucideIcons.ZoomOut
    }
    
    // Add all known icons with variations
    Object.entries(knownIcons).forEach(([name, icon]) => {
      if (icon) {
        // Original PascalCase name
        registry[name] = icon
        
        // kebab-case version
        const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
        registry[kebabName] = icon
        uniqueNames.add(kebabName)
        
        // snake_case version
        const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
        registry[snakeName] = icon
        
        // lowercase version
        registry[name.toLowerCase()] = icon
      }
    })

    // // console.log removed.length} entries, ${uniqueNames.size} unique icons`);
    // // console.log removed.slice(0, 10));

    return registry
  }

  /**
   * Get an icon component by name and source
   */
  getIcon(name: string, source: IconSource = 'lucide'): React.ComponentType<any> | null {
    if (!name || typeof name !== 'string') {
      return null
    }

    const sourceRegistry = this.registry[source]
    if (!sourceRegistry) {
      return null
    }

    // Try exact match first
    if (sourceRegistry[name]) {
      return sourceRegistry[name]
    }

    // For Lucide icons, try name variations
    if (source === 'lucide') {
      // Try with different casing - with safety checks
      const variations = [
        name,
        name.toLowerCase(),
        name.charAt(0).toUpperCase() + name.slice(1),
        // Convert kebab-case to PascalCase
        name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(''),
        // Convert snake_case to PascalCase  
        name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
      ]

      for (const variation of variations) {
        if (variation && sourceRegistry[variation]) {
          return sourceRegistry[variation]
        }
      }
    }

    return null
  }

  /**
   * Check if an icon exists
   */
  hasIcon(name: string, source: IconSource = 'lucide'): boolean {
    return this.getIcon(name, source) !== null
  }

  /**
   * Get all available icon names for a source
   */
  getAvailableIcons(source: IconSource = 'lucide'): string[] {
    const registry = this.registry[source] || {};
    
    if (source === 'lucide') {
      // Return unique kebab-case icon names
      const uniqueNames = new Set<string>()
      
      Object.keys(registry).forEach(name => {
        // Only add kebab-case versions to avoid duplicates
        if (name.includes('-') && !name.includes('_')) {
          uniqueNames.add(name)
        }
      })
      
      return Array.from(uniqueNames).sort();
    }
    
    return Object.keys(registry);
  }

  /**
   * Search for icons by name pattern
   */
  searchIcons(query: string, source: IconSource = 'lucide', limit = 50): string[] {
    const available = this.getAvailableIcons(source)
    const normalizedQuery = query.toLowerCase()
    
    if (!query) {
      return available.slice(0, limit);
    }
    
    return available
      .filter(name => name.toLowerCase().includes(normalizedQuery))
      .slice(0, limit);
  }

  /**
   * Register a custom icon
   */
  registerCustomIcon(name: string, component: React.ComponentType<any>): void {
    this.registry.custom[name] = component
  }

  /**
   * Bulk register custom icons
   */
  registerCustomIcons(icons: Record<string, React.ComponentType<any>>): void {
    Object.assign(this.registry.custom, icons)
  }

  /**
   * Get fallback icon (default to Box from Lucide)
   */
  getFallbackIcon(): LucideIcon {
    return LucideIcons.Box
  }
}

/**
 * Icon component that handles both Lucide and custom SVG icons
 */
export const Icon: React.FC<IconProps> = ({ 
  name, 
  source = 'lucide', 
  fallback = 'box',
  className = '',
  ...props 
}) => {
  // Safety check for invalid icon names
  if (!name || typeof name !== 'string') {
    name = fallback
  }
  
  let IconComponent: React.ComponentType<any> | null = null

  // Handle brand icons explicitly
  if (source === 'brand') {
    IconComponent = getBrandIcon(name)
  }
  // Handle lucide icons with automatic brand fallback
  else if (source === 'lucide') {
    // Simple direct mapping for the most common icons
    const directMapping: Record<string, LucideIcon> = {
      'box': LucideIcons.Box,
      'circle': LucideIcons.Circle,
      'database': LucideIcons.Database,
      'code': LucideIcons.Code,
      'plus-circle': LucideIcons.PlusCircle,
      'brain': LucideIcons.Brain,
      'mail': LucideIcons.Mail,
      'search': LucideIcons.Search,
      'settings': LucideIcons.Settings,
      'folder': LucideIcons.Folder,
      'git-branch': LucideIcons.GitBranch,
      'git-graph': LucideIcons.GitGraph,
      'link': LucideIcons.Link,
      'shuffle': LucideIcons.Shuffle,
      'cloud': LucideIcons.Cloud,
      'cpu': LucideIcons.Cpu,
      'pencil-ruler': LucideIcons.PencilRuler,
      'calculator': LucideIcons.Calculator,
      'globe': LucideIcons.Globe,
      'layers': LucideIcons.Layers,
      'server': LucideIcons.Server,
      'message-square': LucideIcons.MessageSquare,
      'terminal': LucideIcons.Terminal,
      'wrench': LucideIcons.Wrench,
      // Math operation icons
      'plus': LucideIcons.Plus,
      'minus': LucideIcons.Minus,
      'x': LucideIcons.X,
      'divide': LucideIcons.Divide,
      'percent': LucideIcons.Percent,
      'equal': LucideIcons.Equal,
      'radical': LucideIcons.Radical || LucideIcons.Calculator,
      'sigma': LucideIcons.Sigma || LucideIcons.Calculator,
      'chevron-up': LucideIcons.ChevronUp,
      'chart-area': LucideIcons.ChartArea || LucideIcons.AreaChart
    }

    // Try direct mapping first
    IconComponent = directMapping[name]
    
    // If not found, try the icon library
    if (!IconComponent) {
      const iconLibrary = IconLibrary.getInstance()
      IconComponent = iconLibrary.getIcon(name, source) as LucideIcon
    }
    
    // If still not found, try brand icons as fallback
    if (!IconComponent) {
      IconComponent = getBrandIcon(name)
    }
  }
  // Handle custom icons
  else {
    const iconLibrary = IconLibrary.getInstance()
    IconComponent = iconLibrary.getIcon(name, source)
  }
  
  // Final fallback to Box if nothing found
  if (!IconComponent) {
    IconComponent = LucideIcons.Box
  }

  return React.createElement(IconComponent, {
    className,
    ...props
  })
}

/**
 * Hook for using the icon library
 */
export const useIconLibrary = () => {
  return IconLibrary.getInstance()
}

/**
 * Utility function to get an icon component (backward compatibility)
 */
export const getIconByName = (
  iconName: string, 
  fallback?: LucideIcon,
  source: IconSource = 'lucide'
): LucideIcon => {
  const iconLibrary = IconLibrary.getInstance()
  const icon = iconLibrary.getIcon(iconName, source)
  
  if (icon) {
    return icon as LucideIcon
  }
  
  return fallback || iconLibrary.getFallbackIcon()
}

// Export the singleton instance
export const iconLibrary = IconLibrary.getInstance()

// Export brand icon utilities
export { 
  BrandIcons, 
  getBrandIcon, 
  getBrandIconNames, 
  getBrandIconsByCategory, 
  searchBrandIcons 
} from './brand-icons'

// Export commonly used icons for convenience
export {
  // Navigation & UI
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  Settings,
  
  // Actions
  Edit,
  Trash,
  Save,
  Upload,
  Download,
  
  // Status & Feedback
  Check,
  AlertCircle,
  Info,
  AlertTriangle,
  
  // Workflow & Nodes
  Play,
  Pause,
  Square,
  Box,
  Circle,
  
  // Data & Content
  Database,
  File,
  Folder,
  Code,
  
  // Communication
  Mail,
  MessageSquare,
  
  // Math & Logic
  Calculator,
  Plus,
  Minus,
  X,
  Divide,
  Percent,
  Equal,
  Radical,
  Sigma,
  ChartArea,
  PlusCircle,
  MinusCircle,
  
} from 'lucide-react'