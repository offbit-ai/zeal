/**
 * Node Renderer Registry
 *
 * Maps node template types to lazy-loaded React components, eliminating
 * the growing conditional chain in WorkflowNode.tsx.
 *
 * Built-in renderers are registered at module load time.
 * External renderers (ZIP-registered templates) can be added at runtime
 * via `registerRenderer()`.
 *
 * Usage in WorkflowNode:
 *   const Renderer = getNodeRenderer(metadata.type)
 *   return Renderer ? <Renderer {...props} /> : <DefaultNodeBody />
 */

import { type ComponentType, lazy } from 'react'
import type { NodeMetadata } from '@/types/workflow'

// ---------------------------------------------------------------------------
// Props contract — every renderer receives this, whether React or Web Component
// ---------------------------------------------------------------------------

export interface NodeRendererProps {
  nodeId: string
  metadata: NodeMetadata
  propertyValues: Record<string, any>
  isSelected: boolean
  onPropertyChange?: (name: string, value: any) => void
  onDataChange?: (data: any) => void
  onSizeChange?: () => void
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type LazyComponent = ComponentType<NodeRendererProps>

const registry = new Map<string, LazyComponent>()

/**
 * Register a renderer for a node type.
 * For built-ins, pass a lazy(() => import('...')) component.
 * For external plugins (Phase 2), this will accept Web Component wrappers.
 */
export function registerRenderer(nodeType: string, component: LazyComponent): void {
  registry.set(nodeType, component)
}

/**
 * Look up the renderer for a node type. Returns undefined if the type
 * should fall through to the default node body.
 */
export function getNodeRenderer(nodeType: string): LazyComponent | undefined {
  return registry.get(nodeType)
}

/**
 * Check whether a node type has a custom renderer registered.
 */
export function hasCustomRenderer(nodeType: string): boolean {
  return registry.has(nodeType)
}

/**
 * Check whether a node type is one that needs wider layout
 * (script editors, media nodes, input controls).
 */
export function needsExpandedLayout(nodeType: string): boolean {
  return expandedTypes.has(nodeType)
}

/**
 * Get the custom width for a node type, or undefined for default sizing.
 */
export function getNodeWidth(nodeType: string): string | undefined {
  return nodeWidths.get(nodeType)
}

// ---------------------------------------------------------------------------
// Width overrides per node type
// ---------------------------------------------------------------------------

const nodeWidths = new Map<string, string>([
  ['script', '400px'],
  ['image-input', '350px'],
  ['audio-input', '350px'],
  ['video-input', '350px'],
  ['image-stream-display', '350px'],
  ['audio-stream-display', '350px'],
  ['text-input', '280px'],
  ['number-input', '280px'],
  ['range-input', '280px'],
])

const expandedTypes = new Set<string>(nodeWidths.keys())

// ---------------------------------------------------------------------------
// Built-in renderer registrations (lazy-loaded)
// ---------------------------------------------------------------------------

registerRenderer(
  'script',
  lazy(() => import('@/components/node-renderers/ScriptRenderer'))
)

registerRenderer(
  'text-input',
  lazy(() => import('@/components/node-renderers/TextInputRenderer'))
)

registerRenderer(
  'number-input',
  lazy(() => import('@/components/node-renderers/NumberInputRenderer'))
)

registerRenderer(
  'range-input',
  lazy(() => import('@/components/node-renderers/RangeInputRenderer'))
)

registerRenderer(
  'image-input',
  lazy(() => import('@/components/node-renderers/ImageInputRenderer'))
)

registerRenderer(
  'audio-input',
  lazy(() => import('@/components/node-renderers/AudioInputRenderer'))
)

registerRenderer(
  'video-input',
  lazy(() => import('@/components/node-renderers/VideoInputRenderer'))
)

registerRenderer(
  'image-stream-display',
  lazy(() => import('@/components/node-renderers/ImageStreamRenderer'))
)

registerRenderer(
  'audio-stream-display',
  lazy(() => import('@/components/node-renderers/AudioStreamRenderer'))
)
