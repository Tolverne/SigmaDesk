/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sigma-blue': '#0066CC',
        'sigma-dark': '#1a1a2e',
        'sigma-light': '#f5f5f5',
        'teacher-red': '#ef4444',
        'teacher-green': '#10b981',
      },
    },
  },
  plugins: [],
}