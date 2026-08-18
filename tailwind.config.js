/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        court: '#121316',
        panel: '#1A1C21',
        panel2: '#212429',
        line: '#2B2E35',
        chalk: '#F5F5F3',
        chalkdim: '#9CA3AF',
        red: '#E31B23',
        reddim: '#7A1014',
        alert: '#FF7A59',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
