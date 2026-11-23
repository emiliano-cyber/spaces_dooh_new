'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, Loader2, MoonStar } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { seApi, ErrorSE } from '@/lib/data/space-eyes-se'
import {
  CAPACIDADES,
  leerAjustes,
  leerNoche,
  tipoDe,
  type Ajustes,
  type Noche,
} from '@/components/demo/space-eyes/EquipoAdmin'

// ============================================================================
//  Space Eyes — «Brillo por horas», la flota entera de un vistazo.
//
//  El mismo tramo de noche que vive en la ficha de cada equipo (Equipos →
//  Imagen), pero mirando a toda la flota a la vez. No es un duplicado por
//  comodidad: la pregunta que no se podía contestar era «¿cuáles bajan la luz
//  de noche y cuáles no?», y para responderla había que abrir los equipos uno
//  por uno. Un espectacular que se quedó sin tramo no se nota hasta que
//  alguien mira la foto de las once de la noche y la ve quemada.
//
//  LAS CUENTAS NO SE REPITEN. Qué mandos aplica cada tipo de equipo, cómo se
//  lee el tramo guardado y en qué campo viaja el valor sale de `EquipoAdmin`
//  (`CAPACIDADES`, `leerNoche`, `tipoDe`). Si esto tuviera su propia copia, el
//  día que cambie la escala de un agente una de las dos pantallas guardaría un
//  número que el equipo no entiende, y lo haría en silencio.
//
//  POR QUÉ SE REENVÍAN LOS AJUSTES DE DÍA. El servidor guarda el perfil de día
//  y el tramo de noche en la MISMA llamada (`PUT devices/:id/camera`). Mandar
//  solo el tramo borraría el perfil de día del equipo, así que se vuelve a
//  mandar el que ya tenía, tal cual, sin tocarlo.
//
//  Guardar es escritura: el BFF pide `inventario.crear`. Aquí solo se refleja
//  para no ofrecer un control que va a contestar 403.
// ============================================================================

interface EquipoSE {
  id: number
  name: string | null
  billboard_code?: string | null
  city?: string | null
  online?: boolean | number
  app_version: string | null
  camera_ajustes: string | Ajustes | null
  camera_ajustes_noche?: string | Ajustes | null
  noche_inicio?: string | null
  noche_fin?: string | null
  photo_rotation: number | null
}

type Aviso = { tono: 'ok' | 'error'; texto: string } | null

/** Lo que un tipo de equipo sabe hacer de noche, cuando sabe hacer algo. */
type CapNoche = NonNullable<(typeof CAPACIDADES)['pi']['noche']>

type Traducir = (clave: ClaveTexto, valores?: Record<string, string | number>) => string

function mensaje(e: unknown, t: Traducir): string {
  if (e instanceof ErrorSE && e.status === 403) return t('spaceeyes.comun.sin-permiso')
  return e instanceof Error ? e.message : String(e)
}

/** «19:00 a 07:00, −4» o «sin tramo», dicho para leerse de corrido. */
function resumenDe(n: Noche, paso: number, t: Traducir): string {
  if (!n.activo) return t('spaceeyes.brillo.sin-tramo')
  const v = paso >= 1 ? Math.round(n.valor) : n.valor.toFixed(1)
  return `${n.inicio} — ${n.fin} · ${n.valor < 0 ? '' : '+'}${v}`
}

export function BrilloPorHoras() {
  const puedeEditar = usePuede('inventario', 'crear')
  const { t } = useIdioma()

  const [equipos, setEquipos] = useState<EquipoSE[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [borrador, setBorrador] = useState<Noche | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const cargar = useCallback(async () => {
    try {
      const d = await seApi<{ devices?: EquipoSE[] }>('devices')
      setEquipos(d?.devices ?? [])
    } catch (e) {
      setError(mensaje(e, t))
    }
  }, [t])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Los que SÍ pueden bajar la luz de noche arriba, y entre ellos primero los
  // que no lo tienen puesto: lo que se viene a buscar aquí es lo que falta.
  const lista = useMemo(() => {
    const filas = (equipos ?? []).map((eq) => {
      const cap = CAPACIDADES[tipoDe(eq.app_version)].noche
      return { eq, cap, noche: leerNoche(eq) }
    })
    return filas.sort((a, b) => {
      if (!a.cap !== !b.cap) return a.cap ? -1 : 1
      if (a.noche.activo !== b.noche.activo) return a.noche.activo ? 1 : -1
      return String(a.eq.name ?? '').localeCompare(String(b.eq.name ?? ''))
    })
  }, [equipos])

  function abrir(fila: { eq: EquipoSE; noche: Noche }) {
    setAviso(null)
    if (abierto === fila.eq.id) {
      setAbierto(null)
      setBorrador(null)
      return
    }
    setAbierto(fila.eq.id)
    setBorrador({ ...fila.noche })
  }

  async function guardar(eq: EquipoSE, cap: CapNoche) {
    if (!borrador) return
    setGuardando(true)
    setAviso(null)
    try {
      // El perfil de día va TAL CUAL estaba: esta pantalla no lo toca, solo
      // tiene que evitar borrarlo (ver la cabecera).
      const dia = leerAjustes(eq.camera_ajustes)
      Object.keys(dia).forEach((k) => {
        if (dia[k] === null || dia[k] === undefined) delete dia[k]
      })
      const valor = cap.paso >= 1 ? Math.round(borrador.valor) : Number(borrador.valor)
      const tramo =
        borrador.activo && borrador.inicio && borrador.fin
          ? {
              ajustes_noche: { [cap.campo]: Number.isFinite(valor) ? valor : 0 },
              noche_inicio: borrador.inicio,
              noche_fin: borrador.fin,
            }
          : { ajustes_noche: null, noche_inicio: null, noche_fin: null }

      await seApi(`devices/${eq.id}/camera`, {
        method: 'PUT',
        body: {
          ajustes: Object.keys(dia).length ? dia : null,
          photo_rotation: eq.photo_rotation ?? 0,
          ...tramo,
        },
      })
      await cargar()
      setAbierto(null)
      setBorrador(null)
      setAviso({
        tono: 'ok',
        texto: borrador.activo
          ? t('spaceeyes.brillo.guardado', {
              equipo: eq.name ?? t('spaceeyes.brillo.el-equipo'),
              desde: borrador.inicio,
              hasta: borrador.fin,
            })
          : t('spaceeyes.brillo.quitado', { equipo: eq.name ?? t('spaceeyes.brillo.el-equipo') }),
      })
    } catch (e) {
      setAviso({ tono: 'error', texto: t('spaceeyes.brillo.no-guardo', { motivo: mensaje(e, t) }) })
    } finally {
      setGuardando(false)
    }
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-surface p-3 text-[13px]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span className="text-ink">{t('spaceeyes.brillo.no-flota', { motivo: error })}</span>
      </div>
    )
  }

  if (!equipos) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-[13px] text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('spaceeyes.brillo.leyendo')}
      </div>
    )
  }

  const conTramo = lista.filter((f) => f.noche.activo).length
  const pueden = lista.filter((f) => f.cap).length

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[13px] leading-relaxed text-muted">{t('spaceeyes.brillo.que-es')}</p>
        <p className="text-[12px] text-muted">{t('spaceeyes.brillo.cuantos', { n: conTramo, total: pueden })}</p>
      </div>

      {aviso && (
        <p className={cn('text-[12px]', aviso.tono === 'ok' ? 'text-success' : 'text-error')}>{aviso.texto}</p>
      )}

      <div className="divide-y divide-border rounded-md border border-border bg-surface">
        {lista.map(({ eq, cap, noche }) => {
          const estaAbierto = abierto === eq.id
          return (
            <div key={eq.id}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <MoonStar
                  className={cn('h-4 w-4 shrink-0', noche.activo ? 'text-accent' : 'text-muted')}
                  strokeWidth={1.75}
                />
                <span className="text-[13px] text-ink">{eq.name ?? `Equipo ${eq.id}`}</span>
                {eq.city && <span className="text-[12px] text-muted">· {eq.city}</span>}
                <span className="min-w-0 truncate text-[13px] text-muted">
                  ·{' '}
                  {cap ? resumenDe(noche, cap.paso, t) : t('spaceeyes.brillo.no-aplica')}
                </span>
                {cap && (
                  <Button variant="tertiary" size="sm" className="ml-auto" onClick={() => abrir({ eq, noche })}>
                    {estaAbierto
                      ? t('spaceeyes.avisos.cerrar')
                      : noche.activo
                        ? t('spaceeyes.brillo.cambiar')
                        : t('spaceeyes.brillo.poner')}
                  </Button>
                )}
              </div>

              {estaAbierto && cap && borrador && (
                <div className="space-y-3 border-t border-border bg-surface-2 p-3">
                  <label className="flex items-center gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={borrador.activo}
                      disabled={!puedeEditar}
                      onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })}
                      className="h-4 w-4 rounded border-border-strong text-accent focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    {t('spaceeyes.brillo.activar')}
                  </label>

                  {borrador.activo && (
                    <>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block">
                          <span className="block text-[12px] text-ink">{t('spaceeyes.comun.desde')}</span>
                          <input
                            type="time"
                            value={borrador.inicio}
                            disabled={!puedeEditar}
                            onChange={(e) => setBorrador({ ...borrador, inicio: e.target.value })}
                            className="mt-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-[13px] text-ink"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[12px] text-ink">{t('spaceeyes.comun.hasta')}</span>
                          <input
                            type="time"
                            value={borrador.fin}
                            disabled={!puedeEditar}
                            onChange={(e) => setBorrador({ ...borrador, fin: e.target.value })}
                            className="mt-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-[13px] text-ink"
                          />
                        </label>
                        <span className="flex items-center gap-1 pb-1 text-[12px] text-muted">
                          <Clock className="h-3.5 w-3.5" /> {t('spaceeyes.brillo.hora-sitio')}
                        </span>
                      </div>

                      <label className="block">
                        <span className="flex items-baseline justify-between text-[12px] text-ink">
                          <span>{t('spaceeyes.brillo.cuanto')}</span>
                          <span className="text-muted">
                            {cap.paso >= 1 ? Math.round(borrador.valor) : borrador.valor.toFixed(2)}
                            {borrador.valor < 0
                              ? t('spaceeyes.brillo.mas-oscuro')
                              : borrador.valor > 0
                                ? t('spaceeyes.brillo.mas-claro')
                                : t('spaceeyes.brillo.igual')}
                          </span>
                        </span>
                        <input
                          type="range"
                          min={cap.min}
                          max={cap.max}
                          step={cap.paso}
                          disabled={!puedeEditar}
                          value={borrador.valor}
                          onChange={(e) => setBorrador({ ...borrador, valor: Number(e.target.value) })}
                          className="mt-2 w-full accent-[var(--accent)]"
                        />
                        <span className="mt-1 block text-[11px] text-muted">{cap.ayuda}</span>
                      </label>
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={!puedeEditar || guardando} onClick={() => guardar(eq, cap)}>
                      {guardando ? t('spaceeyes.comun.guardando') : t('spaceeyes.avisos.guardar')}
                    </Button>
                    {!puedeEditar && (
                      <span className="text-[12px] text-muted">{t('spaceeyes.brillo.solo-lectura')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!lista.length && (
          <p className="px-3 py-6 text-[13px] text-muted">{t('spaceeyes.brillo.sin-equipos')}</p>
        )}
      </div>
    </div>
  )
}
