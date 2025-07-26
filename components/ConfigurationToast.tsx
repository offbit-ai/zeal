import { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import { getConfigurationMessage } from '@/utils/nodeConfigurationStatus'
import { NodeMetadata } from '@/types/workflow'

interface ConfigurationToastProps {
  nodeMetadata: NodeMetadata
  onConfigure: () => void
  onDismiss: () => void
}

export function ConfigurationToast({ nodeMetadata, onConfigure, onDismiss }: ConfigurationToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    // Animate in after a short delay
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])
  
  const message = getConfigurationMessage(nodeMetadata)
  
  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300) // Wait for animation to complete
  }
  
  return (
    <div className={`fixed bottom-4 right-4 max-w-sm bg-white border border-orange-200 rounded-lg shadow-lg p-4 transition-all duration-300 ease-out z-50 ${
      isVisible ? 'transform translate-y-0 opacity-100' : 'transform translate-y-2 opacity-0'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
          <Settings className="w-4 h-4 text-orange-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 mb-1">
            Configure {nodeMetadata.title}
          </div>
          <div className="text-sm text-gray-600">
            {message}
          </div>
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={onConfigure}
              className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-md hover:bg-orange-700 transition-colors font-medium"
            >
              Configure Now
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  )
}