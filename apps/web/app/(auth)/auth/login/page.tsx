'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

function getRoleRedirect(rol: string): string {
  switch (rol) {
    case 'owner':
    case 'admin':
      return '/comercial'
    case 'seller':
    case 'comercial_manager':
      return '/comercial'
    case 'crew_chief':
    case 'field_worker':
      return '/operaciones'
    case 'trafficker':
      return '/comercial/digital'
    default:
      return '/comercial'
  }
}

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate() {
    const errs: { email?: string; password?: string } = {}
    if (!email) errs.email = 'El email es requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido'
    if (!password) errs.password = 'La contraseña es requerida'
    else if (password.length < 6) errs.password = 'Mínimo 6 caracteres'
    return errs
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setServerError(null)
    setIsSubmitting(true)
    try {
      const user = await login(email, password)
      // Full reload so rehidrate() picks up the session cookie and avoids
      // the race condition where the layout guard fires before user state is set.
      // basePath /spaces-dooh must be prepended manually with window.location.href.
      window.location.href = '/spaces-dooh' + getRoleRedirect(user.rol)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Spaces DOOH</h1>
          <p style={styles.subtitle}>Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((fe) => ({ ...fe, email: undefined })) }}
              style={fieldErrors.email ? { ...styles.input, ...styles.inputError } : styles.input}
            />
            {fieldErrors.email && <span style={styles.fieldError}>{fieldErrors.email}</span>}
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((fe) => ({ ...fe, password: undefined })) }}
              style={fieldErrors.password ? { ...styles.input, ...styles.inputError } : styles.input}
            />
            {fieldErrors.password && <span style={styles.fieldError}>{fieldErrors.password}</span>}
          </div>

          {serverError && (
            <div style={styles.serverError} role="alert">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} style={styles.button}>
            {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--fg)',
    marginBottom: '0.375rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--muted)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--fg)',
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--fg)',
    fontSize: '0.9375rem',
    padding: '0.625rem 0.875rem',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
  },
  inputError: {
    borderColor: 'var(--error)',
  },
  fieldError: {
    fontSize: '0.8125rem',
    color: 'var(--error)',
  },
  serverError: {
    background: 'rgba(255, 92, 115, 0.1)',
    border: '1px solid var(--error)',
    borderRadius: '8px',
    color: 'var(--error)',
    fontSize: '0.875rem',
    padding: '0.625rem 0.875rem',
    textAlign: 'center',
  },
  button: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginTop: '0.25rem',
    padding: '0.75rem',
    transition: 'background 0.15s',
    width: '100%',
  },
}
