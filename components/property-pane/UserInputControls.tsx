import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

interface TextInputControlProps {
  defaultValue: string
  placeholder: string
  multiline: boolean
  maxLength?: number
  validation: 'none' | 'email' | 'url' | 'alphanumeric' | 'regex'
  validationPattern?: string
  onValueChange?: (value: string) => void
}

export function TextInputControl({
  defaultValue,
  placeholder,
  multiline,
  maxLength,
  validation,
  validationPattern,
  onValueChange,
}: TextInputControlProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)

  const validateInput = (input: string): boolean => {
    switch (validation) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
      case 'url':
        try {
          new URL(input)
          return true
        } catch {
          return false
        }
      case 'alphanumeric':
        return /^[a-zA-Z0-9]+$/.test(input)
      case 'regex':
        if (validationPattern) {
          try {
            const regex = new RegExp(validationPattern)
            return regex.test(input)
          } catch {
            setError('Invalid regex pattern')
            return false
          }
        }
        return true
      default:
        return true
    }
  }

  const handleChange = (value: string) => {
    setValue(value)

    if (maxLength && value.length > maxLength) {
      setError(`Maximum ${maxLength} characters allowed`)
      return
    }

    if (validation !== 'none' && value && !validateInput(value)) {
      setError(`Invalid ${validation} format`)
    } else {
      setError(null)
      onValueChange?.(value)
    }
  }

  if (multiline) {
    return (
      <div className="w-full">
        <textarea
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          rows={4}
        />
        {error && (
          <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <input
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 border text-black bg-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && (
        <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

interface NumberInputControlProps {
  defaultValue: number
  min?: number
  max?: number
  step: number
  format: 'decimal' | 'integer' | 'currency' | 'percentage' | 'scientific'
  decimals: number
  onValueChange?: (value: number) => void
}

export function NumberInputControl({
  defaultValue,
  min,
  max,
  step,
  format,
  decimals,
  onValueChange,
}: NumberInputControlProps) {
  const [value, setValue] = useState(defaultValue)
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState(defaultValue.toString())

  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatDisplay(value))
    }
  }, [value, format, decimals, isFocused])

  const formatDisplay = (num: number): string => {
    switch (format) {
      case 'integer':
        return Math.round(num).toString()
      case 'currency':
        return `$${num.toFixed(decimals)}`
      case 'percentage':
        return `${(num * 100).toFixed(decimals)}%`
      case 'scientific':
        return num.toExponential(decimals)
      default:
        return num.toFixed(decimals)
    }
  }

  const parseFormattedValue = (formattedValue: string): number | null => {
    // Remove currency symbols and percentage signs
    const cleanValue = formattedValue.replace(/[$%]/g, '').trim()

    if (format === 'percentage') {
      const parsed = parseFloat(cleanValue)
      return isNaN(parsed) ? null : parsed / 100
    }

    const parsed = parseFloat(cleanValue)
    return isNaN(parsed) ? null : parsed
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value
    setInputValue(inputVal)

    const parsedValue = parseFormattedValue(inputVal)
    if (parsedValue !== null) {
      const clampedValue = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsedValue))
      setValue(clampedValue)
      onValueChange?.(clampedValue)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    setInputValue(value.toString())
  }

  const handleBlur = () => {
    setIsFocused(false)
    setInputValue(formatDisplay(value))
  }

  return (
    <div className="w-full">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full px-3 py-2 border bg-white border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

interface RangeInputControlProps {
  defaultValue: number
  min: number
  max: number
  step: number
  showValue: boolean
  showLabels: boolean
  unit: string
  onValueChange?: (value: number) => void
}

export function RangeInputControl({
  defaultValue,
  min,
  max,
  step,
  showValue,
  showLabels,
  unit,
  onValueChange,
}: RangeInputControlProps) {
  const [value, setValue] = useState(defaultValue)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setValue(newValue)
    onValueChange?.(newValue)
  }

  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="w-full">
      {showValue && (
        <div className="text-center mb-2">
          <span className="text-lg font-semibold">
            {value}
            {unit && ` ${unit}`}
          </span>
        </div>
      )}

      <div className="relative">
        <input
          type="range"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          }}
        />

        {showLabels && (
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>
              {min}
              {unit && ` ${unit}`}
            </span>
            <span>
              {max}
              {unit && ` ${unit}`}
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #6366f1;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #6366f1;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          border: none;
        }
      `}</style>
    </div>
  )
}
