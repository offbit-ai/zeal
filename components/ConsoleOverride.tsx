'use client'

import { useEffect } from 'react'
import { initializeConsoleOverride } from '@/utils/disableConsoleLogs'

export function ConsoleOverride() {
  useEffect(() => {
    initializeConsoleOverride()
  }, [])

  return null
}
