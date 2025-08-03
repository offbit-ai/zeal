'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Palette } from 'lucide-react'

interface UserSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userName: string, userColor: string) => void
}

const colorOptions = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#e11d48'
]

export function UserSettingsModal({ isOpen, onClose, onSave }: UserSettingsModalProps) {
  const [userName, setUserName] = useState('')
  const [userColor, setUserColor] = useState('#3b82f6')

  useEffect(() => {
    // Load saved settings
    const savedName = sessionStorage.getItem('userName') || 'Anonymous User'
    const savedColor = sessionStorage.getItem('userColor') || '#3b82f6'
    setUserName(savedName)
    setUserColor(savedColor)
  }, [isOpen])

  const handleSave = () => {
    const name = userName.trim() || 'Anonymous User'
    sessionStorage.setItem('userName', name)
    sessionStorage.setItem('userColor', userColor)
    sessionStorage.setItem('userId', `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)
    onSave(name, userColor)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="w-5 h-5" />
            User Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* User Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* User Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Color
            </label>
            <div className="grid grid-cols-6 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => setUserColor(color)}
                  className={`w-10 h-10 rounded-md border-2 ${
                    userColor === color ? 'border-gray-900' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600 mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: userColor }}
              >
                {(userName || 'A').charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{userName || 'Anonymous User'}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}