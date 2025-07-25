import { LucideIcon } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface SidebarCategory {
  title: string
  items: SidebarItem[]
}

interface SidebarItem {
  id: string
  title: string
  icon: LucideIcon
  description?: string
}

interface WorkflowSidebarProps {
  categories: SidebarCategory[]
  isCollapsed?: boolean
}

export function WorkflowSidebar({ categories, isCollapsed = false }: WorkflowSidebarProps) {
  if (isCollapsed) {
    // Collapsed floating sidebar - show only icons
    return (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
        <div className="p-2">
          {categories.map((category) => 
            category.items.map((item) => (
              <Tooltip key={item.id} content={item.title} position="right">
                <div
                  className="flex items-center justify-center w-8 h-8 mb-2 last:mb-0 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                  draggable
                >
                  <item.icon className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                </div>
              </Tooltip>
            ))
          )}
        </div>
      </div>
    )
  }

  // Expanded floating sidebar - show full content
  return (
    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-64 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
      <div className="p-4">
        {categories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="mb-6 last:mb-0">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              {category.title}
            </h3>
            <div className="space-y-1">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  draggable
                >
                  <div className="p-1.5 bg-gray-100 rounded-md">
                    <item.icon className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}