/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EFF4FE',
          100: '#DBE8FB',
          200: '#BAD0F6',
          300: '#8DB1EF',
          400: '#5E90E5',
          500: '#2F6BD3',
          600: '#2557B4',
          700: '#1F478F',
          800: '#1E3E77',
          900: '#1A3159',
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
          muted:    '#4A5568',
          'muted-dark': '#A3B4C9',
        },
        // Muted semantic palette (matches the redesign mockup) — overrides
        // Tailwind's bright defaults site-wide so every text-red-500 /
        // bg-emerald-500 etc. reads in one harmonious system with the brand blue.
        red:     { 50:'#FBEDEC',100:'#F6D9D7',200:'#EDB3B0',300:'#E28A86',400:'#DC635D',500:'#D6403B',600:'#B93531',700:'#952B28',800:'#7A2422',900:'#611D1B' },
        amber:   { 50:'#FBF3E1',100:'#F6E6C0',200:'#EDCD82',300:'#E0B04A',400:'#D69A24',500:'#C9860A',600:'#A66E08',700:'#855806',800:'#6D4805',900:'#573A04' },
        emerald: { 50:'#E6F4EE',100:'#C9E7D9',200:'#97D0B7',300:'#5FB68F',400:'#2FA172',500:'#158A57',600:'#117049',700:'#0E5B3B',800:'#0B4A31',900:'#093B27' },
        green:   { 50:'#E6F4EE',100:'#C9E7D9',200:'#97D0B7',300:'#5FB68F',400:'#2FA172',500:'#158A57',600:'#117049',700:'#0E5B3B',800:'#0B4A31',900:'#093B27' },
        orange:  { 50:'#FCEFE7',100:'#F8DBC9',200:'#F1B896',300:'#E9925F',400:'#E37B42',500:'#DD6327',600:'#BF5220',700:'#9C431A',800:'#7F3716',900:'#672D12' },
        purple:  { 50:'#EEEFFA',100:'#DDDFF4',200:'#BFC2E9',300:'#969BDA',400:'#767DCF',500:'#5A63C4',600:'#4951A8',700:'#3D4389',800:'#333871',900:'#2B2F5C' },
        // Secondary blues/indigos/yellow fold into the brand & muted system so
        // there's ONE blue, not two. Distinct accents (teal/cyan/pink/lime) get
        // muted so nothing reads as fluorescent next to the rest.
        blue:    { 50:'#EFF4FE',100:'#DBE8FB',200:'#BAD0F6',300:'#8DB1EF',400:'#5E90E5',500:'#2F6BD3',600:'#2557B4',700:'#1F478F',800:'#1E3E77',900:'#1A3159' },
        sky:     { 50:'#EFF4FE',100:'#DBE8FB',200:'#BAD0F6',300:'#8DB1EF',400:'#5E90E5',500:'#2F6BD3',600:'#2557B4',700:'#1F478F',800:'#1E3E77',900:'#1A3159' },
        indigo:  { 50:'#EEEFFA',100:'#DDDFF4',200:'#BFC2E9',300:'#969BDA',400:'#767DCF',500:'#5A63C4',600:'#4951A8',700:'#3D4389',800:'#333871',900:'#2B2F5C' },
        violet:  { 50:'#EEEFFA',100:'#DDDFF4',200:'#BFC2E9',300:'#969BDA',400:'#767DCF',500:'#5A63C4',600:'#4951A8',700:'#3D4389',800:'#333871',900:'#2B2F5C' },
        fuchsia: { 50:'#EEEFFA',100:'#DDDFF4',200:'#BFC2E9',300:'#969BDA',400:'#767DCF',500:'#5A63C4',600:'#4951A8',700:'#3D4389',800:'#333871',900:'#2B2F5C' },
        yellow:  { 50:'#FBF3E1',100:'#F6E6C0',200:'#EDCD82',300:'#E0B04A',400:'#D69A24',500:'#C9860A',600:'#A66E08',700:'#855806',800:'#6D4805',900:'#573A04' },
        rose:    { 50:'#FBEDEC',100:'#F6D9D7',200:'#EDB3B0',300:'#E28A86',400:'#DC635D',500:'#D6403B',600:'#B93531',700:'#952B28',800:'#7A2422',900:'#611D1B' },
        teal:    { 50:'#E4F3F1',100:'#C4E5E1',200:'#93CEC7',300:'#57B2A8',400:'#2FA79B',500:'#12897E',600:'#0E6F66',700:'#0B5A53',800:'#094944',900:'#073B37' },
        cyan:    { 50:'#E6F2F6',100:'#C7E2EB',200:'#96C8D8',300:'#5FA9BF',400:'#3FA3BA',500:'#2088A0',600:'#1A6E83',700:'#155869',800:'#124857',900:'#0F3B47' },
        pink:    { 50:'#FAECF1',100:'#F4D8E2',200:'#E9B3C6',300:'#DA8AA6',400:'#D0759B',500:'#C14D7E',600:'#A33E68',700:'#843152',800:'#6D2944',900:'#582137' },
        lime:    { 50:'#F1F6E7',100:'#E1EDC9',200:'#C7DD97',300:'#A6C85F',400:'#8BB840',500:'#6E9E1E',600:'#597F18',700:'#476513',800:'#3B5310',900:'#31450D' },
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
  plugins: [require('tailwindcss-animate')],
};
