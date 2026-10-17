import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        terracotta: {
          50: '#fdf6f2',
          100: '#faeae3',
          200: '#f5d6c8',
          300: '#ebb6a0',
          400: '#dc8d6f',
          500: '#cc6d49',
          600: '#b85d3b',
          700: '#9b4a2e',
          800: '#7f3e29',
          900: '#683626',
          950: '#381911',
        },
        champagne: {
          50: '#fbf9f3',
          100: '#f6f1e3',
          200: '#ebe1c4',
          300: '#ddcca0',
          400: '#c5a059',
          500: '#b88f44',
          600: '#a37736',
          700: '#835a2c',
        },
        atelier: {
          50: '#faf8f5',
          100: '#f5f2eb',
          200: '#eae4d8',
          300: '#dbcfbc',
          400: '#c4b299',
          500: '#ab9579',
          600: '#937c62',
          700: '#77634f',
          800: '#615142',
          900: '#292524',
          950: '#181614',
        },
        greige: {
          50: '#faf8f5',
          100: '#f5f2ec',
          200: '#ece7dd',
          300: '#ded7ca',
          400: '#c5bcad',
          500: '#a89c8b',
          600: '#8d806e',
        },
        sage: {
          50: '#f4f6f4',
          100: '#e5eae4',
          500: '#4e5b4b',
          600: '#404c3d',
          700: '#343e32',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(145deg, #181614 0%, #25211e 40%, #352f2a 75%, #181614 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-12px)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glow-indigo': '0 0 40px rgba(79, 70, 229, 0.3)',
        'glow-terracotta': '0 0 35px rgba(184, 93, 59, 0.35)',
        'glow-champagne': '0 0 35px rgba(197, 160, 89, 0.3)',
        'glow-amber':  '0 0 30px rgba(217, 119, 6, 0.2)',
        'card':        '0 8px 32px rgba(24, 22, 20, 0.06)',
        'card-hover':  '0 16px 48px rgba(24, 22, 20, 0.12)',
      },
    },
  },
  plugins: [],
}
export default config
