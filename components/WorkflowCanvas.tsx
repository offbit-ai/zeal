import { ReactNode } from 'react'

interface WorkflowCanvasProps {
  children: ReactNode
  className?: string
}

export function WorkflowCanvas({ children, className = '' }: WorkflowCanvasProps) {
  return (
    <div className={`relative bg-white rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Grid dots background */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
          opacity: 0.5
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}