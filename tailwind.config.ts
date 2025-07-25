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
      }
    },
  },
  plugins: [],
}

export default config