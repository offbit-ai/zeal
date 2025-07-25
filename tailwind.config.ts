import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Monochrome palette
        'primary': '#1A1A1A',
        'secondary': '#6B7280', 
        'hover': '#374151',
        'active': '#111827',
        'background': '#F5F5F7',
        'canvas': '#FFFFFF',
        'border': {
          DEFAULT: '#E5E7EB',
          hover: '#D1D5DB',
          active: '#9CA3AF',
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'node': '12px',
      },
      boxShadow: {
        'node': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'node-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'node-active': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        }
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-out': 'slide-out 0.3s ease-in',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-in',
      }
    },
  },
  safelist: [
    // Node variant colors
    'bg-black',
    'bg-gray-600',
    'bg-gray-700', 
    'bg-gray-800',
    'bg-gray-900',
    'bg-blue-600',
    'bg-green-600',
    'bg-orange-600',
    'bg-orange-700'
  ],
  plugins: [],
}

export default config