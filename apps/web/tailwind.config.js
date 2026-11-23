/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: 'var(--border)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        primary: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff',
          hover: '#2563eb',
        },
        accent: {
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
        },
        critical: {
          DEFAULT: '#ef4444',
          subtle: '#ef444415',
          border: '#ef444440',
        },
        high: {
          DEFAULT: '#f97316',
          subtle: '#f9731615',
          border: '#f9731640',
        },
        medium: {
          DEFAULT: '#eab308',
          subtle: '#eab30815',
          border: '#eab30840',
        },
        low: {
          DEFAULT: '#3b82f6',
          subtle: '#3b82f615',
          border: '#3b82f640',
        },
        passed: {
          DEFAULT: '#10b981',
          subtle: '#10b98115',
          border: '#10b98140',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
