/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}',
    './app/**/*.{js,ts,tsx}',
    './src/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        surface: '#111111',
        'surface-2': '#161616',
        'surface-3': '#1A1A1A',
        border: '#1F1F1F',
        'border-2': '#2A2A2A',
        text: '#F5F5F5',
        'text-2': '#A8A8A8',
        'text-3': '#6B6B6B',
        'text-4': '#3F3F3F',
        accent: '#D4FF4F',
        'accent-dim': '#8FAA2E',
        danger: '#FF5B5B',
        // graphite warm palette
        'bg-warm': '#14110F',
        'surface-warm': '#1C1815',
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-semibold': ['JetBrainsMono_600SemiBold'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
      fontSize: {
        '2xs': '9px',
        xs: '10px',
        sm: '11px',
        base: '13px',
        md: '15px',
        xl: '22px',
        '2xl': '28px',
        hero: '44px',
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        md: '4px',
      },
    },
  },
  plugins: [],
};
