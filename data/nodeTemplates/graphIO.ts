/**
 * Graph Input/Output Node Templates
 * Special nodes for data flow between graphs and subgraphs
 */

import { NodeTemplate } from './types'

export const graphIOTemplates: NodeTemplate[] = [
  {
    id: 'graph_input',
    type: 'graph-io',
    title: 'Graph Input',
    subtitle: 'Entry point for subgraph',
    category: 'graph-io',
    description:
      'Receives data from parent graph and passes it into the current subgraph. This node serves as the entry point for data flowing into a subgraph.',
    icon: 'arrow-right-circle',
    variant: 'blue-600',
    shape: 'diamond',
    size: 'medium',
    ports: [
      {
        id: 'data',
        label: 'Data',
        type: 'output',
        position: 'right',
      },
    ],
    properties: {
      inputName: {
        type: 'text',
        label: 'Input Name',
        required: true,
        placeholder: 'Enter input name',
        defaultValue: 'input',
        description: 'Name for this input (used for documentation and clarity)',
      },
      dataType: {
        type: 'select',
        label: 'Expected Data Type',
        required: false,
        options: ['any', 'string', 'number', 'boolean', 'object', 'array'],
        defaultValue: 'any',
        description: 'Expected data type for validation (optional)',
      },
      description: {
        type: 'textarea',
        label: 'Description',
        required: false,
        placeholder: 'Describe what this input receives...',
        description: 'Documentation for this input',
      },
    },
    requiredEnvVars: [],
    tags: ['graph', 'input', 'subgraph', 'entry-point', 'data-flow'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'graph_output',
    type: 'graph-io',
    title: 'Graph Output',
    subtitle: 'Exit point for subgraph',
    category: 'graph-io',
    description:
      'Sends data from the current subgraph back to the parent graph. This node serves as the exit point for data flowing out of a subgraph.',
    icon: 'arrow-left-circle',
    variant: 'green-600',
    shape: 'diamond',
    size: 'medium',
    ports: [
      {
        id: 'data',
        label: 'Data',
        type: 'input',
        position: 'left',
      },
    ],
    properties: {
      outputName: {
        type: 'text',
        label: 'Output Name',
        required: true,
        placeholder: 'Enter output name',
        defaultValue: 'output',
        description: 'Name for this output (used for documentation and clarity)',
      },
      dataType: {
        type: 'select',
        label: 'Output Data Type',
        required: false,
        options: ['any', 'string', 'number', 'boolean', 'object', 'array'],
        defaultValue: 'any',
        description: 'Output data type for validation (optional)',
      },
      description: {
        type: 'textarea',
        label: 'Description',
        required: false,
        placeholder: 'Describe what this output provides...',
        description: 'Documentation for this output',
      },
    },
    requiredEnvVars: [],
    tags: ['graph', 'output', 'subgraph', 'exit-point', 'data-flow'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'proxy_input',
    type: 'graph-io',
    title: 'Proxy Input',
    subtitle: 'Direct port connection',
    category: 'graph-io',
    description:
      'Proxy node that provides direct access to a specific input port of a node inside a subgraph. Allows parent graph nodes to connect directly to internal subgraph node ports.',
    icon: 'link',
    variant: 'purple-600',
    shape: 'circle',
    size: 'small',
    ports: [
      {
        id: 'proxy',
        label: 'Proxy',
        type: 'output',
        position: 'right',
      },
    ],
    properties: {
      subgraphId: {
        type: 'text',
        label: 'Subgraph ID',
        required: true,
        placeholder: 'ID of the subgraph',
        description: 'The ID of the subgraph containing the target node',
      },
      targetNodeId: {
        type: 'text',
        label: 'Target Node ID',
        required: true,
        placeholder: 'ID of the node in subgraph',
        description: 'The ID of the node inside the subgraph to proxy to',
      },
      targetPortId: {
        type: 'text',
        label: 'Target Port ID',
        required: true,
        placeholder: 'ID of the input port',
        description: 'The ID of the specific input port to proxy',
      },
      description: {
        type: 'textarea',
        label: 'Description',
        required: false,
        placeholder: 'Describe this proxy connection...',
        description: 'Documentation for this proxy',
      },
    },
    requiredEnvVars: [],
    tags: ['graph', 'proxy', 'input', 'subgraph', 'port', 'direct-connection'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'proxy_output',
    type: 'graph-io',
    title: 'Proxy Output',
    subtitle: 'Expose internal port',
    category: 'graph-io',
    description:
      'Proxy node that exposes a specific output port from a node inside a subgraph. Allows internal subgraph node outputs to be directly accessible from the parent graph.',
    icon: 'link-2',
    variant: 'orange-600',
    shape: 'circle',
    size: 'small',
    ports: [
      {
        id: 'proxy',
        label: 'Proxy',
        type: 'input',
        position: 'left',
      },
    ],
    properties: {
      subgraphId: {
        type: 'text',
        label: 'Subgraph ID',
        required: true,
        placeholder: 'ID of the subgraph',
        description: 'The ID of the subgraph containing the source node',
      },
      sourceNodeId: {
        type: 'text',
        label: 'Source Node ID',
        required: true,
        placeholder: 'ID of the node in subgraph',
        description: 'The ID of the node inside the subgraph to proxy from',
      },
      sourcePortId: {
        type: 'text',
        label: 'Source Port ID',
        required: true,
        placeholder: 'ID of the output port',
        description: 'The ID of the specific output port to proxy',
      },
      description: {
        type: 'textarea',
        label: 'Description',
        required: false,
        placeholder: 'Describe this proxy connection...',
        description: 'Documentation for this proxy',
      },
    },
    requiredEnvVars: [],
    tags: ['graph', 'proxy', 'output', 'subgraph', 'port', 'direct-connection'],
    version: '1.0.0',
    isActive: true,
  },
]
