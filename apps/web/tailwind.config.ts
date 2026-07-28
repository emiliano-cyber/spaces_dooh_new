import type { Config } from 'tailwindcss'

// ============================================================================
//  Tailwind SOLO para la demo (/demo). preflight DESACTIVADO para no inyectar
//  un reset global que rompa la app de producción (que no usa Tailwind). El
//  reset equivalente se aplica scoped bajo `.demo-root` en app/demo/demo.css.
//  `content` se limita al árbol /demo para no generar utilidades de más.
// ============================================================================

const config: Config = {
  // OJO: estos globs deben cubrir TODO archivo que escriba clases de Tailwind.
  // Antes apuntaban a './app/demo/**', ruta que dejó de existir cuando las
  // pantallas se movieron a './app/(app)/...'. Resultado: ninguna clase usada
  // ÚNICAMENTE dentro de app/ llegaba al CSS (p. ej. `lg:flex-row` del detalle
  // de campaña, que dejaba el menú de campañas apilado sobre el contenido).
  // Los paréntesis y corchetes de las rutas de Next —(app), (shell), [id]— los
  // resuelve `**` sin problema: son nombres de carpeta reales, no patrones.
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
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
