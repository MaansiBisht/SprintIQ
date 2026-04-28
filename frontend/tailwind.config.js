/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Atlassian N-scale neutrals */
        'n-0':   'var(--n-0)',
        'n-10':  'var(--n-10)',
        'n-20':  'var(--n-20)',
        'n-30':  'var(--n-30)',
        'n-40':  'var(--n-40)',
        'n-50':  'var(--n-50)',
        'n-100': 'var(--n-100)',
        'n-200': 'var(--n-200)',
        'n-300': 'var(--n-300)',
        'n-400': 'var(--n-400)',
        'n-500': 'var(--n-500)',

        /* Surfaces */
        bg:               'var(--bg)',
        'bg-2':           'var(--bg-2)',
        'bg-3':           'var(--bg-3)',
        surface:          'var(--surface)',
        'surface-raised': 'var(--surface-raised)',

        /* Foreground */
        fg:            'var(--fg)',
        'fg-muted':    'var(--fg-muted)',
        'fg-subtle':   'var(--fg-subtle)',
        'fg-faint':    'var(--fg-faint)',
        'fg-inverse':  'var(--fg-inverse)',

        /* Borders */
        border:          'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-subtle': 'var(--border-subtle)',

        /* Blue — Jira primary */
        blue:        'var(--blue)',
        'blue-2':    'var(--blue-2)',
        'blue-soft': 'var(--blue-soft)',
        'blue-tint': 'var(--blue-tint)',
        'blue-deep': 'var(--blue-deep)',

        /* Coral — AI accent */
        coral:        'var(--coral)',
        'coral-2':    'var(--coral-2)',
        'coral-soft': 'var(--coral-soft)',
        'coral-deep': 'var(--coral-deep)',
        'coral-glow': 'var(--coral-glow)',

        /* Semantic */
        green:        'var(--green)',
        'green-soft': 'var(--green-soft)',
        yellow:       'var(--yellow)',
        'yellow-soft':'var(--yellow-soft)',
        red:          'var(--red)',
        'red-soft':   'var(--red-soft)',
        purple:       'var(--purple)',
        'purple-soft':'var(--purple-soft)',
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono:  ['var(--font-mono)',  'ui-monospace', 'SF Mono', 'monospace'],
      },
      borderRadius: {
        'r-xs': 'var(--r-xs)',
        'r-sm': 'var(--r-sm)',
        'r':    'var(--r)',
        'r-lg': 'var(--r-lg)',
      },
    },
  },
  plugins: [],
};
