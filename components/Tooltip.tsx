'use client'

import { ReactNode, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({ content, children, position = 'top', delay = 500 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isShowing, setIsShowing] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true)
      requestAnimationFrame(() => {
        setIsShowing(true)
      })
    }, delay)
    setTimeoutId(id)
  }

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsShowing(false)
    setTimeout(() => {
      setIsVisible(false)
    }, 150) // Match transition duration
  }

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      
      let x = 0
      let y = 0
      
      switch (position) {
        case 'top':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
          y = triggerRect.top - tooltipRect.height - 8
          break
        case 'bottom':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
          y = triggerRect.bottom + 8
          break
        case 'left':
          x = triggerRect.left - tooltipRect.width - 8
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
          break
        case 'right':
          x = triggerRect.right + 8
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
          break
      }
      
      setTooltipPosition({ x, y })
    }
  }, [isVisible, position])

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {children}
      </div>
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none transition-opacity duration-150"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            opacity: isShowing && tooltipPosition.x !== 0 ? 1 : 0
          }}
        >
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap relative">
            {content}
            <div 
              className={`absolute w-0 h-0 border-4 border-transparent ${
                position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-900' :
                position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900' :
                position === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-l-gray-900' :
                'right-full top-1/2 -translate-y-1/2 border-r-gray-900'
              }`}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}