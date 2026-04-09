'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type FormValues = z.infer<typeof schema>

function getRoleRedirect(rol: string): string {
  switch (rol) {
    case 'owner':
    case 'admin':
      return '/admin'
    case 'seller':
    case 'comercial_manager':
      return '/comercial'
    case 'crew_chief':
    case 'field_worker':
      return '/operaciones'
    case 'trafficker':
      return '/comercial/digital'
    default:
      return '/admin'
  }
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema as any) })

  async function onSubmit(data: FormValues) {
    setServerError(null)
    try {
      const user = await login(data.email, data.password)
      router.push(getRoleRedirect(user.rol))
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Spaces DOOH</h1>
          <p style={styles.subtitle}>Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={styles.form} noValidate>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@empresa.com"
              style={{
                ...styles.input,
                ...(errors.email ? styles.inputError : {}),
              }}
              {...register('email')}
            />
            {errors.email && (
              <span style={styles.fieldError}>{errors.email.message}</span>
            )}
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
              style={{
                ...styles.input,
                ...(errors.password ? styles.inputError : {}),
              }}
              {...register('password')}
            />
            {errors.password && (
              <span style={styles.fieldError}>{errors.password.message}</span>
            )}
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
