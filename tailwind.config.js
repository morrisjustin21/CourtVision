/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        court: '#14171C',
        panel: '#1B1F26',
        panel2: '#20252D',
        line: '#2A2F38',
        chalk: '#F3F0E9',
        chalkdim: '#9CA3AF',
        amber: '#E8871E',
        amberdim: '#7A4E1D',
        teal: '#2FA88C',
        alert: '#D64545',
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
