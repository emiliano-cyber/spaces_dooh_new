'use client'

import Link from 'next/link'
import { Clock, User, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/demo/ui/Card'
import { CLAVE_ETAPA } from '@/components/demo/comercial-opex/ComercialOpex'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ProspectoNuevo, ProspectosNuevos as Datos } from '@/lib/prospectos-nuevos'

// ============================================================================
//  «Prospectos nuevos» del Resumen de Propuestas (19/11, pedido del dueño:
//  que el equipo vea de un vistazo lo que acaba de entrar).
// ----------------------------------------------------------------------------
//  Los datos llegan con el tablero (`GET /api/propuestas/resumen`), que ya
//  decide quién ve qué: aquí solo se pinta. El criterio —7 días, 6 como
//  máximo, sin perdidos ni rechazados— está en `lib/prospectos-nuevos.ts`.
//
//  Cada tarjeta abre el prospecto en la pestaña Prospectos
//  (`?vista=prospectos&prospecto=<id>`, lo mismo que Seguimiento). Tarjeta
//  fija, sin plegar: el Resumen va siempre desplegado (pedido del 19/11).
// ============================================================================

const RUTA_PROSPECTOS = '/propuestas?vista=prospectos'

export function ProspectosNuevos({ datos }: { datos: Datos | null }) {
  const { t } = useIdioma()
  const dias = datos?.dias ?? 7
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-1.5">
            <UserPlus className="h-4 w-4 text-muted" />
            {t('propuestas.nuevos.titulo')}
          </CardTitle>
          <div className="mt-0.5 text-[12px] text-muted">{t('propuestas.nuevos.subtitulo', { dias })}</div>
        </div>
        {datos && datos.total > datos.lista.length && (
          <Link href={RUTA_PROSPECTOS} className="shrink-0 text-[12px] font-medium text-accent hover:underline">
            {t('inicio.ver-todos', { n: datos.total })}
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {!datos ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-md bg-surface-2" />)}
          </div>
        ) : datos.lista.length === 0 ? (
          <p className="text-[13px] text-muted">{t('propuestas.nuevos.vacio', { dias })}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {datos.lista.map((p) => <Tarjeta key={p.id} p={p} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Tarjeta({ p }: { p: ProspectoNuevo }) {
  const { t } = useIdioma()
  const cuando = p.dias === 0 ? t('propuestas.nuevos.hoy') : p.dias === 1 ? t('propuestas.nuevos.ayer') : t('propuestas.nuevos.hace', { n: p.dias })
  // El contacto: la persona y cómo localizarla, lo que haya.
  const contacto = [p.contactoNombre, p.telefono ?? p.email].filter(Boolean).join(' · ')
  return (
    <li className="min-w-0">
      <Link
        href={`${RUTA_PROSPECTOS}&prospecto=${p.id}`}
        className="block h-full rounded-md border border-border bg-surface p-3 text-[12px] no-underline transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">{t('propuestas.nuevos.etiqueta')}</span>
          <span className="inline-block rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            {t(CLAVE_ETAPA[p.etapa])}
          </span>
        </div>
        <p className="mt-1.5 truncate text-[13px] font-medium text-ink" title={p.nombre}>{p.nombre}</p>
        {p.razonSocial && <p className="truncate text-muted" title={p.razonSocial}>{p.razonSocial}</p>}
        {contacto && <p className="truncate text-muted" title={contacto}>{contacto}</p>}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-1.5 text-muted">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{p.vendedor ?? t('inicio.sin-vendedor')}</span>
          </span>
          <span className="demo-num flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            {cuando}
          </span>
        </div>
      </Link>
    </li>
  )
}
