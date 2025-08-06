'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { WorkflowService } from '@/services/workflowService'
import { Loader2, Workflow, ArrowRight, Link2, Plus } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [workflowUrl, setWorkflowUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [apiHealth, setApiHealth] = useState<'checking' | 'healthy' | 'error'>('checking')
  const [apiError, setApiError] = useState<string | null>(null)

  // Check API health on mount
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        // Try to fetch workflows to check if API is working
        await WorkflowService.getWorkflows({ limit: 1 })
        setApiHealth('healthy')
      } catch (err) {
        console.error('API health check failed:', err)
        setApiHealth('error')
        if (err instanceof Error) {
          // Extract more meaningful error message
          if (err.message.includes('500')) {
            setApiError('Database connection error. Please check your configuration.')
          } else if (err.message.includes('Network') || err.message.includes('fetch')) {
            setApiError('Cannot connect to API server. Please check if the server is running.')
          } else {
            setApiError(err.message)
          }
        } else {
          setApiError('API is not available')
        }
      }
    }

    checkApiHealth()
  }, [])

  const createWorkflow = async () => {
    try {
      setIsCreating(true)
      setError(null)

      // Generate unique user if not exists
      if (typeof window !== 'undefined' && !sessionStorage.getItem('userId')) {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        const tabId = Math.random().toString(36).substring(2, 5)
        const userId = `user-${timestamp}-${random}-${tabId}`
        sessionStorage.setItem('userId', userId)

        // Generate user name
        const adjectives = ['Swift', 'Bright', 'Clever', 'Quick', 'Smart', 'Bold', 'Cool', 'Fast']
        const animals = ['Falcon', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Lion', 'Bear']
        const seed = userId.split('-')[1] || '0'
        const adjIndex = parseInt(seed.substring(0, 2), 36) % adjectives.length
        const animalIndex = parseInt(seed.substring(2, 4), 36) % animals.length
        const tabNumber = (parseInt(userId.split('-')[3] || '0', 36) % 99) + 1
        const userName = `${adjectives[adjIndex]} ${animals[animalIndex]} ${tabNumber}`
        sessionStorage.setItem('userName', userName)

        // Generate user color
        const colors = [
          '#ef4444',
          '#f59e0b',
          '#10b981',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#06b6d4',
          '#84cc16',
        ]
        let hash = 0
        for (let i = 0; i < userId.length; i++) {
          hash = userId.charCodeAt(i) + ((hash << 5) - hash)
        }
        const userColor = colors[Math.abs(hash) % colors.length]
        sessionStorage.setItem('sessionUserColor', userColor)
      }

      // Create a new workflow
      const workflow = await WorkflowStorageService.createDraftWorkflow('My Workflow')

      // Set as current workflow
      WorkflowStorageService.setCurrentWorkflowId(workflow.id)

      // Generate the URL
      const url = `/workflow?id=${workflow.id}`
      setWorkflowUrl(url)

      // Auto-redirect after a short delay
      setTimeout(() => {
        router.push(url)
      }, 2000)
    } catch (err) {
      console.error('Error creating workflow:', err)
      setError(err instanceof Error ? err.message : 'Failed to create workflow')
      setIsCreating(false)
    }
  }

  const handleManualRedirect = () => {
    if (workflowUrl) {
      router.push(workflowUrl)
    }
  }

  const handleJoinWorkflow = async () => {
    const workflowId = joinUrl.trim()

    if (!workflowId) {
      setError('Please enter a workflow ID.')
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      // Validate that the workflow exists
      const workflow = await WorkflowService.getWorkflow(workflowId)

      if (!workflow) {
        setError('Workflow not found. Please check the ID and try again.')
        setIsValidating(false)
        return
      }

      // Generate user identity if needed
      if (typeof window !== 'undefined' && !sessionStorage.getItem('userId')) {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        const tabId = Math.random().toString(36).substring(2, 5)
        const userId = `user-${timestamp}-${random}-${tabId}`
        sessionStorage.setItem('userId', userId)

        // Generate user name
        const adjectives = ['Swift', 'Bright', 'Clever', 'Quick', 'Smart', 'Bold', 'Cool', 'Fast']
        const animals = ['Falcon', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Lion', 'Bear']
        const seed = userId.split('-')[1] || '0'
        const adjIndex = parseInt(seed.substring(0, 2), 36) % adjectives.length
        const animalIndex = parseInt(seed.substring(2, 4), 36) % animals.length
        const tabNumber = (parseInt(userId.split('-')[3] || '0', 36) % 99) + 1
        const userName = `${adjectives[adjIndex]} ${animals[animalIndex]} ${tabNumber}`
        sessionStorage.setItem('userName', userName)

        // Generate user color
        const colors = [
          '#ef4444',
          '#f59e0b',
          '#10b981',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#06b6d4',
          '#84cc16',
        ]
        let hash = 0
        for (let i = 0; i < userId.length; i++) {
          hash = userId.charCodeAt(i) + ((hash << 5) - hash)
        }
        const userColor = colors[Math.abs(hash) % colors.length]
        sessionStorage.setItem('sessionUserColor', userColor)
      }

      // Redirect to the workflow
      router.push(`/workflow?id=${workflowId}`)
    } catch (err) {
      console.error('Error validating workflow:', err)
      setError('Failed to validate workflow. Please try again.')
      setIsValidating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Workflow className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            Welcome to Zeal Workflow Editor
          </h1>

          <p className="text-center text-gray-600 mb-8">
            Create a new workflow or join an existing one
          </p>

          {/* API Health Status */}
          {apiHealth === 'checking' && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <p className="text-sm text-blue-800">Checking API connection...</p>
              </div>
            </div>
          )}

          {apiHealth === 'error' && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-1">API Connection Error</p>
              <p className="text-sm text-red-700">{apiError}</p>
              <p className="text-xs text-red-600 mt-2">
                Please ensure the backend services are running and properly configured.
              </p>
            </div>
          )}

          {!isCreating && !workflowUrl && !showJoinForm && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setError(null)
                  createWorkflow()
                }}
                disabled={apiHealth !== 'healthy'}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Create New Workflow
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setError(null)
                  setShowJoinForm(true)
                }}
                disabled={apiHealth !== 'healthy'}
                className="w-full bg-white text-gray-700 border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <Link2 className="w-5 h-5" />
                Join Existing Workflow
              </button>
            </div>
          )}

          {!isCreating && !workflowUrl && showJoinForm && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="workflow-id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Workflow ID
                </label>
                <input
                  id="workflow-id"
                  type="text"
                  value={joinUrl}
                  onChange={e => setJoinUrl(e.target.value)}
                  placeholder="e.g., workflow-123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isValidating}
                />
                <p className="mt-1 text-xs text-gray-500">Enter the workflow ID shared with you</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleJoinWorkflow}
                  disabled={!joinUrl.trim() || isValidating}
                  className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Join Workflow
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowJoinForm(false)
                    setJoinUrl('')
                    setError(null)
                  }}
                  disabled={isValidating}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && !workflowUrl && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isCreating && !workflowUrl && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">Creating your workflow...</p>
            </div>
          )}

          {workflowUrl && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 text-center">Workflow created successfully!</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2">Your workflow URL:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block overflow-x-auto">
                  {window.location.origin}
                  {workflowUrl}
                </code>
              </div>

              <button
                onClick={handleManualRedirect}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                Go to Workflow Editor
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-gray-500 text-center">
                Redirecting automatically in a moment...
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Each workflow has a unique URL that you can bookmark and share.
          </p>
        </div>
      </div>
    </div>
  )
}
