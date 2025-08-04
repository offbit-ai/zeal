'use client'

import React, { useState, useMemo } from 'react'
import { Icon, useIconLibrary, IconSource } from './index'
import { Search, Copy, Check } from 'lucide-react'

interface IconBrowserProps {
  className?: string
  onIconSelect?: (iconName: string, source: IconSource) => void
}

/**
 * Icon Browser component for discovering and selecting icons
 */
export const IconBrowser: React.FC<IconBrowserProps> = ({ className = '', onIconSelect }) => {
  const iconLibrary = useIconLibrary()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSource, setActiveSource] = useState<IconSource>('lucide')
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null)

  // Get filtered icons based on search query
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return iconLibrary.getAvailableIcons(activeSource).slice(0, 100) // Limit for performance
    }
    return iconLibrary.searchIcons(searchQuery, activeSource, 100)
  }, [searchQuery, activeSource, iconLibrary])

  // Handle icon click
  const handleIconClick = (iconName: string) => {
    onIconSelect?.(iconName, activeSource)
  }

  // Handle copy to clipboard
  const handleCopyIcon = async (iconName: string) => {
    const codeSnippet = `<Icon name="${iconName}" source="${activeSource}" />`

    try {
      await navigator.clipboard.writeText(codeSnippet)
      setCopiedIcon(iconName)
      setTimeout(() => setCopiedIcon(null), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  // Get icon count for each source
  const lucideCount = iconLibrary.getAvailableIcons('lucide').length
  const customCount = iconLibrary.getAvailableIcons('custom').length

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Icon Library</h3>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search icons..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Source Tabs */}
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveSource('lucide')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeSource === 'lucide'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Lucide ({lucideCount})
          </button>
          <button
            onClick={() => setActiveSource('custom')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeSource === 'custom'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Custom ({customCount})
          </button>
        </div>
      </div>

      {/* Icon Grid */}
      <div className="p-4">
        {filteredIcons.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon name="search" className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No icons found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
            {filteredIcons.map(iconName => (
              <IconCard
                key={iconName}
                iconName={iconName}
                source={activeSource}
                onClick={() => handleIconClick(iconName)}
                onCopy={() => handleCopyIcon(iconName)}
                isCopied={copiedIcon === iconName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
        <p>
          Showing {filteredIcons.length} of {iconLibrary.getAvailableIcons(activeSource).length}{' '}
          icons
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      </div>
    </div>
  )
}

/**
 * Individual icon card component
 */
interface IconCardProps {
  iconName: string
  source: IconSource
  onClick: () => void
  onCopy: () => void
  isCopied: boolean
}

const IconCard: React.FC<IconCardProps> = ({ iconName, source, onClick, onCopy, isCopied }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="relative group aspect-square border border-gray-200 rounded-md hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      title={iconName}
    >
      {/* Icon */}
      <div className="flex items-center justify-center h-full">
        <Icon
          name={iconName}
          source={source}
          className="w-5 h-5 text-gray-600 group-hover:text-blue-600"
        />
      </div>

      {/* Copy button */}
      {isHovered && (
        <button
          onClick={e => {
            e.stopPropagation()
            onCopy()
          }}
          className="absolute top-0.5 right-0.5 p-1 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors"
          title="Copy code"
        >
          {isCopied ? (
            <Check className="w-3 h-3 text-green-600" />
          ) : (
            <Copy className="w-3 h-3 text-gray-500" />
          )}
        </button>
      )}

      {/* Icon name tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {iconName}
      </div>
    </div>
  )
}

/**
 * Standalone Icon Browser Page Component
 */
export const IconBrowserPage: React.FC = () => {
  const [selectedIcon, setSelectedIcon] = useState<{ name: string; source: IconSource } | null>(
    null
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Icon Library</h1>
          <p className="text-gray-600">
            Browse and discover icons from Lucide and our custom collection. Click to select, hover
            and click the copy button to get the code.
          </p>
        </div>

        {/* Selected Icon Display */}
        {selectedIcon && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Icon:</h3>
            <div className="flex items-center gap-3">
              <Icon
                name={selectedIcon.name}
                source={selectedIcon.source}
                className="w-6 h-6 text-gray-800"
              />
              <span className="font-mono text-sm text-gray-600">{selectedIcon.name}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {selectedIcon.source}
              </span>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded border font-mono text-xs text-gray-700">
              {`<Icon name="${selectedIcon.name}" source="${selectedIcon.source}" />`}
            </div>
          </div>
        )}

        {/* Icon Browser */}
        <IconBrowser onIconSelect={(name, source) => setSelectedIcon({ name, source })} />
      </div>
    </div>
  )
}
