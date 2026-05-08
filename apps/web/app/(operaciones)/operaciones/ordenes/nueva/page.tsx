'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'

const TIPO_OT_OPTIONS = [
  ['MONTAJE_LONA', 'Montaje de lona'],
  ['MONTAJE_DIGITAL', 'Montaje digital'],
  ['DESMONTAJE', 'Desmontaje'],
  ['MANTENIMIENTO_PREVENTIVO', 'Mantenimiento preventivo'],
  ['MANTENIMIENTO_CORRECTIVO', 'Mantenimiento correctivo'],
  ['HERRERIA', 'Herrería'],
  ['ELECTRICO', 'Eléctrico'],
  ['INSPECCION', 'Inspección'],
  ['OTRO', 'Otro'],
] as const

const PRIORIDAD_OPTIONS = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const

const schema = z.object({
  sitioId: z.string().optional(),
  descripcion: z.string().min(10, 'Mínimo 10 caracteres'),
  instrucciones: z.string().optional(),
  prioridad: z.enum(['BAJA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  asignadoAUserId: z.string().optional(),
  fechaProgramada: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface SitioOption { id: string; nombre: string; claveInterna: string }
interface UserOption { id: string; nombre: string; email: string }

export default function NuevaOTPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<string[]>([''])
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(['MANTENIMIENTO_CORRECTIVO'])

  const canAssign = user?.rol === 'owner' || user?.rol === 'admin' || user?.permisos?.includes('ots:assign')

  function toggleTipo(value: string) {
    setTiposSeleccionados((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    )
  }

  const { data: sitios } = useQuery({
    queryKey: ['sitios-select'],
    queryFn: () => apiFetch<{ data: SitioOption[] }>('/sitios?limit=500').then((r) => r.data),
  })

  const { data: users, isError: usersError } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => apiFetch<UserOption[]>('/admin/users'),
    enabled: !!canAssign,
    retry: 1,
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: { prioridad: 'NORMAL' },
  })

  async function onSubmit(data: FormValues) {
    setServerError(null)
    if (tiposSeleccionados.length === 0) { setServerError('Selecciona al menos un tipo'); return }
    try {
      const checklistItems = checklist.filter((t) => t.trim()).map((texto) => ({ texto }))
      const ot = await apiFetch<{ id: string }>('/ordenes-trabajo', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          tipo: tiposSeleccionados.join(','),
          sitioId: data.sitioId || undefined,
          asignadoAUserId: data.asignadoAUserId || undefined,
          fechaProgramada: data.fechaProgramada ? new Date(data.fechaProgramada).toISOString() : undefined,
          checklist: checklistItems.length ? checklistItems : undefined,
        }),
      })
      router.push(`/operaciones/ordenes/${ot.id}`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al crear la OT')
    }
  }

  function addChecklistItem() { setChecklist((c) => [...c, '']) }
  function removeChecklistItem(i: number) { setChecklist((c) => c.filter((_, idx) => idx !== i)) }
  function updateChecklistItem(i: number, val: string) { setChecklist((c) => c.map((v, idx) => idx === i ? val : v)) }

  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.9rem', padding: '0.55rem 0.875rem', outline: 'none', width: '100%' }
  const inpErr: React.CSSProperties = { ...inp, borderColor: 'var(--error)' }
  const lbl: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', marginBottom: '0.3rem', display: 'block' }
  const errS: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.2rem' }
  const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '0.5rem' }}>
          ← Volver
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Nueva orden de trabajo</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>
        {/* Tipo multi-select + Prioridad */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fld}>
            <label style={lbl}>Conceptos de trabajo *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '0.5rem 0.75rem', maxHeight: 220, overflowY: 'auto' }}>
              {TIPO_OT_OPTIONS.map(([value, label]) => (
                <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.25rem 0' }}>
                  <input
                    type="checkbox"
                    checked={tiposSeleccionados.includes(value)}
                    onChange={() => toggleTipo(value)}
                    style={{ width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: tiposSeleccionados.includes(value) ? 'var(--fg)' : 'var(--muted)', fontWeight: tiposSeleccionados.includes(value) ? 500 : 400 }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {tiposSeleccionados.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.375rem' }}>
                {tiposSeleccionados.map((t) => (
                  <span key={t} style={{ background: 'rgba(10,102,255,0.15)', color: '#0A66FF', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem' }}>
                    {TIPO_OT_OPTIONS.find(([v]) => v === t)?.[1] ?? t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={fld}>
            <label style={lbl}>Prioridad</label>
            <select style={inp} {...register('prioridad')}>
              {PRIORIDAD_OPTIONS.map((v) => <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>

        {/* Sitio */}
        <div style={fld}>
          <label style={lbl}>Sitio</label>
          <select style={inp} {...register('sitioId')}>
            <option value="">Sin sitio asignado</option>
            {(sitios ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.claveInterna} — {s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div style={fld}>
          <label style={lbl}>Descripción *</label>
          <textarea rows={3} style={errors.descripcion ? { ...inpErr, resize: 'vertical' } : { ...inp, resize: 'vertical' }} placeholder="Describe el trabajo a realizar (mínimo 10 caracteres)…" {...register('descripcion')} />
          {errors.descripcion && <span style={errS}>{errors.descripcion.message}</span>}
        </div>

        {/* Instrucciones */}
        <div style={fld}>
          <label style={lbl}>Instrucciones <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(opcional)</span></label>
          <textarea rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Indicaciones específicas, materiales requeridos…" {...register('instrucciones')} />
        </div>

        {/* Checklist dinámico */}
        <div style={fld}>
          <label style={lbl}>Checklist</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                <input
                  style={{ ...inp, flex: 1 }}
                  placeholder={`Item ${i + 1}…`}
                  value={item}
                  onChange={(e) => updateChecklistItem(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeChecklistItem(i)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--error)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.4rem 0.6rem', flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addChecklistItem}
              style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.4rem 0.875rem', transition: 'all 0.15s' }}
            >
              + Agregar item
            </button>
          </div>
        </div>

        {/* Asignado a + Fecha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fld}>
            <label style={lbl}>Asignar a</label>
            <select style={inp} {...register('asignadoAUserId')}>
              <option value="">{usersError ? 'Error al cargar usuarios' : 'Sin asignar'}</option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
            {usersError && (
              <span style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.2rem' }}>
                No se pudieron cargar los usuarios. Verifica que tengas permisos.
              </span>
            )}
          </div>
          <div style={fld}>
            <label style={lbl}>Fecha programada</label>
            <input type="date" style={inp} {...register('fechaProgramada')} />
          </div>
        </div>

        {serverError && (
          <div style={{ background: 'rgba(185,28,28,0.1)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '0.875rem', padding: '0.75rem 1rem' }}>
            {serverError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button type="submit" disabled={isSubmitting} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, padding: '0.7rem 1.5rem', opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? 'Creando…' : 'Crear orden'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.9375rem', padding: '0.7rem 1.25rem' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
