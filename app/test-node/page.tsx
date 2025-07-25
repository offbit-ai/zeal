'use client'

import { Database } from 'lucide-react'

export default function TestNode() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      {/* Single workflow node */}
      <div className="bg-black text-white px-4 py-3 rounded-lg flex items-center gap-3 min-w-[240px]">
        <div className="p-2.5 bg-white/10 rounded-md">
          <Database className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div>
          <div className="font-medium text-sm">Get Database</div>
          <div className="text-xs opacity-70">getAll: databasePage</div>
        </div>
      </div>
    </div>
  )
}