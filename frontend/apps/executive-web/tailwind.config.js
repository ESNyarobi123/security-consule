/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Slightly roomier defaults for executive readability
        xs: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        sm: ['0.9375rem', { lineHeight: '1.4rem' }], // 15px
        base: ['1.0625rem', { lineHeight: '1.65rem' }], // 17px
        lg: ['1.1875rem', { lineHeight: '1.75rem' }], // 19px
        xl: ['1.375rem', { lineHeight: '1.9rem' }], // 22px
        '2xl': ['1.625rem', { lineHeight: '2.1rem' }], // 26px
        '3xl': ['2rem', { lineHeight: '2.35rem' }], // 32px
        '4xl': ['2.375rem', { lineHeight: '2.6rem' }], // 38px
      },
    },
  },
  plugins: [],
};
