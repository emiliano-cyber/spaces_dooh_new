'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { NotasDeVersion } from '@/components/demo/novedades/NotasDeVersion'
import { getNovedadesApi, type NovedadesDeLaInstancia } from '@/lib/data/novedades-api'
import type { EntradaNovedades, TipoNovedad } from '@/lib/novedades'
import { formatFecha } from '@/lib/data/client'
import { conteo } from '@/lib/plural'
import { EmptyState } from '@/components/demo/EmptyState'
import { Chip } from '@/components/demo/admin/Chip'

// ============================================================================
//  /novedades — todas las versiones y lo que trajo cada una (pedido del dueno,
//  2026-10-01). Se llega desde el dialogo de despues de instalar.
//
//  SIN entrada en el menu y SIN entrada en `nav.ts`, a proposito: la ve todo
//  rol con sesion, y una ruta que el NAV no conoce no tiene puerta en
//  `AuthGate` (`moduloDe()` devuelve null). Eso es justo lo que se quiere aqui
//  -- el endpoint solo exige sesion--, y `nav.ts` es de alto contacto.
//
//  Las notas se piden al servidor y no se importan: importar `novedades.json`
//  aqui lo meteria en el bundle del navegador (ver `lib/novedades.ts`).
// ============================================================================

export default function NovedadesPage() {
  const [datos, setDatos] = useState<NovedadesDeLaInstancia | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getNovedadesApi().then(setDatos).catch(() => setError(true))
  }, [])

  return (
    <div className="w-full space-y-4">
      {/* Encabezado como el de los demás módulos (`text-2xl`, sin icono). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Novedades</h1>
          <p className="mt-1 text-[13px] text-muted">Lo que trajo cada versión de SPACE OS, de la más nueva a la más vieja.</p>
        </div>
        {datos?.version && (
          <Chip tono="acento" className="mt-1">
            Versión instalada: <span className="demo-num">{datos.version}</span>
          </Chip>
        )}
      </div>

      <div className="max-w-4xl space-y-4">
      {error ? (
        <EmptyState icon={Sparkles} titulo="No se pudieron cargar las novedades." />
      ) : !datos ? (
        <div className="h-24 animate-pulse rounded bg-surface-2" />
      ) : datos.novedades.length === 0 ? (
        <EmptyState icon={Sparkles} titulo="Todavía no hay notas de versión." />
      ) : (
        datos.novedades.map((e, i) => {
          // La que corre esta instancia: compara la ENTRADA, asi una
          // precandidata (v0.9.2-rc1) marca la de v0.9.2.
          const instalada = datos.notas?.version === e.version
          return (
          // Un `id` por versión: plegar la v0.9 no debe plegar la que llegue
          // después. La fecha y la marca «Instalada» van en `resumen`, que es
          // donde CardColapsable pone las cifras del encabezado.
          //
          // Solo la más nueva y la instalada llegan abiertas: con todas
          // abiertas la página era un único scroll larguísimo. Lo que la
          // persona pliega o abre lo sigue recordando el `id`.
          <CardColapsable
            key={e.version}
            id={`novedades.${e.version}`}
            titulo={e.version}
            defaultAbierto={i === 0 || instalada}
            resumen={
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="demo-num text-[12px] text-muted">{formatFecha(e.fecha)}</span>
                {instalada && <Chip tono="acento">Instalada</Chip>}
                {conteosDe(e.items).map((c) => (
                  <Chip key={c}><span className="demo-num">{c}</span></Chip>
                ))}
              </span>
            }
          >
            <NotasDeVersion notas={e} />
          </CardColapsable>
          )
        })
      )}
      </div>
    </div>
  )
}

// «3 nuevas · 2 ajustes · 1 corrección», contados sobre los items de la
// versión. No usa `agruparPorTipo` (ni lo cambia): solo cuenta, y en el mismo
// orden Nuevo → Ajustado → Corregido.
function conteosDe(items: EntradaNovedades['items']): string[] {
  const n = (t: TipoNovedad) => items.filter((x) => x.tipo === t).length
  return [
    n('NUEVO') > 0 ? conteo(n('NUEVO'), 'nueva') : null,
    n('AJUSTADO') > 0 ? conteo(n('AJUSTADO'), 'ajuste') : null,
    n('CORREGIDO') > 0 ? conteo(n('CORREGIDO'), 'corrección', 'correcciones') : null,
  ].filter((x): x is string => x !== null)
}
