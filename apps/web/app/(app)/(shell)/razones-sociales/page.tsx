'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { GestionEntidadesFiscales } from '@/components/demo/razones-sociales/GestionEntidadesFiscales'
import type { EntidadUI } from '@/components/demo/razones-sociales/gestion'
import type { RolCatalogo } from '@/lib/cuestionario-entidades'

const API = '/spaces-dooh/api'

// ============================================================================
//  /razones-sociales — la identidad fiscal del negocio.
// ----------------------------------------------------------------------------
//  Las razones sociales PROPIAS del owner: con cuál paga las rentas, con cuál
//  compra los activos, con cuál tramita licencias y con cuál vende.
//
//  ─── Por qué esta pantalla existe ─────────────────────────────────────────
//  El backend está desde el 2026-09-17 y el cuestionario de bienvenida desde el
//  18/09, y hasta hoy NADA en `app/` consumía ninguno de los dos. El
//  cuestionario, además, le decía al usuario «para cambiarlas o añadir otra, ve
//  a Administración» — donde no había nada. Una promesa escrita que el producto
//  no cumplía, y por eso el dueño pidió el 18/09 la pantalla completa.
//
//  ─── Por qué NO lee del store ─────────────────────────────────────────────
//  El shell hidrata `entidadesFiscales` desde `/api/estado`, y esta pantalla
//  usa `/api/entidades/?inactivas=1` en su lugar. Dos motivos:
//   · necesita el CATÁLOGO de papeles con sus etiquetas, que no viaja en el
//     estado del shell porque solo lo usa esta pantalla;
//   · y necesita releer justo después de escribir. `refrescarEstado()` ya
//     refresca el store para el resto de la aplicación; esto refresca lo que
//     esta pantalla pinta.
//
//  Va bajo `administracion` y no bajo `arrendadores`, igual que sus endpoints y
//  por el mismo motivo: es la identidad fiscal del negocio, no un dato
//  operativo del módulo de propietarios. Quien captura contratos no decide con
//  qué sociedad se firma.
//
//  OJO, la confusión que ya vive en el repositorio: `/arrendadores` tiene su
//  propia tarjeta de «Razones sociales», y ésas son las del ARRENDADOR —quien
//  me COBRA la renta—. Ésta es la del OWNER —quien la PAGA—. Son dos catálogos
//  distintos y ninguno sustituye al otro.
// ============================================================================

interface Respuesta {
  entidades: EntidadUI[]
  catalogo: RolCatalogo[]
}

export default function RazonesSocialesPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      // `inactivas=1`: esta pantalla es la única que tiene que ver las dadas de
      // baja, porque es la única desde la que se reactivan. El resto de la
      // aplicación no las ofrece al capturar.
      const r = await fetch(`${API}/entidades/?inactivas=1`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        // El 403 se dice por su nombre: sin `administracion` no se ve la
        // identidad fiscal, y un «no se pudo cargar» dejaría a quien lo ve
        // buscando un fallo que no existe.
        setError(
          r.status === 403
            ? 'Tu rol no tiene acceso a la administración de la organización.'
            : (d?.error ?? 'No se pudieron cargar las razones sociales'),
        )
        return
      }
      setError(null)
      setDatos({ entidades: d.entidades ?? [], catalogo: d.catalogo ?? [] })
    } catch {
      setError('No se pudieron cargar las razones sociales')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl text-ink">
          <Building2 className="h-5 w-5 text-muted" /> Razones sociales
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Las de tu empresa · con cuál pagas las rentas, compras los activos, tramitas licencias y
          vendes
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-4">
            <p role="alert" className="text-[13px] text-ink">
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {!error && !datos && <div className="h-40 animate-pulse rounded-md bg-surface-2" />}

      {!error && datos && (
        <>
          <GestionEntidadesFiscales
            entidades={datos.entidades}
            catalogo={datos.catalogo}
            // Quien llega aquí ya pasó `administracion.ver` (el GET lo exige).
            // Escribir pide `administracion.crear`, y el intento devuelve 403
            // con su mensaje: esconder los botones a quien solo mira exigiría
            // traer los permisos del rol, que esta pantalla no necesita para
            // nada más.
            puedeEditar
            alCambiar={() => void cargar()}
          />
          {datos.entidades.length === 0 && (
            <p className="text-[12.5px] text-muted">
              Si prefieres capturarlas contestando tres preguntas, el{' '}
              <Link href="/bienvenida" className="underline hover:text-ink">
                cuestionario de bienvenida
              </Link>{' '}
              las crea de una vez con sus papeles.
            </p>
          )}
        </>
      )}
    </div>
  )
}
