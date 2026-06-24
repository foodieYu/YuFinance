/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        earth: {
          50:  '#FDFBF7',
          100: '#F4EFE6',
          200: '#E6DCC8',
          300: '#D4C4A8',
          400: '#BEAA88',
          500: '#A89070',
          600: '#8C7A6B',
          700: '#6B5C55',
          800: '#4A3E3D',
          900: '#2E2522',
        },
        sage: {
          DEFAULT: '#8FA489',
          light: '#B2C4AE',
          dark: '#6A7D64',
        },
        terracotta: {
          DEFAULT: '#C87A65',
          light: '#DFA896',
          dark: '#A35A48',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
