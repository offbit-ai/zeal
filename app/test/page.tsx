'use client'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">Tailwind CSS Test</h1>
      
      {/* Basic color test */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="h-20 bg-red-500 rounded-lg"></div>
        <div className="h-20 bg-blue-500 rounded-lg"></div>
        <div className="h-20 bg-green-500 rounded-lg"></div>
        <div className="h-20 bg-yellow-500 rounded-lg"></div>
      </div>

      {/* Button test */}
      <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-4">
        Test Button
      </button>

      {/* Card test */}
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
        <h2 className="text-xl font-semibold mb-2">Test Card</h2>
        <p className="text-gray-600">This is a test card to verify Tailwind CSS styling is working correctly.</p>
      </div>
    </div>
  )
}