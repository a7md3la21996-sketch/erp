/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EDF2F7',
          100: '#D9E4EE',
          200: '#B3C7DB',
          300: '#8BA8C8',
          400: '#6B8DB5',
          500: '#4A7AAB',
          600: '#3E6891',
          700: '#345A80',
          800: '#2B4C6F',
          900: '#1B3347',
        },
        surface: {
          bg:    { DEFAULT: '#F0F4F8', dark: '#152232' },
          card:  { DEFAULT: '#ffffff', dark: '#1a2234' },
          input: { DEFAULT: '#ffffff', dark: '#0F1E2D' },
        },
        edge: {
          DEFAULT: '#E2E8F0',
          dark:    'rgba(74,122,171,0.2)',
        },
        content: {
          DEFAULT:  '#1A2B3C',
          dark:     '#E2EAF4',
          muted:    '#64748B',
          'muted-dark': '#8BA8C8',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to:   { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
