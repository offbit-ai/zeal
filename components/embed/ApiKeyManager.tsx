'use client'

import { useState, useEffect } from 'react'
import { Key, Copy, Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import { ToastManager } from '@/components/Toast'

interface ApiKey {
  id: string
  name: string
  description?: string
  keyPreview: string
  permissions: any
  createdAt: string
  lastUsedAt?: string
  usageCount: number
  isActive: boolean
  expiresAt?: string
}

interface ApiKeyManagerProps {
  workflowId: string
}

export function ApiKeyManager({ workflowId }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    description: '',
    permissions: {
      canAddNodes: true,
      canEditNodes: false,
      canDeleteNodes: false,
      canAddGroups: true,
      canEditGroups: false,
      canDeleteGroups: false,
      canExecute: false,
      canViewWorkflow: true,
      canExportData: false,
    },
  })
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    fetchApiKeys()
  }, [workflowId])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/embed/api-keys`)
      if (!response.ok) throw new Error('Failed to fetch API keys')
      const data = await response.json()
      setApiKeys(data.apiKeys)
    } catch (error) {
      console.error('Error fetching API keys:', error)
      ToastManager.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const createApiKey = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/embed/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKeyData),
      })

      if (!response.ok) throw new Error('Failed to create API key')

      const data = await response.json()
      setCreatedKey(data.plainKey)
      ToastManager.success('API key created successfully')

      // Refresh the list
      fetchApiKeys()

      // Reset form but keep modal open to show the key
      setNewKeyData({
        name: '',
        description: '',
        permissions: {
          canAddNodes: true,
          canEditNodes: false,
          canDeleteNodes: false,
          canAddGroups: true,
          canEditGroups: false,
          canDeleteGroups: false,
          canExecute: false,
          canViewWorkflow: true,
          canExportData: false,
        },
      })
    } catch (error) {
      console.error('Error creating API key:', error)
      ToastManager.error('Failed to create API key')
    }
  }

  const revokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}/embed/api-keys/${keyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to revoke API key')

      ToastManager.success('API key revoked')
      fetchApiKeys()
    } catch (error) {
      console.error('Error revoking API key:', error)
      ToastManager.error('Failed to revoke API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    ToastManager.success('Copied to clipboard')
  }

  if (loading) {
    return <div className="animate-pulse">Loading API keys...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">API Keys</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No API keys yet</p>
          <p className="text-sm">Create an API key to allow 3rd party access</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map(key => (
            <div
              key={key.id}
              className={`border rounded-lg p-4 ${
                key.isActive ? 'border-gray-200' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{key.name}</h4>
                    {!key.isActive && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        Revoked
                      </span>
                    )}
                  </div>
                  {key.description && (
                    <p className="text-sm text-gray-600 mt-1">{key.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>ID: {key.keyPreview}</span>
                    <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && (
                      <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    )}
                    <span>Usage: {key.usageCount}</span>
                  </div>
                </div>
                {key.isActive && (
                  <button
                    onClick={() => revokeApiKey(key.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Revoke API key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <details className="mt-3">
                <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-700">
                  View permissions
                </summary>
                <div className="mt-2 pl-4 text-sm space-y-1">
                  {Object.entries(key.permissions).map(([perm, value]) => (
                    <div key={perm} className="flex items-center gap-2">
                      <span className={value ? 'text-green-600' : 'text-gray-400'}>
                        {value ? '✓' : '✗'}
                      </span>
                      <span className="text-gray-600">{perm}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">
              {createdKey ? 'API Key Created' : 'Create API Key'}
            </h3>

            {createdKey ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-2">
                    Save this API key securely. It will not be shown again.
                  </p>
                  <div className="flex items-center gap-2 bg-white border rounded p-2 font-mono text-sm">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={createdKey}
                      readOnly
                      className="flex-1 bg-transparent outline-none"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreatedKey(null)
                    setShowKey(false)
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  createApiKey()
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newKeyData.name}
                    onChange={e => setNewKeyData({ ...newKeyData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Production API Key"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description (optional)</label>
                  <textarea
                    value={newKeyData.description}
                    onChange={e => setNewKeyData({ ...newKeyData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Used for customer dashboard integration"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Permissions</label>
                  <div className="space-y-2">
                    {Object.entries(newKeyData.permissions).map(([perm, value]) => (
                      <label key={perm} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={e =>
                            setNewKeyData({
                              ...newKeyData,
                              permissions: {
                                ...newKeyData.permissions,
                                [perm]: e.target.checked,
                              },
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreatedKey(null)
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
