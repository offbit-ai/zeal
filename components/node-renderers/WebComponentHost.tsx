/**
 * WebComponentHost — React wrapper for externally-registered Web Components.
 *
 * Lifecycle:
 * 1. Reads display config from metadata (element tag, bundleId or inline source)
 * 2. Lazily loads the ES module (from /api/zip/components/ or Blob URL)
 * 3. Ensures customElements.define() is called exactly once per tag
 * 4. Renders the custom element inside a host div
 * 5. Forwards propertyValues as JS properties (not attributes)
 * 6. Listens for 'zeal:property-change' CustomEvents → onPropertyChange
 * 7. Listens for 'zeal:data-change' CustomEvents → onDataChange
 *
 * The Web Component receives:
 *   - nodeId (string)
 *   - metadata (object)
 *   - propertyValues (object)
 *   - isSelected (boolean)
 * as JS properties set imperatively.
 */

import { useRef, useEffect, useState } from 'react'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'
import type { DisplayComponent } from '@/data/nodeTemplates/types'

// Track which modules have been loaded and which tags have been defined
const loadedModules = new Set<string>()
const pendingLoads = new Map<string, Promise<void>>()

/**
 * Load a Web Component module from bundleId or inline source.
 * Idempotent — calling multiple times for the same tag is safe.
 */
async function ensureComponentLoaded(display: DisplayComponent): Promise<void> {
  const key = display.element

  // Already loaded
  if (loadedModules.has(key)) return

  // Loading in progress — wait for existing promise
  if (pendingLoads.has(key)) {
    return pendingLoads.get(key)
  }

  const loadPromise = (async () => {
    try {
      let moduleUrl: string

      if (display.bundleId) {
        // Served same-origin from Zeal's API
        const namespace = display.bundleId.includes('/')
          ? display.bundleId.split('/')[0]
          : '_default'
        const id = display.bundleId.includes('/')
          ? display.bundleId.split('/').slice(1).join('/')
          : display.bundleId
        moduleUrl = `/api/zip/components/${namespace}/${id}`
      } else if (display.source) {
        // Inline source — create a Blob URL (same-origin, no CORS)
        const blob = new Blob([display.source], { type: 'application/javascript' })
        moduleUrl = URL.createObjectURL(blob)
      } else {
        console.warn(`[WebComponentHost] No bundle or source for <${display.element}>`)
        return
      }

      // Dynamic import — works with both real URLs and blob URLs
      await import(/* webpackIgnore: true */ moduleUrl)

      // If the module didn't self-register (some authors forget), check
      if (!customElements.get(display.element)) {
        console.warn(
          `[WebComponentHost] Module loaded but <${display.element}> was not defined. ` +
          `Ensure the module calls customElements.define('${display.element}', ...).`
        )
      }

      loadedModules.add(key)
    } catch (err) {
      console.error(`[WebComponentHost] Failed to load <${display.element}>:`, err)
    }
  })()

  pendingLoads.set(key, loadPromise)
  await loadPromise
  pendingLoads.delete(key)
}

export default function WebComponentHost({
  nodeId,
  metadata,
  propertyValues,
  isSelected,
  onPropertyChange,
  onDataChange,
}: NodeRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const display = (metadata as any).display as DisplayComponent | undefined

  // Load the module and mount the custom element
  useEffect(() => {
    if (!display?.element || !hostRef.current) return

    let cancelled = false

    ensureComponentLoaded(display).then(() => {
      if (cancelled || !hostRef.current) return

      // Create or re-use the custom element
      if (!elementRef.current) {
        const el = document.createElement(display.element)

        if (display.shadow !== false) {
          // The Web Component itself should attachShadow in its constructor.
          // We just mount it — shadow DOM is the component author's responsibility.
        }

        hostRef.current.appendChild(el)
        elementRef.current = el
      }

      setLoaded(true)
    }).catch(() => {
      if (!cancelled) setError(`Failed to load <${display.element}>`)
    })

    return () => {
      cancelled = true
    }
  }, [display?.element, display?.bundleId, display?.source])

  // Forward props as JS properties whenever they change
  useEffect(() => {
    const el = elementRef.current
    if (!el || !loaded) return

    // Set core properties
    ;(el as any).nodeId = nodeId
    ;(el as any).metadata = metadata
    ;(el as any).propertyValues = propertyValues
    ;(el as any).isSelected = isSelected

    // Forward observed props individually for fine-grained reactivity
    if (display?.observedProps) {
      for (const prop of display.observedProps) {
        if (prop in propertyValues) {
          ;(el as any)[prop] = propertyValues[prop]
        }
      }
    }
  }, [nodeId, metadata, propertyValues, isSelected, loaded, display?.observedProps])

  // Listen for custom events from the Web Component
  useEffect(() => {
    const el = elementRef.current
    if (!el || !loaded) return

    const handlePropertyChange = (e: Event) => {
      const { name, value } = (e as CustomEvent).detail || {}
      if (name) onPropertyChange?.(name, value)
    }

    const handleDataChange = (e: Event) => {
      const data = (e as CustomEvent).detail
      onDataChange?.(data)
    }

    el.addEventListener('zeal:property-change', handlePropertyChange)
    el.addEventListener('zeal:data-change', handleDataChange)

    return () => {
      el.removeEventListener('zeal:property-change', handlePropertyChange)
      el.removeEventListener('zeal:data-change', handleDataChange)
    }
  }, [loaded, onPropertyChange, onDataChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elementRef.current && hostRef.current?.contains(elementRef.current)) {
        hostRef.current.removeChild(elementRef.current)
      }
      elementRef.current = null
    }
  }, [])

  if (error) {
    return (
      <div className="w-full mt-3 px-3 py-2 text-xs text-red-400 bg-red-900/20 rounded">
        {error}
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className="w-full mt-3"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    />
  )
}
