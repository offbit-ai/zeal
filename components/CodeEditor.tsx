'use client'

import React, { useRef, useEffect } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

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
  theme = 'light'
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Define custom theme with more comprehensive token rules
    monaco.editor.defineTheme('zeal-light', {
      base: 'vs',
      inherit: true,
      rules: [
        // Comments
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'comment.js', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'comment.python', foreground: '6B7280', fontStyle: 'italic' },
        
        // Strings
        { token: 'string', foreground: '059669' },
        { token: 'string.sql', foreground: '059669' },
        { token: 'string.yaml', foreground: '059669' },
        { token: 'string.escape', foreground: '0891B2' },
        { token: 'string.regexp', foreground: 'DC2626' },
        
        // Keywords
        { token: 'keyword', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'keyword.js', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'keyword.flow', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'keyword.json', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'keyword.python', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'keyword.sql', foreground: '7C3AED', fontStyle: 'bold' },
        
        // Storage types & modifiers
        { token: 'storage', foreground: '7C3AED' },
        { token: 'storage.type', foreground: '7C3AED' },
        { token: 'storage.modifier', foreground: '7C3AED' },
        
        // Numbers
        { token: 'number', foreground: 'DC2626' },
        { token: 'number.hex', foreground: 'DC2626' },
        { token: 'number.binary', foreground: 'DC2626' },
        { token: 'number.octal', foreground: 'DC2626' },
        
        // Constants
        { token: 'constant', foreground: 'DC2626' },
        { token: 'constant.language', foreground: 'DC2626' },
        { token: 'constant.numeric', foreground: 'DC2626' },
        
        // Functions & methods
        { token: 'entity.name.function', foreground: '2563EB' },
        { token: 'support.function', foreground: '2563EB' },
        { token: 'support.method', foreground: '2563EB' },
        
        // Variables
        { token: 'variable', foreground: '111827' },
        { token: 'variable.parameter', foreground: 'EA580C' },
        { token: 'variable.language', foreground: '7C3AED' },
        { token: 'variable.other', foreground: '111827' },
        
        // Types
        { token: 'entity.name.type', foreground: 'EA580C' },
        { token: 'entity.name.class', foreground: 'EA580C' },
        { token: 'entity.other.inherited-class', foreground: 'EA580C' },
        { token: 'support.type', foreground: 'EA580C' },
        { token: 'support.class', foreground: 'EA580C' },
        
        // Tags (HTML/JSX)
        { token: 'entity.name.tag', foreground: 'DC2626' },
        { token: 'entity.other.attribute-name', foreground: '2563EB' },
        
        // Operators
        { token: 'keyword.operator', foreground: '6B7280' },
        { token: 'keyword.operator.sql', foreground: '7C3AED' },
        
        // Punctuation
        { token: 'punctuation', foreground: '6B7280' },
        { token: 'punctuation.definition.string', foreground: '059669' },
        { token: 'punctuation.definition.comment', foreground: '6B7280' }
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#111827',
        'editor.lineHighlightBackground': '#F3F4F6',
        'editorLineNumber.foreground': '#9CA3AF',
        'editorIndentGuide.background': '#E5E7EB',
        'editor.selectionBackground': '#DBEAFE',
        'editorCursor.foreground': '#111827',
        'editorWhitespace.foreground': '#E5E7EB'
      }
    })

    monaco.editor.defineTheme('zeal-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // Comments
        { token: 'comment', foreground: '9CA3AF', fontStyle: 'italic' },
        { token: 'comment.js', foreground: '9CA3AF', fontStyle: 'italic' },
        { token: 'comment.python', foreground: '9CA3AF', fontStyle: 'italic' },
        
        // Strings
        { token: 'string', foreground: '34D399' },
        { token: 'string.sql', foreground: '34D399' },
        { token: 'string.yaml', foreground: '34D399' },
        { token: 'string.escape', foreground: '22D3EE' },
        { token: 'string.regexp', foreground: 'F87171' },
        
        // Keywords
        { token: 'keyword', foreground: 'A78BFA', fontStyle: 'bold' },
        { token: 'keyword.js', foreground: 'A78BFA', fontStyle: 'bold' },
        { token: 'keyword.flow', foreground: 'A78BFA', fontStyle: 'bold' },
        { token: 'keyword.json', foreground: 'A78BFA', fontStyle: 'bold' },
        { token: 'keyword.python', foreground: 'A78BFA', fontStyle: 'bold' },
        { token: 'keyword.sql', foreground: 'A78BFA', fontStyle: 'bold' },
        
        // Storage types & modifiers
        { token: 'storage', foreground: 'A78BFA' },
        { token: 'storage.type', foreground: 'A78BFA' },
        { token: 'storage.modifier', foreground: 'A78BFA' },
        
        // Numbers
        { token: 'number', foreground: 'F87171' },
        { token: 'number.hex', foreground: 'F87171' },
        { token: 'number.binary', foreground: 'F87171' },
        { token: 'number.octal', foreground: 'F87171' },
        
        // Constants
        { token: 'constant', foreground: 'F87171' },
        { token: 'constant.language', foreground: 'F87171' },
        { token: 'constant.numeric', foreground: 'F87171' },
        
        // Functions & methods
        { token: 'entity.name.function', foreground: '60A5FA' },
        { token: 'support.function', foreground: '60A5FA' },
        { token: 'support.method', foreground: '60A5FA' },
        
        // Variables
        { token: 'variable', foreground: 'F3F4F6' },
        { token: 'variable.parameter', foreground: 'FB923C' },
        { token: 'variable.language', foreground: 'A78BFA' },
        { token: 'variable.other', foreground: 'F3F4F6' },
        
        // Types
        { token: 'entity.name.type', foreground: 'FB923C' },
        { token: 'entity.name.class', foreground: 'FB923C' },
        { token: 'entity.other.inherited-class', foreground: 'FB923C' },
        { token: 'support.type', foreground: 'FB923C' },
        { token: 'support.class', foreground: 'FB923C' },
        
        // Tags (HTML/JSX)
        { token: 'entity.name.tag', foreground: 'F87171' },
        { token: 'entity.other.attribute-name', foreground: '60A5FA' },
        
        // Operators
        { token: 'keyword.operator', foreground: '9CA3AF' },
        { token: 'keyword.operator.sql', foreground: 'A78BFA' },
        
        // Punctuation
        { token: 'punctuation', foreground: '9CA3AF' },
        { token: 'punctuation.definition.string', foreground: '34D399' },
        { token: 'punctuation.definition.comment', foreground: '9CA3AF' }
      ],
      colors: {
        'editor.background': '#111827',
        'editor.foreground': '#F3F4F6',
        'editor.lineHighlightBackground': '#1F2937',
        'editorLineNumber.foreground': '#6B7280',
        'editorIndentGuide.background': '#374151',
        'editor.selectionBackground': '#312E81',
        'editorCursor.foreground': '#F3F4F6',
        'editorWhitespace.foreground': '#374151'
      }
    })

    // Apply theme
    monaco.editor.setTheme(theme === 'dark' ? 'zeal-dark' : 'zeal-light')

    // Set placeholder text if empty
    if (!value && placeholder) {
      const model = editor.getModel()
      if (model) {
        editor.setValue(placeholder)
        editor.setSelection({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: model.getLineCount(),
          endColumn: model.getLineMaxColumn(model.getLineCount())
        })
      }
    }

    // Focus editor
    editor.focus()
  }

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '')
  }

  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'zeal-dark' : 'zeal-light')
    }
  }, [theme])

  return (
    <div className="relative rounded-md border border-gray-200 overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          lineNumbers: lineNumbers ? 'on' : 'off',
          wordWrap: wordWrap ? 'on' : 'off',
          minimap: { enabled: minimap },
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          padding: { top: 8, bottom: 8 },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          lineDecorationsWidth: lineNumbers ? 10 : 0,
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
          matchBrackets: 'always',
          bracketPairColorization: {
            enabled: true
          },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoSurround: 'languageDefined',
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showClasses: true,
            showFunctions: true,
            showVariables: true
          }
        }}
      />
    </div>
  )
}