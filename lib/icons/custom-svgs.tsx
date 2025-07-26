import React from 'react'

/**
 * Custom SVG icon component props
 */
interface CustomIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
}

/**
 * Base SVG wrapper for consistent styling
 */
const BaseSVG: React.FC<CustomIconProps & { children: React.ReactNode }> = ({
  size = 24,
  className = '',
  children,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
)

/**
 * Custom SVG Icons
 * Add your custom icons here following the same pattern
 */

// Workflow-specific icons
export const WorkflowIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M3 12h3l2-8h4l2 8h6" />
    <circle cx="6" cy="16" r="2" />
    <circle cx="18" cy="16" r="2" />
    <path d="M8 16h8" />
  </BaseSVG>
)

export const NodeIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v6" />
    <path d="M9 12h6" />
  </BaseSVG>
)

export const ConnectionIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="12" r="3" />
    <path d="M9 12h6" />
    <path d="M12 9l3 3-3 3" />
  </BaseSVG>
)

// Data processing icons
export const TransformIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M3 12h6l3-3 3 3h6" />
    <path d="M12 3v6" />
    <path d="M12 15v6" />
    <circle cx="12" cy="12" r="2" />
  </BaseSVG>
)

export const FilterIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M3 6h18" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
    <circle cx="12" cy="12" r="1" />
  </BaseSVG>
)

export const AggregateIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M3 18h18" />
    <path d="M8 12l4 4 4-4" />
  </BaseSVG>
)

// Math operation icons (more specific than Lucide)
export const SumIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M8 6h8" />
    <path d="M8 12h8" />
    <path d="M8 18h8" />
    <path d="M4 9l4-3" />
    <path d="M4 15l4 3" />
  </BaseSVG>
)

export const AverageIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M8 6h8" />
    <path d="M6 12h12" />
    <path d="M8 18h8" />
    <circle cx="12" cy="12" r="1" />
  </BaseSVG>
)

// AI/ML specific icons
export const NeuralNetworkIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M8 6l2 6" />
    <path d="M16 6l-2 6" />
    <path d="M8 18l2-6" />
    <path d="M16 18l-2-6" />
  </BaseSVG>
)

export const ModelIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <rect x="3" y="3" width="18" height="10" rx="2" />
    <circle cx="7" cy="8" r="1" />
    <circle cx="12" cy="8" r="1" />
    <circle cx="17" cy="8" r="1" />
    <path d="M3 16h18" />
    <path d="M8 13v3" />
    <path d="M16 13v3" />
  </BaseSVG>
)

// Cloud & Services icons
export const APIIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <rect x="4" y="8" width="16" height="8" rx="2" />
    <path d="M8 12h8" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M8 18v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2" />
  </BaseSVG>
)

export const WebhookIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
    <path d="M6 17a4 4 0 0 1 6.24-3.26C12.8 13.4 13.1 13 13.5 13H18" />
    <path d="M12 3a4 4 0 0 1 4 4 4 4 0 0 1-3.99 3.99" />
  </BaseSVG>
)

// Brand icons (simple versions)
export const SlackIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M8.5 8.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 5 0" />
    <path d="M15.5 8.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 5 0" />
    <path d="M8.5 15.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 5 0" />
    <path d="M15.5 15.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 5 0" />
  </BaseSVG>
)

export const DiscordIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M20 12c-2 4-7 8-8 8s-6-4-8-8c0-6 4-8 8-8s8 2 8 8Z" />
    <circle cx="9" cy="10" r="1" />
    <circle cx="15" cy="10" r="1" />
    <path d="M8 14s1.5 1 4 1 4-1 4-1" />
  </BaseSVG>
)

// Utility icons
export const JsonIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18-3v3a2 2 0 0 1-2 2h-3m-8 8h3a2 2 0 0 0 2-2v-3m-8 0v3a2 2 0 0 0 2 2h3" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </BaseSVG>
)

export const YamlIcon: React.FC<CustomIconProps> = (props) => (
  <BaseSVG {...props}>
    <path d="M3 6h4" />
    <path d="M5 6v6" />
    <path d="M3 12h4" />
    <path d="M10 6v6l3-3 3 3V6" />
    <path d="M17 6h4" />
    <path d="M19 6v12" />
  </BaseSVG>
)

/**
 * Registry of all custom SVG icons
 * Add new icons to this registry to make them available through the icon library
 */
export const CustomSVGIcons: Record<string, React.ComponentType<CustomIconProps>> = {
  // Workflow
  'workflow': WorkflowIcon,
  'node': NodeIcon,
  'connection': ConnectionIcon,
  
  // Data processing
  'transform': TransformIcon,
  'filter': FilterIcon,
  'aggregate': AggregateIcon,
  
  // Math
  'sum': SumIcon,
  'average': AverageIcon,
  
  // AI/ML
  'neural-network': NeuralNetworkIcon,
  'neural_network': NeuralNetworkIcon,
  'model': ModelIcon,
  
  // Cloud & Services
  'api': APIIcon,
  'webhook': WebhookIcon,
  
  // Brands
  'slack': SlackIcon,
  'discord': DiscordIcon,
  
  // Utilities
  'json': JsonIcon,
  'yaml': YamlIcon,
  
  // Add kebab-case and snake_case variants for consistency
  'workflow-icon': WorkflowIcon,
  'node-icon': NodeIcon,
  'connection-icon': ConnectionIcon,
  'transform-icon': TransformIcon,
  'filter-icon': FilterIcon,
  'aggregate-icon': AggregateIcon,
  'sum-icon': SumIcon,
  'average-icon': AverageIcon,
  'neural-network-icon': NeuralNetworkIcon,
  'model-icon': ModelIcon,
  'api-icon': APIIcon,
  'webhook-icon': WebhookIcon,
  'slack-icon': SlackIcon,
  'discord-icon': DiscordIcon,
  'json-icon': JsonIcon,
  'yaml-icon': YamlIcon,
}