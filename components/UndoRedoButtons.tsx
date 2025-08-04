import { Undo2, Redo2 } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface UndoRedoButtonsProps {
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function UndoRedoButtons({
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
}: UndoRedoButtonsProps) {
  return (
    <div className="absolute right-4 top-4 flex gap-2 z-20">
      <Tooltip content="Undo (⌘Z)" position="bottom">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Undo2
            className="w-4 h-4 text-gray-600 group-hover:text-gray-800 group-disabled:text-gray-400 transition-colors"
            strokeWidth={1.5}
          />
        </button>
      </Tooltip>

      <Tooltip content="Redo (⌘⇧Z)" position="bottom">
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Redo2
            className="w-4 h-4 text-gray-600 group-hover:text-gray-800 group-disabled:text-gray-400 transition-colors"
            strokeWidth={1.5}
          />
        </button>
      </Tooltip>
    </div>
  )
}
