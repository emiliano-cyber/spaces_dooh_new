'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { AvisoFranjaCMS } from './AvisoFranjaCMS'
import {
  catalogoRejillaApi,
  guardarFranjaApi,
  bajaFranjaApi,
  guardarTemporadaApi,
  bajaTemporadaApi,
  type FranjaUI,
  type TemporadaUI,
} from '@/lib/data/rejilla-api'
import { motivoFranjaInvalida, motivoTemporadaInvalida } from '@/lib/rejilla'
import { Button } from '@/components/demo/ui/Button'
import { useObligatorios } from '@/components/demo/ui/Campo'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { StatusBadge } from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { formatFecha } from '@/lib/data/client'

// ============================================================================
//  El catálogo de FRANJAS y TEMPORADAS de la organización. ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  LA VALIDACIÓN SE HACE AQUÍ **Y** EN EL SERVIDOR, y no es duplicación: la de
//  aquí sirve para que el usuario vea el choque ANTES de mandar, y la del
//  servidor es la que manda. Las dos llaman a la MISMA función de
//  `lib/rejilla.ts` —`motivoFranjaInvalida`— así que no pueden divergir. Si la
//  regla se escribiera dos veces, un día dirían cosas distintas y ganaría la que
//  el usuario no ve.
//
//  LAS BAJAS SON LÓGICAS. El botón dice «Dar de baja» y no «Eliminar» porque es
//  lo que hace: una franja vendida no se puede borrar
//  (`propuesta_items_franja_fkey` es `on delete restrict`) y lo contratado sigue
//  en pie. Llamarlo «Eliminar» prometería algo que no pasa.
// ============================================================================

const vacioFranja = { nombre: '', horaInicio: '', horaFin: '', orden: 0 }
const vacioTemporada = { nombre: '', desde: '', hasta: '' }

export function GestionRejilla() {
  const [franjas, setFranjas] = useState<FranjaUI[]>([])
  const [temporadas, setTemporadas] = useState<TemporadaUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevaF, setNuevaF] = useState({ ...vacioFranja })
  const [nuevaT, setNuevaT] = useState({ ...vacioTemporada })
  // OBLIG-01 · lo que exige el servidor (`rejilla-controller.ts:41-58`). El
  // orden no: trae 0. Las filas de alta van DENTRO de la tabla y sin etiqueta
  // propia —la etiqueta es la cabecera de la columna—, así que no llevan
  // `Campo`: el asterisco va en la cabecera y el rojo lo pone `globals.css`
  // por el `data-falta` de la celda.
  const obF = useObligatorios(nuevaF, ['nombre', 'horaInicio', 'horaFin'])
  const obT = useObligatorios(nuevaT, ['nombre', 'desde', 'hasta'])

  const cargar = useCallback(async () => {
    try {
      const d = await catalogoRejillaApi(true)
      setFranjas(d.franjas)
      setTemporadas(d.temporadas)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el catálogo')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function anadirFranja() {
    // MISMA función que el servidor. Se compara contra TODAS —también las dadas
    // de baja—: si solo mirara las activas, se podría capturar una franja que se
    // solapa con una apagada y el choque saldría el día que alguien la
    // reactivara, sin saber desde cuándo.
    const completos = obF.validar()
    const motivo = motivoFranjaInvalida({ id: '', ...nuevaF }, franjas)
    if (!completos || motivo) return setError(motivo)
    try {
      await guardarFranjaApi(nuevaF)
      setNuevaF({ ...vacioFranja })
      obF.reiniciar()
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function anadirTemporada() {
    const completos = obT.validar()
    const motivo = motivoTemporadaInvalida({ id: '', ...nuevaT }, temporadas)
    if (!completos || motivo) return setError(motivo)
    try {
      await guardarTemporadaApi(nuevaT)
      setNuevaT({ ...vacioTemporada })
      obT.reiniciar()
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function darDeBaja(tipo: 'franja' | 'temporada', id: string) {
    try {
      if (tipo === 'franja') await bajaFranjaApi(id)
      else await bajaTemporadaApi(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de baja')
    }
  }

  // Esqueleto con la forma de lo que va a llegar (el aviso y las dos tablas),
  // no un «Cargando…» en texto (rediseño del 2026-10-26).
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando el catálogo">
        <div className="h-12 animate-pulse rounded-md bg-surface-2" />
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
        <div className="h-32 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Va ARRIBA del todo, antes de que nadie capture nada: el dueño tiene que
          saber qué NO hace el sistema antes de montar su tabla de precios. */}
      <AvisoFranjaCMS />

      {error && (
        <p role="alert" className="rounded-md border border-error bg-error-soft px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      )}

      {/* PLEG-02 · cada catálogo se pliega por separado. Lo capturado a medias
          en la fila de alta vive en el estado de ESTE componente, no en la
          tarjeta: plegar y desplegar no lo borra.

          Rediseño del 2026-10-26 · el `subtitulo` es una frase corta y la
          explicación completa va como primera línea del contenido, en la
          franja secundaria del Dashboard: con dos o tres renglones de
          subtítulo el chevrón de plegar se caía debajo del texto. */}
      <CardColapsable
        id="franjas-y-temporadas.franjas"
        titulo="Franjas horarias"
        subtitulo="Fin exclusivo · sin solapes"
        contentClassName="space-y-3"
      >
        <p className={FRANJA_EXPLICACION}>
          El fin es <b>exclusivo</b>: 06:00–10:00 y 10:00–14:00 se tocan y no se pisan. Dos
          franjas no pueden solaparse — si pudieran, el precio de un spot a las 09:30 dependería
          de un desempate que nadie decidió.
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className={CABECERA}>
              <th className={TH}>Nombre<Asterisco /></th>
              <th className={TH}>Desde<Asterisco /></th>
              <th className={TH}>Hasta<Asterisco /></th>
              <th className={TH}>Orden</th>
              <th className={TH}>Estado</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {franjas.length === 0 && (
              <tr>
                <td colSpan={6} className={`${CELDA} text-muted`}>
                  Todavía no hay ninguna. Sin franjas, todo se vende con la tarifa base — que es
                  exactamente como funciona hoy.
                </td>
              </tr>
            )}
            {franjas.map((f) => (
              <tr key={f.id} className={f.activo ? '' : 'text-muted line-through'}>
                <td className={cn(CELDA, f.activo && 'text-ink')}>{f.nombre}</td>
                <td className={cn(CELDA, 'demo-num')}>{f.horaInicio}</td>
                <td className={cn(CELDA, 'demo-num')}>{f.horaFin}</td>
                <td className={cn(CELDA, 'demo-num')}>{f.orden}</td>
                {/* El estado también con palabras, no solo con el tachado: el
                    tachado es estilo y se pierde al copiar o con un lector de
                    pantalla. La pastilla es `inline-flex`, así que el tachado
                    de la fila no la cruza. */}
                <td className={CELDA}>
                  <StatusBadge tono={f.activo ? 'verde' : 'neutro'}>{f.activo ? 'Activa' : 'Dada de baja'}</StatusBadge>
                </td>
                <td className={cn(CELDA, 'text-right')}>
                  {f.activo && (
                    <Button
                      type="button"
                      onClick={() => void darDeBaja('franja', f.id)}
                      size="sm"
                      variant="ghost"
                      className="text-error hover:text-error"
                      title="Dar de baja: deja de ofrecerse, y lo ya contratado sigue en pie"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {/* La fila de ALTA, con fondo propio: no es una franja más del
                catálogo y se leía como si lo fuera. */}
            <tr className="bg-surface-2">
              <td className={CELDA} data-falta={obF.falta('nombre') || undefined}>
                <input
                  aria-label="Nombre de la franja"
                  className={cn(CAMPO, 'w-full min-w-[8rem]')}
                  placeholder="p. ej. Prime"
                  value={nuevaF.nombre}
                  onChange={(e) => setNuevaF({ ...nuevaF, nombre: e.target.value })}
                />
              </td>
              <td className={CELDA} data-falta={obF.falta('horaInicio') || undefined}>
                <input
                  aria-label="Hora de inicio"
                  type="time"
                  className={cn(CAMPO, 'demo-num')}
                  value={nuevaF.horaInicio}
                  onChange={(e) => setNuevaF({ ...nuevaF, horaInicio: e.target.value })}
                />
              </td>
              <td className={CELDA} data-falta={obF.falta('horaFin') || undefined}>
                <input
                  aria-label="Hora de fin"
                  type="time"
                  className={cn(CAMPO, 'demo-num')}
                  value={nuevaF.horaFin}
                  onChange={(e) => setNuevaF({ ...nuevaF, horaFin: e.target.value })}
                />
              </td>
              <td className={CELDA}>
                <input
                  aria-label="Orden"
                  type="number"
                  className={cn(CAMPO, 'demo-num w-16')}
                  value={nuevaF.orden}
                  onChange={(e) => setNuevaF({ ...nuevaF, orden: Number(e.target.value) })}
                />
              </td>
              <td className={CELDA} />
              <td className={cn(CELDA, 'text-right')}>
                <Button
                  type="button"
                  onClick={() => void anadirFranja()}
                  size="sm"
                  variant="success"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </CardColapsable>

      <CardColapsable
        id="franjas-y-temporadas.temporadas"
        titulo="Temporadas"
        subtitulo="Fechas con año · ambos extremos entran"
        contentClassName="space-y-3"
      >
        <p className={FRANJA_EXPLICACION}>
          Fechas <b>concretas</b>, con año: «Buen Fin 2026» y «Buen Fin 2027» son dos
          temporadas, porque las fechas cambian cada año. Ambos extremos entran. Tampoco pueden
          solaparse: si «Diciembre» y «Buen Fin» se pisan, hay que decidir qué precio manda esos
          días.
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className={CABECERA}>
              <th className={TH}>Nombre<Asterisco /></th>
              <th className={TH}>Desde<Asterisco /></th>
              <th className={TH}>Hasta<Asterisco /></th>
              <th className={TH}>Estado</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {temporadas.length === 0 && (
              <tr>
                <td colSpan={5} className={`${CELDA} text-muted`}>
                  Todavía no hay ninguna.
                </td>
              </tr>
            )}
            {temporadas.map((t) => (
              <tr key={t.id} className={t.activo ? '' : 'text-muted line-through'}>
                <td className={cn(CELDA, t.activo && 'text-ink')}>{t.nombre}</td>
                {/* dd/mm/aaaa como el resto de la app; llegaban en ISO. */}
                <td className={cn(CELDA, 'demo-num whitespace-nowrap')}>{fechaCorta(t.desde)}</td>
                <td className={cn(CELDA, 'demo-num whitespace-nowrap')}>{fechaCorta(t.hasta)}</td>
                <td className={CELDA}>
                  <StatusBadge tono={t.activo ? 'verde' : 'neutro'}>{t.activo ? 'Activa' : 'Dada de baja'}</StatusBadge>
                </td>
                <td className={cn(CELDA, 'text-right')}>
                  {t.activo && (
                    <Button
                      type="button"
                      onClick={() => void darDeBaja('temporada', t.id)}
                      size="sm"
                      variant="ghost"
                      className="text-error hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-2">
              <td className={CELDA} data-falta={obT.falta('nombre') || undefined}>
                <input
                  aria-label="Nombre de la temporada"
                  className={cn(CAMPO, 'w-full min-w-[8rem]')}
                  placeholder="p. ej. Buen Fin 2026"
                  value={nuevaT.nombre}
                  onChange={(e) => setNuevaT({ ...nuevaT, nombre: e.target.value })}
                />
              </td>
              <td className={CELDA} data-falta={obT.falta('desde') || undefined}>
                <input
                  aria-label="Fecha de inicio"
                  type="date"
                  className={cn(CAMPO, 'demo-num')}
                  value={nuevaT.desde}
                  onChange={(e) => setNuevaT({ ...nuevaT, desde: e.target.value })}
                />
              </td>
              <td className={CELDA} data-falta={obT.falta('hasta') || undefined}>
                <input
                  aria-label="Fecha de fin"
                  type="date"
                  className={cn(CAMPO, 'demo-num')}
                  value={nuevaT.hasta}
                  onChange={(e) => setNuevaT({ ...nuevaT, hasta: e.target.value })}
                />
              </td>
              <td className={CELDA} />
              <td className={cn(CELDA, 'text-right')}>
                <Button
                  type="button"
                  onClick={() => void anadirTemporada()}
                  size="sm"
                  variant="success"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </CardColapsable>
    </div>
  )
}

// Estilos comunes de tabla del rediseño del 2026-10-26 (los mismos de
// Finanzas): cabecera en mayúsculas de 11 px, celdas con relleno, y campos del
// alto y el borde del resto de los formularios.
const CABECERA = 'border-b border-border text-[11px] uppercase tracking-wide text-muted'
const CELDA = 'px-3 py-2.5'
const TH = 'px-3 py-2 font-medium'
const CAMPO =
  'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent'
const FRANJA_EXPLICACION = 'rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted'

// La fecha de una temporada viene como `YYYY-MM-DD`. `formatFecha` la lee como
// fecha LOCAL (sin el corrimiento de un día que daría `new Date(iso)` en
// México). Si llegara vacía o en otro formato, se pinta tal cual en vez de
// inventar una fecha.
function fechaCorta(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatFecha(iso) : iso
}

/** OBLIG-01 · el asterisco de una cabecera de columna obligatoria. */
function Asterisco() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-error">*</span>
      <span className="sr-only"> (obligatorio)</span>
    </>
  )
}
