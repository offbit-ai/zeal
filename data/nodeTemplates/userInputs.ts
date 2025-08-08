/**
 * User Input Node Templates
 * Nodes for various types of user inputs including text, numbers, media files, etc.
 */

import { NodeTemplate, Port } from './types'

// Text Input Node
const textInputNode: NodeTemplate = {
  id: 'tpl_text_input',
  type: 'text-input',
  title: 'Text Input',
  subtitle: 'User Text Input',
  category: 'inputs',
  subcategory: 'text',
  description: 'Input text data with optional multi-line support and validation',
  icon: 'type',
  variant: 'gray-900',
  shape: 'rectangle',
  size: 'medium',
  ports: [
    {
      id: 'output',
      label: 'Text',
      type: 'output',
      position: 'right',
    },
  ],
  properties: {
    defaultValue: {
      type: 'textarea',
      label: 'Default Value',
      placeholder: 'Enter default text...',
      defaultValue: '',
      height: 100,
    },
    placeholder: {
      type: 'text',
      label: 'Placeholder',
      placeholder: 'Placeholder text for empty input',
      defaultValue: 'Enter text...',
    },
    multiline: {
      type: 'boolean',
      label: 'Multi-line Input',
      defaultValue: false,
      description: 'Allow multiple lines of text',
    },
    maxLength: {
      type: 'number',
      label: 'Max Length',
      placeholder: 'Maximum characters allowed',
      min: 0,
      max: 10000,
      step: 1,
    },
    validation: {
      type: 'select',
      label: 'Validation Type',
      options: ['none', 'email', 'url', 'alphanumeric', 'regex'],
      defaultValue: 'none',
    },
    validationPattern: {
      type: 'text',
      label: 'Validation Pattern',
      placeholder: 'Regular expression pattern',
      description: 'Used when validation type is "regex"',
    },
  },
  requiredEnvVars: [],
  tags: ['input', 'text', 'user-input', 'form'],
  version: '1.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['multiline'],
    rules: [
      {
        when: '$.multiline == true',
        updates: {
          title: 'Text Area',
          subtitle: 'Multi-line Text Input',
          icon: 'align-left',
        },
      },
    ],
  },
}

// Number Input Node
const numberInputNode: NodeTemplate = {
  id: 'tpl_number_input',
  type: 'number-input',
  title: 'Number Input',
  subtitle: 'Numeric Input',
  category: 'inputs',
  subcategory: 'numeric',
  description: 'Input numeric values with validation and formatting options',
  icon: 'hash',
  variant: 'gray-900',
  shape: 'rectangle',
  size: 'small',
  ports: [
    {
      id: 'output',
      label: 'Number',
      type: 'output',
      position: 'right',
    },
  ],
  properties: {
    defaultValue: {
      type: 'number',
      label: 'Default Value',
      placeholder: 'Default number',
      defaultValue: 0,
    },
    min: {
      type: 'number',
      label: 'Minimum Value',
      placeholder: 'Minimum allowed value',
    },
    max: {
      type: 'number',
      label: 'Maximum Value',
      placeholder: 'Maximum allowed value',
    },
    step: {
      type: 'number',
      label: 'Step',
      placeholder: 'Increment/decrement step',
      defaultValue: 1,
      min: 0,
    },
    format: {
      type: 'select',
      label: 'Display Format',
      options: ['decimal', 'integer', 'currency', 'percentage', 'scientific'],
      defaultValue: 'decimal',
    },
    decimals: {
      type: 'number',
      label: 'Decimal Places',
      min: 0,
      max: 10,
      defaultValue: 2,
      description: 'Number of decimal places to display',
    },
  },
  requiredEnvVars: [],
  tags: ['input', 'number', 'numeric', 'user-input'],
  version: '1.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['format'],
    rules: [
      {
        when: '$.format == "currency"',
        updates: {
          title: 'Currency Input',
          subtitle: 'Monetary Value',
          icon: 'dollar-sign',
          variant: 'green-600',
        },
      },
      {
        when: '$.format == "percentage"',
        updates: {
          title: 'Percentage Input',
          subtitle: 'Percentage Value',
          icon: 'percent',
          variant: 'blue-600',
        },
      },
    ],
  },
}

// Range Input Node
const rangeInputNode: NodeTemplate = {
  id: 'tpl_range_input',
  type: 'range-input',
  title: 'Range Input',
  subtitle: 'Slider Control',
  category: 'inputs',
  subcategory: 'numeric',
  description: 'Select a value within a range using a slider control',
  icon: 'sliders',
  variant: 'gray-800',
  shape: 'rectangle',
  size: 'medium',
  ports: [
    {
      id: 'output',
      label: 'Value',
      type: 'output',
      position: 'right',
    },
  ],
  properties: {
    defaultValue: {
      type: 'number',
      label: 'Default Value',
      defaultValue: 50,
    },
    min: {
      type: 'number',
      label: 'Minimum',
      defaultValue: 0,
    },
    max: {
      type: 'number',
      label: 'Maximum',
      defaultValue: 100,
    },
    step: {
      type: 'number',
      label: 'Step',
      defaultValue: 1,
      min: 0,
    },
    showValue: {
      type: 'boolean',
      label: 'Show Current Value',
      defaultValue: true,
    },
    showLabels: {
      type: 'boolean',
      label: 'Show Min/Max Labels',
      defaultValue: true,
    },
    unit: {
      type: 'text',
      label: 'Unit',
      placeholder: 'e.g., px, %, ms',
      defaultValue: '',
    },
  },
  requiredEnvVars: [],
  tags: ['input', 'range', 'slider', 'user-input'],
  version: '1.0.0',
  isActive: true,
}

// Image Input/Display Node
const imageInputNode: NodeTemplate = {
  id: 'tpl_image_input',
  type: 'image-input',
  title: 'Image',
  subtitle: '',
  category: 'media',
  subcategory: 'images',
  description: 'Upload or link to images with inline preview (supports GIF animations)',
  icon: 'image',
  variant: 'black',
  shape: 'rectangle',
  size: 'large',
  ports: [
    {
      id: 'source',
      label: 'Source',
      type: 'input',
      position: 'left',
      description: 'Image URL or data to display',
    },
    {
      id: 'imageData',
      label: 'Image Data',
      type: 'output',
      position: 'right',
    },
    {
      id: 'metadata',
      label: 'Metadata',
      type: 'output',
      position: 'bottom',
    },
  ],
  properties: {
    source: {
      type: 'select',
      label: 'Image Source',
      options: ['upload', 'url', 'base64'],
      defaultValue: 'url',
    },
    imageFile: {
      type: 'file',
      label: 'Upload Image',
      description: 'Select an image file to upload',
      acceptedFormats: 'image/jpeg,image/png,image/gif,image/webp',
      maxFileSize: 10,
      fileType: 'image',
      visibleWhen: 'source === "upload"',
      linkedProperty: 'imageData', // Link to output data property
    },
    url: {
      type: 'text',
      label: 'Image URL',
      placeholder: 'https://example.com/image.jpg',
      description: 'Enter the URL of the image',
      defaultValue: 'https://placehold.co/400x300',
      visibleWhen: 'source === "url"',
    },
    acceptedFormats: {
      type: 'text',
      label: 'Accepted Formats',
      defaultValue: 'image/jpeg,image/png,image/gif,image/webp',
      description: 'Comma-separated MIME types (GIF animations supported)',
    },
    maxFileSize: {
      type: 'number',
      label: 'Max File Size (MB)',
      defaultValue: 10,
      min: 1,
      max: 100,
      description: 'Maximum file size for uploads',
    },
    displayMode: {
      type: 'select',
      label: 'Display Mode',
      options: ['contain', 'cover', 'fill', 'none'],
      defaultValue: 'contain',
    },
    previewHeight: {
      type: 'number',
      label: 'Preview Height (px)',
      defaultValue: 200,
      min: 50,
      max: 500,
      step: 10,
    },
    pauseGifOnHover: {
      type: 'boolean',
      label: 'Pause GIF on Hover',
      defaultValue: false,
      description: 'Pause animated GIFs when hovering over them',
    },
  },
  requiredEnvVars: [],
  tags: ['input', 'image', 'media', 'upload', 'display', 'gif', 'animation'],
  version: '1.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['source'],
    rules: [
      {
        when: '$.source == "upload"',
        updates: {
          // subtitle: 'Image Upload',
          icon: 'image-up',
        },
      },
      {
        when: '$.source == "url"',
        updates: {
          // subtitle: 'Image from URL',
          icon: 'link',
        },
      },
    ],
  },
}

// Audio Input/Player Node
const audioInputNode: NodeTemplate = {
  id: 'tpl_audio_input',
  type: 'audio-input',
  title: 'Audio',
  subtitle: '',
  category: 'media',
  subcategory: 'audio',
  description: 'Upload or link to audio files with inline player',
  icon: 'music',
  variant: 'black',
  shape: 'rectangle',
  size: 'large',
  ports: [
    {
      id: 'source',
      label: 'Source',
      type: 'input',
      position: 'left',
      description: 'Audio URL or data to play',
    },
    {
      id: 'audioData',
      label: 'Audio Data',
      type: 'output',
      position: 'right',
    },
    {
      id: 'metadata',
      label: 'Metadata',
      type: 'output',
      position: 'bottom',
    },
  ],
  properties: {
    source: {
      type: 'select',
      label: 'Audio Source',
      options: ['upload', 'url', 'record'],
      defaultValue: 'upload',
    },
    audioFile: {
      type: 'file',
      label: 'Upload Audio',
      description: 'Select an audio file to upload',
      acceptedFormats: 'audio/mpeg,audio/wav,audio/ogg,audio/webm',
      maxFileSize: 50,
      fileType: 'audio',
      visibleWhen: 'source === "upload"',
      linkedProperty: 'audioData', // Link to output data property
    },
    url: {
      type: 'text',
      label: 'Audio URL',
      placeholder: 'https://example.com/audio.mp3',
      description: 'Enter the URL of the audio file',
      visibleWhen: 'source === "url"',
    },
    acceptedFormats: {
      type: 'text',
      label: 'Accepted Formats',
      defaultValue: 'audio/mpeg,audio/wav,audio/ogg,audio/webm',
      description: 'Comma-separated MIME types',
    },
    maxFileSize: {
      type: 'number',
      label: 'Max File Size (MB)',
      defaultValue: 50,
      min: 1,
      max: 500,
      description: 'Maximum file size for uploads',
    },
    showWaveform: {
      type: 'boolean',
      label: 'Show Waveform',
      defaultValue: true,
    },
    autoplay: {
      type: 'boolean',
      label: 'Autoplay',
      defaultValue: false,
    },
    loop: {
      type: 'boolean',
      label: 'Loop',
      defaultValue: false,
    },
  },
  requiredEnvVars: [],
  tags: ['input', 'audio', 'media', 'upload', 'player'],
  version: '1.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['source'],
    rules: [
      {
        when: '$.source == "record"',
        updates: {
          subtitle: 'Audio Recorder',
          icon: 'mic',
          variant: 'orange-600',
        },
      },
    ],
  },
}

// Video Input/Player Node
const videoInputNode: NodeTemplate = {
  id: 'tpl_video_input',
  type: 'video-input',
  title: 'Video',
  subtitle: 'Video',
  category: 'media',
  subcategory: 'video',
  description: 'Upload or link to video files with inline player (supports streaming)',
  icon: 'video',
  variant: 'black',
  shape: 'rectangle',
  size: 'large',
  ports: [
    {
      id: 'source',
      label: 'Source',
      type: 'input',
      position: 'left',
      description: 'Video URL, stream URL, or data to play',
    },
    {
      id: 'videoData',
      label: 'Video Data',
      type: 'output',
      position: 'right',
    },
    {
      id: 'metadata',
      label: 'Metadata',
      type: 'output',
      position: 'bottom',
    },
  ],
  properties: {
    source: {
      type: 'select',
      label: 'Video Source',
      options: ['upload', 'url', 'stream', 'youtube', 'vimeo'],
      defaultValue: 'upload',
    },
    videoFile: {
      type: 'file',
      label: 'Upload Video',
      description: 'Select a video file to upload',
      acceptedFormats: 'video/mp4,video/webm,video/ogg',
      maxFileSize: 100,
      fileType: 'video',
      visibleWhen: 'source === "upload"',
      linkedProperty: 'videoData', // Link to output data property
    },
    url: {
      type: 'text',
      label: 'Video URL',
      placeholder: 'https://example.com/video.mp4',
      description: 'Video URL, stream URL (HLS/DASH), or embed link',
      visibleWhen:
        'source === "url" || source === "stream" || source === "youtube" || source === "vimeo"',
    },
    acceptedFormats: {
      type: 'text',
      label: 'Accepted Formats',
      defaultValue: 'video/mp4,video/webm,video/ogg',
      description: 'Comma-separated MIME types',
    },
    maxFileSize: {
      type: 'number',
      label: 'Max File Size (MB)',
      defaultValue: 100,
      min: 1,
      max: 1000,
      description: 'Maximum file size for uploads',
    },
    previewHeight: {
      type: 'number',
      label: 'Player Height (px)',
      defaultValue: 300,
      min: 100,
      max: 600,
      step: 10,
    },
    showControls: {
      type: 'boolean',
      label: 'Show Controls',
      defaultValue: true,
    },
    autoplay: {
      type: 'boolean',
      label: 'Autoplay',
      defaultValue: false,
    },
    loop: {
      type: 'boolean',
      label: 'Loop',
      defaultValue: false,
    },
    muted: {
      type: 'boolean',
      label: 'Muted',
      defaultValue: false,
      description: 'Required for autoplay in most browsers',
    },
    streamType: {
      type: 'select',
      label: 'Stream Type',
      options: ['auto', 'hls', 'dash'],
      defaultValue: 'auto',
      description: 'Type of streaming protocol (for stream source)',
    },
    buffering: {
      type: 'boolean',
      label: 'Show Buffering Indicator',
      defaultValue: true,
      description: 'Show loading indicator during buffering',
    },
  },
  requiredEnvVars: [],
  tags: ['input', 'video', 'media', 'upload', 'player', 'streaming', 'hls', 'dash'],
  version: '1.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['source'],
    rules: [
      {
        when: '$.source == "youtube"',
        updates: {
          subtitle: 'YouTube Video',
          icon: 'youtube',
          variant: 'black',
        },
      },
      {
        when: '$.source == "vimeo"',
        updates: {
          subtitle: 'Vimeo Video',
          icon: 'video',
          variant: 'black',
        },
      },
      {
        when: '$.source == "stream"',
        updates: {
          subtitle: 'Streaming Video',
          icon: 'radio',
          variant: 'black',
        },
      },
    ],
  },
}

// Export all user input templates
export const userInputsTemplates: NodeTemplate[] = [
  textInputNode,
  numberInputNode,
  rangeInputNode,
  imageInputNode,
  audioInputNode,
  videoInputNode,
]
