'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { NotasDeVersion } from '@/components/demo/novedades/NotasDeVersion'
import { getNovedadesApi, type NovedadesDeLaInstancia } from '@/lib/data/novedades-api'

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
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <Sparkles className="h-5 w-5 text-accent" /> Novedades
        </h1>
        <p className="text-[13px] text-muted">Lo que trajo cada versión de SPACE OS, de la más nueva a la más vieja.</p>
      </div>

      {error ? (
        <p className="text-[13px] text-error">No se pudieron cargar las novedades.</p>
      ) : !datos ? (
        <div className="h-24 animate-pulse rounded bg-surface-2" />
      ) : datos.novedades.length === 0 ? (
        <p className="text-[13px] text-muted">Todavía no hay notas de versión.</p>
      ) : (
        datos.novedades.map((e) => (
          <Card key={e.version}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="demo-num">{e.version}</span>
                <span className="text-[12px] font-normal text-muted">{e.fecha}</span>
                {/* La que corre esta instancia: compara la ENTRADA, asi una
                    precandidata (v0.9.2-rc1) marca la de v0.9.2. */}
                {datos.notas?.version === e.version && (
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-accent">Instalada</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NotasDeVersion notas={e} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
