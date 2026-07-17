/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Industrial dark theme palette
        bg: {
          DEFAULT: '#0a0e17',
          card: '#111827',
          panel: '#1f2937',
        },
        text: {
          DEFAULT: '#e5e7eb',
          muted: '#9ca3af',
        },
        accent: {
          cyan: '#06b6d4',
          amber: '#f59e0b',
          rose: '#f43f5e',
          emerald: '#10b981',
        },
        border: '#374151',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash': 'flash 0.5s ease-in-out',
      },
      keyframes: {
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
