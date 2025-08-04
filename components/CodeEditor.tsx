'use client'

import React, { useEffect, useRef, useState } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css' // Dark theme with better contrast

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  placeholder?: string
  height?: string | number
  readOnly?: boolean
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  theme?: 'light' | 'dark'
}

export function CodeEditor({
  value,
  onChange,
  language,
  placeholder = '',
  height = 200,
  readOnly = false,
  lineNumbers = true,
  wordWrap = true,
  minimap = false,
  theme = 'dark',
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const codeRef = useRef<HTMLElement>(null)
  const [displayValue, setDisplayValue] = useState(value || placeholder)

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setDisplayValue(newValue)
    onChange(newValue)
  }

  // Apply syntax highlighting
  useEffect(() => {
    if (codeRef.current && displayValue) {
      // Clear previous highlighting
      codeRef.current.removeAttribute('data-highlighted')

      // Apply new highlighting
      if (language && hljs.getLanguage(language)) {
        try {
          const highlighted = hljs.highlight(displayValue, { language })
          codeRef.current.innerHTML = highlighted.value
        } catch (err) {
          // Fallback to plain text
          codeRef.current.textContent = displayValue
        }
      } else {
        codeRef.current.textContent = displayValue
      }
    }
  }, [displayValue, language])

  // Update display value when value prop changes
  useEffect(() => {
    setDisplayValue(value || placeholder)
  }, [value, placeholder])

  // Generate line numbers
  const lineCount = displayValue.split('\n').length
  const lineNumbersArray = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div
      className="relative rounded-md border border-gray-700 overflow-hidden bg-gray-900"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div className="relative h-full overflow-auto bg-gray-900">
        {lineNumbers && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gray-800 text-gray-500 text-xs text-right select-none">
            {lineNumbersArray.map(num => (
              <div key={num} className="pr-2 leading-6">
                {num}
              </div>
            ))}
          </div>
        )}

        <div className={`relative ${lineNumbers ? 'ml-12' : ''} bg-gray-900`}>
          {/* Syntax highlighted code display */}
          <pre className="absolute inset-0 px-2 m-0 overflow-visible pointer-events-none text-gray-100">
            <code
              ref={codeRef}
              className={`language-${language} hljs`}
              style={{
                background: 'transparent',
                padding: 0,
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordBreak: wordWrap ? 'break-word' : 'normal',
                fontSize: '12px',
                lineHeight: '1.5rem',
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }}
            >
              {displayValue}
            </code>
          </pre>

          {/* Invisible textarea for editing */}
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={handleChange}
            readOnly={readOnly}
            className="relative p-2 w-full h-full resize-none bg-transparent text-transparent caret-white outline-none"
            style={{
              minHeight: typeof height === 'number' ? `${height}px` : height,
              fontSize: '12px',
              lineHeight: '1.5rem',
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-word' : 'normal',
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>
    </div>
  )
}
