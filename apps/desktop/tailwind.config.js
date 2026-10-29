/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fdm: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          primary: '#0284c7',
          hover: '#0369a1',
          accent: '#38bdf8'
        }
      }
    },
  },
  plugins: [],
}
