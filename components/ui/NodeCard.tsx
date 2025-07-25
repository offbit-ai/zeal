import React from 'react'
import { LucideIcon } from 'lucide-react'

interface NodeCardProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  variant?: 'dark' | 'medium' | 'light'
  className?: string
}

export function NodeCard({ 
  title, 
  subtitle, 
  icon: Icon,
  variant = 'dark',
  className = ''
}: NodeCardProps) {
  const variants = {
    dark: 'bg-black text-white',
    medium: 'bg-gray-700 text-white',
    light: 'bg-gray-100 text-gray-900'
  }

  return (
    <div className={`relative ${className}`}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${variants[variant]} min-w-[240px]`}>
        <div className="p-2.5 bg-white/10 rounded-md">
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-[13px] leading-tight">{title}</div>
          {subtitle && (
            <div className="text-[11px] opacity-70 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  )
}