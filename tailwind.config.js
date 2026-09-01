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
        background: '#090a0f',
        panel: 'rgba(13, 16, 23, 0.85)',
        panelBorder: 'rgba(255, 255, 255, 0.08)',
        accent: {
          cyan: '#00f2fe',
          blue: '#4facfe',
          magenta: '#f355da',
          purple: '#7928ca',
          amber: '#ffb300',
          emerald: '#00f5a0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}

