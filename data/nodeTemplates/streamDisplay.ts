/**
 * Stream Display Node Templates
 * Live media display nodes that render incoming binary streams from Reflow.
 */

import { NodeTemplate } from './types'

const imageStreamDisplayNode: NodeTemplate = {
  id: 'tpl_image_stream_display',
  type: 'image-stream-display',
  title: 'Image Stream',
  subtitle: 'Live Image Display',
  category: 'media',
  subcategory: 'display',
  description: 'Display live image data from a binary stream (e.g. Reflow actor output)',
  icon: 'monitor',
  variant: 'purple-600',
  shape: 'rectangle',
  size: 'large',
  ports: [
    {
      id: 'stream',
      label: 'Stream',
      type: 'input',
      position: 'left',
      description: 'Incoming binary stream (image/raw-rgba or similar)',
    },
    {
      id: 'metadata',
      label: 'Metadata',
      type: 'output',
      position: 'right',
      description: 'Stream metadata (dimensions, bytes received, etc.)',
    },
  ],
  properties: {
    displayMode: {
      type: 'select',
      label: 'Display Mode',
      options: ['contain', 'cover', 'fill'],
      defaultValue: 'contain',
      description: 'How to fit the image within the node canvas',
    },
    previewHeight: {
      type: 'number',
      label: 'Preview Height',
      defaultValue: 300,
      min: 100,
      max: 800,
      step: 50,
      description: 'Maximum height of the preview canvas in pixels',
    },
  },
  requiredEnvVars: [],
  tags: ['stream', 'image', 'display', 'media', 'reflow', 'live'],
  version: '1.0.0',
  isActive: true,
}

const audioStreamDisplayNode: NodeTemplate = {
  id: 'tpl_audio_stream_display',
  type: 'audio-stream-display',
  title: 'Audio Stream',
  subtitle: 'Live Audio Display',
  category: 'media',
  subcategory: 'display',
  description: 'Play live audio from a binary stream with optional waveform visualization',
  icon: 'headphones',
  variant: 'purple-600',
  shape: 'rectangle',
  size: 'medium',
  ports: [
    {
      id: 'stream',
      label: 'Stream',
      type: 'input',
      position: 'left',
      description: 'Incoming binary audio stream (audio/webm, audio/opus, etc.)',
    },
    {
      id: 'metadata',
      label: 'Metadata',
      type: 'output',
      position: 'right',
      description: 'Stream metadata (duration, bytes received, etc.)',
    },
  ],
  properties: {
    autoplay: {
      type: 'boolean',
      label: 'Auto-play',
      defaultValue: false,
      description: 'Automatically start playback when stream data arrives',
    },
    loop: {
      type: 'boolean',
      label: 'Loop',
      defaultValue: false,
      description: 'Loop the audio after the stream completes',
    },
    showWaveform: {
      type: 'boolean',
      label: 'Show Waveform',
      defaultValue: true,
      description: 'Display a real-time waveform visualization',
    },
  },
  requiredEnvVars: [],
  tags: ['stream', 'audio', 'display', 'media', 'reflow', 'live', 'waveform'],
  version: '1.0.0',
  isActive: true,
}

export const streamDisplayTemplates: NodeTemplate[] = [
  imageStreamDisplayNode,
  audioStreamDisplayNode,
]
