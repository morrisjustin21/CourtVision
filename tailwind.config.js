/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        court: 'rgb(var(--color-court) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        panel2: 'rgb(var(--color-panel2) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        chalk: 'rgb(var(--color-chalk) / <alpha-value>)',
        chalkdim: 'rgb(var(--color-chalkdim) / <alpha-value>)',
        red: 'rgb(var(--color-red) / <alpha-value>)',
        reddim: 'rgb(var(--color-reddim) / <alpha-value>)',
        alert: 'rgb(var(--color-alert) / <alpha-value>)',
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
