/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* IO Education design tokens (via CSS vars in index.css) */
        'io-bg':            'hsl(var(--io-bg))',
        'io-surface':       'hsl(var(--io-surface))',
        'io-surface-2':     'hsl(var(--io-surface-2))',
        'io-muted':         'hsl(var(--io-muted))',
        'io-border':        'hsl(var(--io-border))',
        'io-text':          'hsl(var(--io-text))',
        'io-text-muted':    'hsl(var(--io-text-muted))',
        'io-primary':       'hsl(var(--io-primary))',      // Sapphire
        'io-primary-fg':    'hsl(var(--io-primary-fg))',
        'io-accent':        'hsl(var(--io-accent))',       // Teal
        'io-accent-fg':     'hsl(var(--io-accent-fg))',
        'io-highlight':     'hsl(var(--io-highlight))',
        'io-highlight-fg':  'hsl(var(--io-highlight-fg))',
        'io-success':       'hsl(var(--io-success))',
        'io-danger':        'hsl(var(--io-danger))',
        'io-warning':       'hsl(var(--io-warning))',
      },
      boxShadow: {
        io: '0 10px 28px rgba(0,0,0,.38)',
      },
      borderRadius: {
        io: '1rem',
      },
    },
  },
  plugins: [],
};
