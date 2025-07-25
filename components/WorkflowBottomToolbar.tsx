import { History, ListRestart } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface WorkflowBottomToolbarProps {
  onHistoryClick?: () => void
  onDebuggerClick?: () => void
}

export function WorkflowBottomToolbar({ 
  onHistoryClick,
  onDebuggerClick 
}: WorkflowBottomToolbarProps) {
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 flex items-center gap-3 z-20 w-fit">
      <Tooltip content="History" position="top">
        <button 
          className="flex items-center justify-center w-8 h-8 text-gray-900 hover:text-black transition-colors cursor-pointer"
          onClick={onHistoryClick}
        >
          <History className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </Tooltip>
      
      <div className="w-px h-4 bg-gray-300"></div>
      
      <Tooltip content="Flow Trace Debugger" position="top">
        <button 
          className="flex items-center justify-center w-8 h-8 text-gray-900 hover:text-black transition-colors cursor-pointer"
          onClick={onDebuggerClick}
        >
          <ListRestart className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </Tooltip>
    </div>
  )
}