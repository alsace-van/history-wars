/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f172a',
          secondary: '#1e293b',
          tertiary: '#334155'
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          tertiary: '#64748b'
        },
        accent: {
          blue: '#378ADD',
          red: '#E24B4A',
          amber: '#EF9F27',
          green: '#97C459'
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}
