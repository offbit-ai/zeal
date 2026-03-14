# Node Renderer Plugin System

Zeal's node renderer plugin system allows custom visual components to be embedded inside workflow nodes. Built-in nodes (script editors, media inputs, stream displays) use the same system as externally-registered plugins — there is no special-case rendering.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  WorkflowNode.tsx  (thin shell — shape, ports, chrome)  │
│                                                         │
│  const Renderer = getNodeRenderer(type, metadata)       │
│  return Renderer ? <Suspense><Renderer /></Suspense>    │
│                  : <DefaultNodeBody />                  │
└────────────────────────────┬────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │   NodeRendererRegistry      │
              │   Map<type, LazyComponent>  │
              └──────┬──────────────┬───────┘
                     │              │
          Built-in renderers   WebComponentHost
          (React, lazy-loaded)  (for external plugins)
```

### Resolution Order

1. If `metadata.display.element` exists → **WebComponentHost** (Web Component bridge)
2. If `registry.get(metadata.type)` exists → **Built-in renderer** (lazy React component)
3. Otherwise → **Default node body** (icon + title + subtitle)

---

## For Internal Contributors

### Adding a New Built-in Node Renderer

1. Create a renderer component in `components/node-renderers/`:

```tsx
// components/node-renderers/ChartRenderer.tsx
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function ChartRenderer({ propertyValues, nodeId }: NodeRendererProps) {
  return (
    <div className="w-full mt-3" onClick={e => e.stopPropagation()}>
      {/* Your rendering logic */}
    </div>
  )
}
```

2. Register it in `lib/node-renderer-registry.ts`:

```typescript
registerRenderer(
  'chart-display',
  lazy(() => import('@/components/node-renderers/ChartRenderer'))
)
```

3. Optionally set a custom width:

```typescript
// In the nodeWidths map:
['chart-display', '400px'],
```

That's it. No changes to `WorkflowNode.tsx`.

### NodeRendererProps Contract

Every renderer — built-in or external — receives:

```typescript
interface NodeRendererProps {
  nodeId: string                          // Unique node instance ID
  metadata: NodeMetadata                  // Full node metadata (title, icon, ports, etc.)
  propertyValues: Record<string, any>     // Current property values from the store
  isSelected: boolean                     // Whether the node is selected on canvas
  onPropertyChange?: (name, value) => void  // Write a property value back to the store
  onDataChange?: (data) => void           // Emit data to output ports
  onSizeChange?: () => void               // Notify canvas that node dimensions changed
}
```

---

## For External Runtimes (ZIP SDK)

External runtimes can ship custom node UI as Web Components. The workflow:

1. Upload a JS bundle to Zeal
2. Register a template with a `display` field referencing the bundle
3. Zeal loads and mounts the Web Component inside the node

### Step 1: Upload the Component Bundle

```bash
curl -X POST http://localhost:3000/api/zip/components \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "acme",
    "source": "class AcmeChart extends HTMLElement { ... } customElements.define(\"acme-chart\", AcmeChart)"
  }'
```

Response:

```json
{
  "bundleId": "a1b2c3d4e5f6g7h8.js",
  "namespace": "acme",
  "url": "/api/zip/components/acme/a1b2c3d4e5f6g7h8.js",
  "size": 2048
}
```

Alternatively, upload as multipart form data with a `bundle` file field.

**Constraints:**
- Max bundle size: 512 KB
- Namespace: alphanumeric, hyphens, underscores
- Bundle is content-addressed (SHA-256 hash) — uploading identical source returns the same ID
- Served with `Cache-Control: public, max-age=31536000, immutable`

### Step 2: Register the Template

```typescript
await client.templates.register({
  namespace: 'acme',
  templates: [{
    id: 'chart-node',
    type: 'acme-chart',
    title: 'ACME Chart',
    subtitle: 'Data Visualization',
    category: 'visualization',
    description: 'Interactive chart powered by ACME runtime',
    icon: 'bar-chart',
    variant: 'blue-600',
    shape: 'rectangle',
    size: 'large',

    ports: [
      { id: 'data-in', label: 'Data', type: 'input', position: 'left' },
      { id: 'chart-out', label: 'Image', type: 'output', position: 'right' },
    ],

    properties: {
      chartType: {
        type: 'select',
        label: 'Chart Type',
        options: ['bar', 'line', 'pie', 'scatter'],
        defaultValue: 'bar',
      },
      colorScheme: {
        type: 'select',
        label: 'Colors',
        options: ['default', 'warm', 'cool', 'monochrome'],
        defaultValue: 'default',
      },
    },

    display: {
      element: 'acme-chart',
      bundleId: 'acme/a1b2c3d4e5f6g7h8.js',
      shadow: true,
      observedProps: ['chartType', 'colorScheme'],
      width: '400px',
    },
  }],
})
```

### Step 3: Write the Web Component

The component receives data as JS properties (not HTML attributes) and communicates back via CustomEvents.

```javascript
class AcmeChart extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        canvas { width: 100%; border-radius: 6px; }
      </style>
      <canvas></canvas>
    `
  }

  // --- Properties set by Zeal ---

  /** Full property values object */
  set propertyValues(values) {
    this._props = values
    this.render()
  }

  /** Individual observed props are also set directly */
  set chartType(v)    { this._chartType = v; this.render() }
  set colorScheme(v)  { this._colorScheme = v; this.render() }

  /** Node ID for stream store registration etc. */
  set nodeId(id)      { this._nodeId = id }

  /** Full metadata object */
  set metadata(m)     { this._metadata = m }

  /** Whether the node is selected on canvas */
  set isSelected(v)   { this._selected = v }

  // --- Communicate back to Zeal ---

  /** Update a property value in the workflow store */
  emitPropertyChange(name, value) {
    this.dispatchEvent(new CustomEvent('zeal:property-change', {
      detail: { name, value },
      bubbles: true,
      composed: true,  // crosses shadow DOM boundary
    }))
  }

  /** Emit data to output ports */
  emitDataChange(data) {
    this.dispatchEvent(new CustomEvent('zeal:data-change', {
      detail: data,
      bubbles: true,
      composed: true,
    }))
  }

  render() {
    const canvas = this.shadowRoot.querySelector('canvas')
    // ... draw chart using this._props, this._chartType, etc.
  }
}

customElements.define('acme-chart', AcmeChart)
```

### Display Field Reference

```typescript
interface DisplayComponent {
  /** Custom element tag name. Must contain a hyphen (Web Component spec). */
  element: string

  /** ID of an uploaded bundle (from POST /api/zip/components). Format: "namespace/hash.js" */
  bundleId?: string

  /** Inline JS source for small components (< ~5KB). Alternative to bundleId. */
  source?: string

  /** Use Shadow DOM for style isolation. Default: true */
  shadow?: boolean

  /** Property names forwarded individually as JS properties (in addition to the full propertyValues object). */
  observedProps?: string[]

  /** Custom node width (e.g. '400px'). Overrides default sizing. */
  width?: string
}
```

### Properties Set on the Custom Element

| Property | Type | Description |
|----------|------|-------------|
| `nodeId` | `string` | Unique node instance ID |
| `metadata` | `object` | Full node metadata |
| `propertyValues` | `object` | Current property values |
| `isSelected` | `boolean` | Whether the node is selected |
| Each `observedProps` entry | `any` | Individual property value |

### Events Dispatched by the Custom Element

| Event | Detail | Description |
|-------|--------|-------------|
| `zeal:property-change` | `{ name: string, value: any }` | Update a property in the workflow store |
| `zeal:data-change` | `any` | Emit data to output ports |

Both events should use `bubbles: true, composed: true` to cross the Shadow DOM boundary.

### Inline Source (No Upload)

For small components, skip the upload step and embed the source directly:

```typescript
display: {
  element: 'my-badge',
  source: `
    class MyBadge extends HTMLElement {
      connectedCallback() {
        this.innerHTML = '<span style="color:green">Ready</span>'
      }
      set propertyValues(v) {
        this.querySelector('span').textContent = v.status || 'Ready'
      }
    }
    customElements.define('my-badge', MyBadge)
  `,
  observedProps: ['status'],
}
```

This creates a Blob URL at runtime — same-origin, no CORS, no upload needed.

---

## Security

- Bundles are served from Zeal's own origin — no cross-origin script loading
- Content-addressed storage (SHA-256 hash) ensures bundle integrity
- `X-Content-Type-Options: nosniff` prevents MIME confusion
- Bundle size is capped at 512 KB
- Namespace validation prevents path traversal
- Shadow DOM isolates component styles from the editor
- Components run in the main thread (not sandboxed) — they have the same trust level as the Zeal editor itself. Only deploy bundles from trusted sources.

## File Reference

| File | Purpose |
|------|---------|
| `lib/node-renderer-registry.ts` | Registry mapping node types to lazy components |
| `components/node-renderers/WebComponentHost.tsx` | React wrapper that mounts Web Components |
| `components/node-renderers/*.tsx` | Built-in renderers (script, inputs, streams) |
| `components/WorkflowNode.tsx` | Node shell that delegates to registry |
| `app/api/zip/components/route.ts` | Bundle upload endpoint |
| `app/api/zip/components/[namespace]/[bundleId]/route.ts` | Bundle serve endpoint |
| `data/nodeTemplates/types.ts` | `DisplayComponent` type definition |
| `services/node-template-repository/core/models.ts` | Server-side `DisplayComponent` type |
| `app/api/zip/templates/register/route.ts` | Template registration (accepts `display` field) |
