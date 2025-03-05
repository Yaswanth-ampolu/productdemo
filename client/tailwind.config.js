/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'grafana-primary': '#3B7CDD',
        'grafana-secondary': '#383F4B',
        'grafana-dark': '#161719',
        'grafana-darker': '#111217',
      },
    },
  },
  plugins: [],
} 