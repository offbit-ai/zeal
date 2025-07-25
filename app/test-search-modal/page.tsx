'use client'

import { SearchModal } from '@/components/SearchModal'

export default function TestSearchModal() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="p-8 text-xl font-medium">Search Modal Test</h1>
      
      {/* Always show modal for testing */}
      <SearchModal 
        isOpen={true} 
        onClose={() => console.log('Close modal')} 
      />
    </div>
  )
}