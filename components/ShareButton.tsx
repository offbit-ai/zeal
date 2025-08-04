'use client'

import React, { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { toast } from '@/lib/toast'

interface ShareButtonProps {
  workflowId: string | null
}

export function ShareButton({ workflowId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = workflowId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/workflow?id=${workflowId}`
    : ''

  const handleShare = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Share link copied to clipboard!')

      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()

      try {
        document.execCommand('copy')
        setCopied(true)
        toast.success('Share link copied to clipboard!')
        setTimeout(() => setCopied(false), 3000)
      } catch (err) {
        toast.error('Failed to copy link')
      }

      document.body.removeChild(textArea)
    }
  }

  if (!workflowId) {
    return null
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg shadow-sm transition-all duration-300 ${
        copied
          ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white'
          : 'bg-white hover:bg-gray-50 border-gray-200'
      }`}
      title={copied ? 'Link copied!' : 'Copy share link'}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          <span className="text-sm font-medium">Share</span>
        </>
      )}
    </button>
  )
}
