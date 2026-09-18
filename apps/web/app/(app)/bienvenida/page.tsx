'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/demo/ui/Button'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { CuestionarioRazonesSociales } from '@/components/demo/bienvenida/CuestionarioRazonesSociales'
import type { RolCatalogo, EntidadConRoles } from '@/lib/cuestionario-entidades'

const API = '/spaces-dooh/api'

// ============================================================================
//  /bienvenida — el cuestionario de las razones sociales del owner.
// ----------------------------------------------------------------------------
//  Va DESPUÉS del alta y no dentro, y esa decisión es la que protege todo lo
//  demás: el bootstrap de una organización es de UN SOLO USO —`hayAlgunTenant()`
//  cierra la puerta para siempre en cuanto existe una organización—, así que un
//  paso más ahí dentro deja instancias que no pueden nacer.
//
//  Fuera de `(shell)` a propósito: es una pantalla de una sola tarea y el
//  chrome de navegación invita a irse a mitad. Quien quiera irse tiene el botón
//  de saltarlo, que es distinto de irse sin enterarse.
//
//  ─── Nadie queda encerrado ────────────────────────────────────────────────
//  Se puede saltar, y se puede volver. Si ya hay razones sociales NO se vuelve
//  a ofrecer: esta pantalla lo dice y manda a Administración, que es donde se
//  cambian. Y «está pendiente» no es una columna — se deriva de que la
//  organización no tenga ninguna entidad, así que no hay estado que pueda
//  quedarse desincronizado del hecho.
// ============================================================================

type Estado = {
  pendiente: boolean
  totalEntidades: number
  roles: RolCatalogo[]
  entidades: EntidadConRoles[]
}

export default function Bienvenida() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch(`${API}/bienvenida/`)
        // Sin sesión no hay nada que preguntar. Esta ruta vive fuera de
        // `(shell)`, así que no tiene el `AuthGate` detrás y el reenvío lo hace
        // la propia pantalla.
        if (r.status === 401) {
          window.location.href = '/spaces-dooh/login/'
          return
        }
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        if (!r.ok) {
          setError(d?.error ?? 'No se pudo cargar el cuestionario')
          return
        }
        setEstado(d as Estado)
      } catch {
        if (vivo) setError('No se pudo cargar el cuestionario')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  const alInicio = () => router.push('/inicio')

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-2xl text-ink">Antes de empezar</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Tres preguntas sobre las razones sociales de tu empresa. Con ellas el sistema sabe a
          nombre de quién se paga una renta y quién emite un comprobante.
        </p>
      </header>

      {error && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <p role="alert" className="text-sm text-ink">
              {error}
            </p>
            <Button variant="secondary" onClick={alInicio}>
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && !estado && <p className="text-sm text-muted">Cargando…</p>}

      {/* Ya contestado: no se vuelve a ofrecer, y se dice dónde se cambia. */}
      {estado && !estado.pendiente && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm text-ink">
              Tu empresa ya tiene{' '}
              {estado.totalEntidades === 1
                ? 'una razón social registrada'
                : `${estado.totalEntidades} razones sociales registradas`}
              , así que este cuestionario ya se contestó.
            </p>
            {estado.entidades.length > 0 && (
              <ul className="space-y-1 rounded border border-border bg-surface-2 p-3 text-[13px]">
                {estado.entidades.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium text-ink">{e.razonSocial}</span>
                    <span className="text-muted">
                      {' '}
                      — {e.roles.length ? e.roles.join(', ') : 'sin roles'}
                      {e.activo === false ? ' (dada de baja)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[13px] text-muted">
              Para cambiarlas o añadir otra, ve a Administración.
            </p>
            <Button variant="secondary" onClick={alInicio}>
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      )}

      {estado && estado.pendiente && (
        <CuestionarioRazonesSociales
          roles={estado.roles}
          // Recarga completa y no `router.push`: el shell hidrata su estado con
          // `/api/estado` al montar, y con una navegación de cliente seguiría
          // enseñando la organización sin ninguna razón social.
          alTerminar={() => {
            window.location.href = '/spaces-dooh/inicio/'
          }}
          alSaltar={alInicio}
        />
      )}
    </main>
  )
}
