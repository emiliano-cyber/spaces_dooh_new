'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'

const TIPO_MEDIO_OPTIONS = [
  ['ESPECTACULAR', 'Espectacular'],
  ['PANTALLA_DIGITAL', 'Pantalla Digital'],
  ['PUENTE_PEATONAL', 'Puente Peatonal'],
  ['MOBILIARIO_URBANO', 'Mobiliario Urbano'],
  ['MURAL', 'Mural'],
  ['VALLA', 'Valla'],
  ['OTRO', 'Otro'],
] as const

const schema = z.object({
  claveInterna: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  tipoMedio: z.enum(['ESPECTACULAR', 'PANTALLA_DIGITAL', 'PUENTE_PEATONAL', 'MOBILIARIO_URBANO', 'MURAL', 'VALLA', 'OTRO']),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  direccion: z.string().min(1, 'Requerido'),
  alcaldia: z.string().optional(),
  ciudad: z.string().min(1, 'Requerido'),
  estado: z.string().min(1, 'Requerido'),
  alto: z.coerce.number().positive().optional().or(z.literal('')),
  ancho: z.coerce.number().positive().optional().or(z.literal('')),
  iluminado: z.boolean().default(false),
  orientacion: z.string().optional(),
  notas: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NuevoSitioPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: { iluminado: false, tipoMedio: 'ESPECTACULAR' },
  })

  async function onSubmit(data: FormValues) {
    setServerError(null)
    try {
      const sitio = await apiFetch<{ id: string }>('/sitios', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          alto: data.alto === '' ? undefined : data.alto,
          ancho: data.ancho === '' ? undefined : data.ancho,
        }),
      })
      router.push(`/inmuebles/sitios/${sitio.id}`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al crear el sitio')
    }
  }

  const input: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.9rem', padding: '0.55rem 0.875rem', outline: 'none', width: '100%' }
  const inputErr: React.CSSProperties = { ...input, borderColor: 'var(--error)' }
  const label: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', marginBottom: '0.3rem', display: 'block' }
  const err: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.2rem' }
  const field: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '0.5rem' }}>
          ← Volver
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Nuevo sitio</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={field}>
            <label style={label}>Clave interna *</label>
            <input style={errors.claveInterna ? inputErr : input} placeholder="MEX-CDMX-001" {...register('claveInterna')} />
            {errors.claveInterna && <span style={err}>{errors.claveInterna.message}</span>}
          </div>
          <div style={field}>
            <label style={label}>Nombre *</label>
            <input style={errors.nombre ? inputErr : input} placeholder="Espectacular Insurgentes Norte" {...register('nombre')} />
            {errors.nombre && <span style={err}>{errors.nombre.message}</span>}
          </div>
        </div>

        <div style={field}>
          <label style={label}>Tipo de medio *</label>
          <select style={input} {...register('tipoMedio')}>
            {TIPO_MEDIO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={field}>
            <label style={label}>Latitud *</label>
            <input type="number" step="any" style={errors.lat ? inputErr : input} placeholder="19.4979" {...register('lat')} />
            {errors.lat && <span style={err}>{errors.lat.message}</span>}
          </div>
          <div style={field}>
            <label style={label}>Longitud *</label>
            <input type="number" step="any" style={errors.lng ? inputErr : input} placeholder="-99.1376" {...register('lng')} />
            {errors.lng && <span style={err}>{errors.lng.message}</span>}
          </div>
        </div>

        <div style={field}>
          <label style={label}>Dirección *</label>
          <input style={errors.direccion ? inputErr : input} placeholder="Av. Insurgentes Norte 1000" {...register('direccion')} />
          {errors.direccion && <span style={err}>{errors.direccion.message}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div style={field}>
            <label style={label}>Alcaldía / Municipio</label>
            <input style={input} placeholder="Gustavo A. Madero" {...register('alcaldia')} />
          </div>
          <div style={field}>
            <label style={label}>Ciudad *</label>
            <input style={errors.ciudad ? inputErr : input} placeholder="Ciudad de México" {...register('ciudad')} />
            {errors.ciudad && <span style={err}>{errors.ciudad.message}</span>}
          </div>
          <div style={field}>
            <label style={label}>Estado *</label>
            <input style={errors.estado ? inputErr : input} placeholder="CDMX" {...register('estado')} />
            {errors.estado && <span style={err}>{errors.estado.message}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div style={field}>
            <label style={label}>Alto (m)</label>
            <input type="number" step="0.1" style={input} placeholder="8.5" {...register('alto')} />
          </div>
          <div style={field}>
            <label style={label}>Ancho (m)</label>
            <input type="number" step="0.1" style={input} placeholder="14.0" {...register('ancho')} />
          </div>
          <div style={field}>
            <label style={label}>Orientación</label>
            <input style={input} placeholder="Norte-Sur" {...register('orientacion')} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <input type="checkbox" id="iluminado" {...register('iluminado')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="iluminado" style={{ ...label, marginBottom: 0, cursor: 'pointer' }}>Iluminado</label>
        </div>

        <div style={field}>
          <label style={label}>Notas</label>
          <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Observaciones adicionales…" {...register('notas')} />
        </div>

        {serverError && (
          <div style={{ background: 'rgba(255,92,115,0.1)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '0.875rem', padding: '0.75rem 1rem' }}>
            {serverError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button type="submit" disabled={isSubmitting} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, padding: '0.7rem 1.5rem', opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? 'Guardando…' : 'Crear sitio'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.9375rem', padding: '0.7rem 1.25rem' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
