import { Search, X, SwatchBook, Bot, SquareTerminal, FolderPlus } from 'lucide-react'
import { useState, useEffect } from 'react'

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  badge?: {
    text: string
    color: 'blue' | 'yellow' | 'gray'
  }
  shortcut?: string
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Force a reflow to ensure the initial state is applied
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setSearchQuery('') // Reset search on close
      }, 200) // Match transition duration
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const recentSearches: SearchItem[] = [
    {
      id: '1',
      title: 'Notion / create-page',
      icon: <div className="w-5 h-5 bg-black text-white rounded text-sm flex items-center justify-center font-bold">N</div>,
      badge: { text: 'TOOL', color: 'blue' }
    },
    {
      id: '2',
      title: 'Notion',
      icon: <div className="w-5 h-5 bg-black text-white rounded text-sm flex items-center justify-center font-bold">N</div>,
      badge: { text: 'MCP', color: 'yellow' }
    },
    {
      id: '3',
      title: 'Install tool',
      icon: <SwatchBook className="w-5 h-5 text-gray-600" strokeWidth={1.5} />,
      shortcut: '⌘T'
    },
    {
      id: '4',
      title: 'Install agent',
      icon: <Bot className="w-5 h-5 text-gray-600" strokeWidth={1.5} />,
      shortcut: '⌘A'
    },
    {
      id: '5',
      title: 'Add new script',
      icon: <SquareTerminal className="w-5 h-5 text-gray-600" strokeWidth={1.5} />,
      shortcut: '⌘⇧S'
    },
    {
      id: '6',
      title: 'Add new asset',
      icon: <FolderPlus className="w-5 h-5 text-gray-600" strokeWidth={1.5} />,
      shortcut: '⌘F'
    }
  ]

  const badgeColors = {
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    gray: 'bg-gray-100 text-gray-700'
  }

  if (!isVisible) return null

  return (
    <div 
      className={`fixed inset-0 flex items-start justify-center pt-[15vh] z-50 transition-colors duration-200 ease-out ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 transition-all duration-200 ease-out transform ${
          isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <Search className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Browse plugins, assets, scripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 outline-none text-sm placeholder-gray-400"
            autoFocus
          />
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border">+</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border">S</kbd>
          </div>
        </div>

        {/* Recent searches */}
        <div className="p-2">
          <div className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Recent searches
          </div>
          <div className="space-y-1">
            {recentSearches.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer group"
              >
                {item.icon}
                <div className="flex-1 text-sm text-gray-900">
                  {item.title}
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${badgeColors[item.badge.color]}`}>
                      {item.badge.text}
                    </span>
                  )}
                  {item.shortcut && (
                    <span className="text-xs text-gray-400 font-mono">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}