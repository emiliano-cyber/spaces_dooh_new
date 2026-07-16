import type { Config } from 'tailwindcss'

// ============================================================================
//  Tailwind SOLO para la demo (/demo). preflight DESACTIVADO para no inyectar
//  un reset global que rompa la app de producción (que no usa Tailwind). El
//  reset equivalente se aplica scoped bajo `.demo-root` en app/demo/demo.css.
//  `content` se limita al árbol /demo para no generar utilidades de más.
// ============================================================================

const config: Config = {
  content: [
    './app/demo/**/*.{ts,tsx}',
    './components/demo/**/*.{ts,tsx}',
    // OTVista (vista de OT) vive fuera de /demo pero se usa en /demo/operaciones
    // y /demo/m/ot; se incluye para que sus utilidades (p. ej. lg:grid-cols-2)
    // se generen.
    './components/operaciones/**/*.{ts,tsx}',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        ink: 'var(--ink)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        muted: 'var(--muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          fg: 'var(--accent-fg)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        live: 'var(--live)',
        fuego: 'var(--fuego)',
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        error: {
          DEFAULT: 'var(--error)',
          soft: 'var(--error-soft)',
        },
        info: 'var(--info)',
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
