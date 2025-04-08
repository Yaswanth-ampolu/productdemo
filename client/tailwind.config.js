/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        platform: {
          primary: '#6366F1',    // Indigo
          secondary: '#10B981',  // Emerald
          accent: '#F43F5E',     // Rose
          dark: '#111827',       // Dark gray-900
          darker: '#030712',     // Gray-950
          light: '#F9FAFB',      // Gray-50
          muted: '#9CA3AF',      // Gray-400
          success: '#22C55E',    // Green-500
          warning: '#F59E0B',    // Amber-500
          error: '#EF4444',      // Red-500
          surface: '#1F2937',    // Gray-800
          'surface-light': '#374151', // Gray-700
          highlight: '#818CF8',  // Indigo-400
          border: '#374151',     // Gray-700
        }
      },
      boxShadow: {
        'glow': '0 0 15px rgba(99, 102, 241, 0.5)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
} 