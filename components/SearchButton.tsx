import { Search } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface SearchButtonProps {
  onClick?: () => void
}

export function SearchButton({ onClick }: SearchButtonProps) {
  return (
    <div className="absolute left-4 top-4 z-20">
      <Tooltip content="Search (⌘K)" position="right">
        <button
          onClick={onClick}
          className="w-12 h-10 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center group cursor-pointer"
        >
          <Search
            className="w-4 h-4 text-gray-600 group-hover:text-gray-800 transition-colors"
            strokeWidth={1.5}
          />
        </button>
      </Tooltip>
    </div>
  )
}
