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
          primary: '#7C3AED',    // Vibrant purple
          secondary: '#2DD4BF',  // Teal
          accent: '#F472B6',     // Pink accent
          dark: '#0F172A',       // Dark slate background
          darker: '#020617',     // Darker slate background
          light: '#F8FAFC',      // Light text
          muted: '#94A3B8',      // Muted text
          success: '#22C55E',    // Success green
          warning: '#FB923C',    // Warning orange
          error: '#EF4444',      // Error red
          surface: '#1E293B',    // Surface color
          'surface-light': '#334155', // Lighter surface
          highlight: '#8B5CF6',  // Highlight color
          border: '#334155',     // Border color
        }
      },
    },
  },
  plugins: [],
} 