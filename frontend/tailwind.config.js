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
        paper: {
          light: '#F4EFE6',
          dark: '#141414',
          DEFAULT: 'var(--color-paper)',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E1E1E',
          DEFAULT: 'var(--color-surface)',
        },
        'surface-2': {
          light: '#EAE3D3',
          dark: '#2A2A2A',
          DEFAULT: 'var(--color-surface-2)',
        },
        ink: {
          light: '#111111',
          dark: '#F4EFE6',
          DEFAULT: 'var(--color-ink)',
        },
        muted: {
          light: '#4A4740',
          dark: '#A39E93',
          DEFAULT: 'var(--color-muted)',
        },
        cobalt: {
          light: '#2F4BFF',
          dark: '#6F86FF',
          DEFAULT: 'var(--color-cobalt)',
        },
        tangerine: {
          light: '#FF6B2C',
          dark: '#FF8A55',
          DEFAULT: 'var(--color-tangerine)',
        },
        mint: {
          light: '#2DD4A0',
          dark: '#3DE0AE',
          DEFAULT: 'var(--color-mint)',
        },
        sun: {
          light: '#FFC53D',
          dark: '#FFD166',
          DEFAULT: 'var(--color-sun)',
        },
        tomato: {
          light: '#E5383B',
          dark: '#FF5A5D',
          DEFAULT: 'var(--color-tomato)',
        },
        sky: {
          light: '#5BC0EB',
          dark: '#7CD0F2',
          DEFAULT: 'var(--color-sky)',
        },
      },
      boxShadow: {
        'brutal-sm': '2px 2px 0 var(--color-ink)',
        'brutal': '4px 4px 0 var(--color-ink)',
        'brutal-lg': '6px 6px 0 var(--color-ink)',
        'brutal-none': '0 0 0 transparent',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderWidth: {
        '2': '2px',
        '3': '3px',
      },
    },
  },
  plugins: [],
};
