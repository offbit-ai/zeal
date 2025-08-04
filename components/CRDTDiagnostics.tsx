'use client'

import { useEffect, useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { getRuntimeConfig, getCRDTServerUrl, isCollaborationEnabled } from '@/lib/config/runtime'

export function CRDTDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<Record<string, any>>({})
  const { isConnected, isSyncing, provider } = useWorkflowStore()

  useEffect(() => {
    // Collect diagnostic information
    const runtimeConfig = getRuntimeConfig()
    const diag = {
      // Environment variables
      CRDT_SERVER_URL_ENV: process.env.NEXT_PUBLIC_CRDT_SERVER_URL || 'NOT SET',
      ENABLE_COLLABORATION_ENV: process.env.NEXT_PUBLIC_ENABLE_COLLABORATION || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      
      // Runtime config
      RUNTIME_CONFIG: runtimeConfig,
      ACTUAL_CRDT_URL: getCRDTServerUrl(),
      COLLABORATION_ENABLED: isCollaborationEnabled(),
      
      // Connection state
      isConnected,
      isSyncing,
      hasProvider: !!provider,
      
      // WebSocket state
      socketConnected: provider?.socket?.connected || false,
      socketId: provider?.socket?.id || 'NO SOCKET',
      
      // Browser info
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      
      // Session storage
      userId: typeof window !== 'undefined' ? sessionStorage.getItem('userId') : 'SSR',
      userName: typeof window !== 'undefined' ? sessionStorage.getItem('userName') : 'SSR',
    }
    
    setDiagnostics(diag)
    
    // Log to console for debugging
    console.error('[CRDT Diagnostics]', diag)
  }, [isConnected, isSyncing, provider])

  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && !window.location.search.includes('debug=true')) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-md">
      <h3 className="font-bold mb-2">CRDT Diagnostics</h3>
      <pre className="whitespace-pre-wrap">
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
    </div>
  )
}