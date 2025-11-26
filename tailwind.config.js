/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './public/index.html',     // CRA / Vite (public)
    './index.html',            // Vite root (safe to include)
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* IO Education tokens (defined as CSS variables in index.css) */
        'io-bg':           'hsl(var(--io-bg))',
        'io-surface':      'hsl(var(--io-surface))',
        'io-soft':         'hsl(var(--io-soft))',
        'io-border':       'hsl(var(--io-border))',
        'io-text':         'hsl(var(--io-text))',
        'io-text-muted':   'hsl(var(--io-text-muted))',

        'io-primary':      'hsl(var(--io-primary))',
        'io-primary-fg':   'hsl(var(--io-primary-fg))',
        'io-accent':       'hsl(var(--io-accent))',
        'io-accent-fg':    'hsl(var(--io-accent-fg))',
        'io-highlight':    'hsl(var(--io-highlight))',
        'io-highlight-fg': 'hsl(var(--io-highlight-fg))',

        'io-success':      'hsl(var(--io-success))',
        'io-warning':      'hsl(var(--io-warning))',
        'io-danger':       'hsl(var(--io-danger))',

        /* Legacy shims (so old classes don’t 404 while migrating) */
        'sigma-blue':   'hsl(var(--io-primary))',
        'sigma-dark':   'hsl(var(--io-bg))',
        'sigma-light':  'hsl(var(--io-surface))',
        'teacher-red':  'hsl(var(--io-danger))',
        'teacher-green':'hsl(var(--io-success))',
      },
      boxShadow: {
        io: '0 6px 24px rgba(0,0,0,0.35)',
        card: '0 6px 16px rgba(0,0,0,0.35), 0 1px 1px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        io: '1rem',
      },
    },
  },
  // Optional: safelist a few theme classes that might be applied dynamically
  safelist: [
    'bg-io-bg', 'bg-io-surface', 'bg-io-soft',
    'text-io-text', 'text-io-text-muted',
    'border-io-border',
    'bg-io-primary', 'text-io-primary',
    'bg-io-accent', 'text-io-accent',
    'bg-io-highlight', 'text-io-highlight',
  ],
  plugins: [],
};
