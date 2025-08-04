'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CodeEditor } from './CodeEditor'

interface ResizableCodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  defaultHeight?: number
  onHeightChange?: (height: number) => void
  readOnly?: boolean
  lineNumbers?: boolean
  wordWrap?: boolean
  theme?: 'light' | 'dark'
}

export function ResizableCodeEditor({
  value,
  onChange,
  language,
  placeholder = '',
  minHeight = 100,
  maxHeight = 600,
  defaultHeight = 150,
  onHeightChange,
  readOnly = false,
  lineNumbers = true,
  wordWrap = true,
  theme = 'dark',
}: ResizableCodeEditorProps) {
  const [height, setHeight] = useState(defaultHeight)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const startHeightRef = useRef<number>(0)

  // Remove the automatic notification - we'll only notify on mouse up

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = height
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY))
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Notify parent that resize is complete
      onHeightChange?.(height)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minHeight, maxHeight])

  return (
    <div ref={containerRef} className="relative">
      <CodeEditor
        value={value}
        onChange={onChange}
        language={language}
        placeholder={placeholder}
        height={height}
        readOnly={readOnly}
        lineNumbers={lineNumbers}
        wordWrap={wordWrap}
        theme={theme}
        minimap={false}
      />

      {/* Resize handle */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center transition-colors ${
          isResizing ? 'bg-blue-500/20' : 'hover:bg-gray-700/50'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-12 h-1 bg-gray-600 rounded-full" />
      </div>
    </div>
  )
}
