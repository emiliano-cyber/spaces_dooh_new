'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/demo/ui/Button'
import { useIdioma } from '@/lib/i18n/contexto'
import { porcentajeEnIdioma } from '@/lib/i18n/formato-idioma'
import { formatFecha, usePropuestas, type Propuesta } from '@/lib/data/client'
import { refrescarEstado } from '@/lib/data/estado-api'
import { withTrail } from '@/lib/nav-trail'
import { EST, CLAVE_ESTATUS } from '@/components/demo/propuestas/estatus'
import {
  cambiarEtapaApi,
  ligarPropuestaApi,
  oportunidadApi,
  registrarActividadApi,
  type FichaOportunidad as Ficha,
} from '@/lib/data/oportunidades-api'
import {
  ETAPAS_OPORTUNIDAD,
  TIPOS_ACTIVIDAD_MANUAL,
  cotejoFechas,
  cotejoPresupuesto,
  diasPorEtapa,
  etapaOportunidadCerrada,
  type EtapaOportunidad,
} from '@/lib/crm'
import { FormOportunidad } from './FormOportunidad'
import { COLOR_ETAPA, claveAccion, claveActividad, claveCampo, claveEtapa, claveMedio } from './etiquetas'

// ============================================================================
//  La ficha de una oportunidad: lo que pide el cliente, lo que se le cotizó y
//  todo lo que ha pasado.  ADR 0051 §6, Fase 4.
// ----------------------------------------------------------------------------
//  EL COTEJO SE CALCULA, NO SE GUARDA. Cada cotización sale de la propuesta tal
//  como la arma el servidor (`armarPropuesta`): una sola fuente para el dinero.
//  Se coteja DOS veces, contra el `total` con IVA (la cifra de las tarjetas de
//  Propuestas) y contra la `base` sin IVA, y se dice con qué tasa: la del
//  cliente (`clientes.iva_pct`), o 16. Decisión del dueño del 17/11 (pregunta 5
//  del ADR 0051). Las fechas cotizadas son las de sus sitios (la primera y la
//  última).
//
//  LA LÍNEA DE TIEMPO UNE TRES COSAS al leer (§2): las actividades de la
//  oportunidad, los cambios de sus propuestas (los escribe el trigger de la
//  Fase 3) y la bitácora del prospecto del que salió, si quien mira lo puede
//  ver. No se escribe nada dos veces.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface Evento {
  id: string
  en: string
  quien: string | null
  texto: string
  detalle: string | null
  etiqueta: string
}

const rango = (p: Propuesta) => {
  const ini = p.items.map((i) => i.fechaInicio).sort()[0] ?? null
  const fin = p.items.map((i) => i.fechaFin).sort().at(-1) ?? null
  return { ini, fin }
}

const valorCorto = (v: unknown): string => {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v).slice(0, 80)
}

export function FichaOportunidad({
  id,
  ahora = new Date(),
  inicial = null,
  propuestasInicial,
}: {
  id: string
  ahora?: Date
  /** Solo para pruebas: la ficha y las propuestas que se pintan antes de la API. */
  inicial?: Ficha | null
  propuestasInicial?: Propuesta[]
}) {
  const { t, idioma, dinero } = useIdioma()
  const delStore = usePropuestas()
  const propuestas = propuestasInicial ?? delStore
  const [ficha, setFicha] = useState<Ficha | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [editar, setEditar] = useState(false)
  const [nuevaEtapa, setNuevaEtapa] = useState<EtapaOportunidad | ''>('')
  const [motivo, setMotivo] = useState('')
  const [notaEtapa, setNotaEtapa] = useState('')
  const [actividad, setActividad] = useState({ tipo: 'LLAMADA' as (typeof TIPOS_ACTIVIDAD_MANUAL)[number], nota: '', paso: '', fecha: '' })
  const [aLigar, setALigar] = useState('')
  const [quien, setQuien] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(() => {
    oportunidadApi(id)
      .then((f) => { setFicha(f); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [id])
  useEffect(cargar, [cargar])

  const pct = (n: number) => porcentajeEnIdioma(String(n), idioma)
  const posicionTexto = (cp: ReturnType<typeof cotejoPresupuesto>) =>
    cp.posicion === 'ENCIMA' || cp.posicion === 'DEBAJO'
      ? t(cp.posicion === 'ENCIMA' ? 'crm.ficha.posicion.encima' : 'crm.ficha.posicion.debajo', {
          monto: dinero(Math.abs(cp.diferencia ?? 0)),
          pct: cp.pct == null ? '—' : pct(Math.abs(cp.pct)),
        })
      : t(cp.posicion === 'DENTRO' ? 'crm.ficha.posicion.dentro' : 'crm.ficha.posicion.sin-presupuesto')
  const porId = useMemo(() => new Map((propuestas ?? []).map((p) => [p.id, p])), [propuestas])

  const eventos = useMemo<Evento[]>(() => {
    if (!ficha) return []
    const ev: Evento[] = []
    for (const a of ficha.actividades) {
      ev.push({
        id: `a-${a.id}`,
        en: a.creadoEn,
        quien: a.usuarioNombre,
        etiqueta: a.tipo === 'ETAPA' ? t('crm.col.etapa') : t(claveActividad(a.tipo)),
        texto: a.tipo === 'ETAPA' && a.etapaNueva ? t('crm.linea.etapa', { etapa: t(claveEtapa(a.etapaNueva)) }) : a.nota ?? '',
        detalle: [a.tipo === 'ETAPA' ? a.nota : null, a.siguientePaso
          ? t('crm.linea.siguiente', { paso: a.siguientePaso }) + (a.siguientePasoFecha ? ` · ${formatFecha(a.siguientePasoFecha, idioma)}` : '')
          : null]
          .filter(Boolean).join(' · ') || null,
      })
    }
    for (const c of ficha.cambios) {
      ev.push({
        id: `c-${c.id}`,
        en: c.creadoEn,
        quien: c.origen === 'SISTEMA' ? t('crm.linea.sistema') : c.usuarioNombre,
        etiqueta: c.folio,
        texto: t(claveAccion(c.accion), { campo: c.campo ? (claveCampo(c.campo) ? t(claveCampo(c.campo)!) : c.campo) : '' }),
        detalle: c.campo ? `${valorCorto(c.valorAnterior)} → ${valorCorto(c.valorNuevo)}` : null,
      })
    }
    for (const a of ficha.avancesProspecto) {
      ev.push({ id: `p-${a.id}`, en: a.creadoEn, quien: a.usuarioNombre, etiqueta: t('crm.linea.prospecto'), texto: a.nota, detalle: null })
    }
    return ev.sort((x, y) => (x.en < y.en ? 1 : x.en > y.en ? -1 : 0))
  }, [ficha, t, idioma])

  const personas = useMemo(() => [...new Set(eventos.map((e) => e.quien).filter((x): x is string => !!x))].sort(), [eventos])

  if (error) return <p className="text-[13px] text-[#b42318]">{error}</p>
  if (!ficha) return <p className="text-[13px] text-muted">{t('crm.cargando')}</p>

  const cerrada = etapaOportunidadCerrada(ficha.etapa)
  const dias = diasPorEtapa(ficha.actividades, ahora)
  const primerContacto = [ficha.creadoEn, ...ficha.avancesProspecto.map((a) => a.creadoEn)].sort()[0]
  const diasTotal = Math.floor((ahora.getTime() - Date.parse(primerContacto)) / 86_400_000)
  const ligadas = ficha.propuestas.map((l) => ({ l, p: porId.get(l.id) }))
  const ligables = (propuestas ?? []).filter(
    (p) => !p.oportunidadId && (!ficha.clienteId || p.clienteId === ficha.clienteId),
  )
  const presupuesto =
    ficha.presupuestoMin == null && ficha.presupuestoMax == null
      ? t('crm.sin-presupuesto')
      : [ficha.presupuestoMin, ficha.presupuestoMax].map((x) => (x == null ? '—' : dinero(x))).join(' – ')
  const volver = withTrail('/crm', [])

  async function accion(fn: () => Promise<unknown>, refrescar = false) {
    setOcupado(true)
    try {
      await fn()
      if (refrescar) await refrescarEstado()
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={volver} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('crm.ficha.volver')}
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl text-ink">{ficha.nombre}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {ficha.clienteNombre ?? (ficha.prospectoNombre ? t('crm.ficha.prospecto-de', { nombre: ficha.prospectoNombre }) : '—')}
              {' · '}
              {t('crm.ficha.vendedor', { nombre: ficha.vendedorNombre ?? t('crm.cotejo.sin-vendedor') })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[12px] ${COLOR_ETAPA[ficha.etapa]}`}>{t(claveEtapa(ficha.etapa))}</span>
            {!cerrada && (
              <Button variant="secondary" onClick={() => setEditar(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> {t('crm.ficha.editar')}
              </Button>
            )}
          </div>
        </div>
        {cerrada && (
          <p className="mt-2 text-[13px] text-muted">
            {t('crm.ficha.cerrada', { fecha: formatFecha((ficha.ganadaEn ?? ficha.perdidaEn ?? ficha.actualizadoEn), idioma) })}
            {ficha.motivoPerdida ? ` ${t('crm.ficha.perdida-por', { motivo: ficha.motivoPerdida })}` : ''}
          </p>
        )}
      </div>

      <dl className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
        <div><dt className="text-[12px] text-muted">{t('crm.col.presupuesto')}</dt><dd className="demo-num text-[15px] text-ink">{presupuesto}</dd></div>
        <div><dt className="text-[12px] text-muted">{t('crm.ficha.dias-total')}</dt><dd className="demo-num text-[15px] text-ink">{diasTotal}</dd></div>
        <div><dt className="text-[12px] text-muted">{t('crm.cotejo.col.cotizaciones')}</dt><dd className="demo-num text-[15px] text-ink">{ficha.cotizaciones}</dd></div>
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-[14px] font-medium text-ink">{t('crm.ficha.quiere')}</h2>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted">{t('crm.form.inicio')}</dt><dd className="text-ink">{ficha.fechaInicioDeseada ? formatFecha(ficha.fechaInicioDeseada, idioma) : '—'}</dd>
            <dt className="text-muted">{t('crm.form.fin')}</dt><dd className="text-ink">{ficha.fechaFinDeseada ? formatFecha(ficha.fechaFinDeseada, idioma) : '—'}</dd>
            <dt className="text-muted">{t('crm.form.decision')}</dt><dd className="text-ink">{ficha.fechaDecision ? formatFecha(ficha.fechaDecision, idioma) : '—'}</dd>
            <dt className="text-muted">{t('crm.form.plazas')}</dt><dd className="text-ink">{ficha.plazas ?? '—'}</dd>
            <dt className="text-muted">{t('crm.form.medios')}</dt><dd className="text-ink">{ficha.tiposMedio.length ? ficha.tiposMedio.map((m) => t(claveMedio(m))).join(', ') : '—'}</dd>
            <dt className="text-muted">{t('crm.form.objetivo')}</dt><dd className="whitespace-pre-line text-ink">{ficha.objetivo ?? '—'}</dd>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-[14px] font-medium text-ink">{t('crm.ficha.dias-etapa')}</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {ETAPAS_OPORTUNIDAD.filter((e) => dias[e] != null).map((e) => (
              <li key={e} className={`rounded-full border px-2.5 py-0.5 text-[12px] ${COLOR_ETAPA[e]}`}>
                {t(claveEtapa(e))} · <span className="demo-num">{dias[e]}</span>
              </li>
            ))}
          </ul>
          {!cerrada && (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <h3 className="text-[13px] font-medium text-ink">{t('crm.ficha.etapa')}</h3>
              <select aria-label={t('crm.ficha.etapa')} className={inputCls} value={nuevaEtapa} onChange={(e) => setNuevaEtapa(e.target.value as EtapaOportunidad | '')}>
                <option value="">{t('crm.form.elige')}</option>
                {ETAPAS_OPORTUNIDAD.filter((e) => e !== ficha.etapa).map((e) => <option key={e} value={e}>{t(claveEtapa(e))}</option>)}
              </select>
              {nuevaEtapa === 'PERDIDA' && (
                <input aria-label={t('crm.ficha.motivo')} placeholder={t('crm.ficha.motivo')} className={inputCls} value={motivo} maxLength={2000} onChange={(e) => setMotivo(e.target.value)} />
              )}
              <input aria-label={t('crm.ficha.nota-etapa')} placeholder={t('crm.ficha.nota-etapa')} className={inputCls} value={notaEtapa} maxLength={2000} onChange={(e) => setNotaEtapa(e.target.value)} />
              <Button variant="primary" disabled={ocupado || !nuevaEtapa || (nuevaEtapa === 'PERDIDA' && !motivo.trim())}
                onClick={() => accion(async () => {
                  await cambiarEtapaApi(ficha.id, { etapa: nuevaEtapa as EtapaOportunidad, nota: notaEtapa.trim() || null, motivoPerdida: motivo.trim() || null })
                  setNuevaEtapa(''); setMotivo(''); setNotaEtapa('')
                })}>
                {t('crm.ficha.mover')}
              </Button>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-[14px] font-medium text-ink">{t('crm.ficha.cotejo')}</h2>
        {ligadas.length === 0 ? (
          <p className="text-[13px] text-muted">{t('crm.ficha.cotejo-vacio')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">{t('crm.pestana.propuestas')}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{t('crm.ficha.col.cotizado')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('crm.ficha.col.contra-presupuesto')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('crm.ficha.col.fechas')}</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {ligadas.map(({ l, p }) => {
                  const total = p?.total ?? null
                  const cp = total == null ? null : cotejoPresupuesto(ficha.presupuestoMin, ficha.presupuestoMax, total)
                  // Con y sin IVA (decisión del dueño, 17/11): el cliente puede
                  // hablar de su presupuesto de las dos formas. La tasa es la
                  // del cliente, la misma con que el servidor calculó `iva`.
                  const sinIva = p ? cotejoPresupuesto(ficha.presupuestoMin, ficha.presupuestoMax, p.base) : null
                  const tasa = p ? (p.ivaPct ?? (p.base > 0 ? Math.round((p.iva / p.base) * 1000) / 10 : 16)) : null
                  const r = p ? rango(p) : null
                  const cf = r ? cotejoFechas(ficha.fechaInicioDeseada, ficha.fechaFinDeseada, r.ini, r.fin) : null
                  const est = l.estatus as keyof typeof EST
                  return (
                    <tr key={l.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3">
                        <Link href={withTrail(`/propuestas/${l.id}`, [{ label: ficha.nombre, href: `/crm/oportunidades/${ficha.id}` }])} className="font-medium text-ink hover:underline">{l.folio}</Link>
                        <span className="text-muted"> · {l.nombre}</span>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                          {EST[est] && <span className={`rounded-full px-1.5 py-0.5 ${EST[est].cls}`}>{t(CLAVE_ESTATUS[est])}</span>}
                          <span className="text-muted">{t('crm.cotejo.version', { n: l.version })}</span>
                        </div>
                      </td>
                      <td className="demo-num py-2 pr-3 text-right">
                        {total == null || p == null ? '—' : (
                          <>
                            <div>{dinero(total)} {t('crm.cotejo.con-iva-tasa', { pct: pct(tasa ?? 16) })}</div>
                            <div className="text-muted">{dinero(p.base)} {t('crm.cotejo.sin-iva')}</div>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {cp == null || sinIva == null ? '—' : (
                          <>
                            <div>{t('crm.cotejo.con-iva')}: {posicionTexto(cp)}</div>
                            <div className="text-muted">{t('crm.cotejo.sin-iva')}: {posicionTexto(sinIva)}</div>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {cf == null ? '—' : cf.estado === 'DISTINTO'
                          ? t('crm.ficha.fechas.distinto', { ini: cf.inicioDias ?? 0, fin: cf.finDias ?? 0 })
                          : t(cf.estado === 'IGUAL' ? 'crm.ficha.fechas.igual' : 'crm.ficha.fechas.sin-fechas')}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => accion(() => ligarPropuestaApi(l.id, null), true)}>
                          {t('crm.ficha.desligar')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="min-w-[16rem] flex-1 text-xs font-medium text-muted">
            {t('crm.ficha.ligar')}
            {ligables.length === 0 ? (
              <p className="mt-1 text-[13px] font-normal">{t('crm.ficha.ligar-vacio')}</p>
            ) : (
              <select className={`${inputCls} mt-1`} value={aLigar} onChange={(e) => setALigar(e.target.value)}>
                <option value="">{t('crm.form.elige')}</option>
                {ligables.map((p) => <option key={p.id} value={p.id}>{p.folio} · {p.nombre}</option>)}
              </select>
            )}
          </label>
          {ligables.length > 0 && (
            <Button variant="secondary" disabled={ocupado || !aLigar}
              onClick={() => accion(async () => { await ligarPropuestaApi(aLigar, ficha.id); setALigar('') }, true)}>
              {t('crm.ficha.ligar-boton')}
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr,2fr]">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-[14px] font-medium text-ink">{t('crm.ficha.actividad')}</h2>
          <div className="space-y-2">
            <select aria-label={t('crm.ficha.actividad-tipo')} className={inputCls} value={actividad.tipo}
              onChange={(e) => setActividad((a) => ({ ...a, tipo: e.target.value as typeof a.tipo }))}>
              {TIPOS_ACTIVIDAD_MANUAL.map((x) => <option key={x} value={x}>{t(claveActividad(x))}</option>)}
            </select>
            <textarea aria-label={t('crm.ficha.actividad-nota')} placeholder={t('crm.ficha.actividad-nota')} className={`${inputCls} h-20 py-2`}
              value={actividad.nota} maxLength={2000} onChange={(e) => setActividad((a) => ({ ...a, nota: e.target.value }))} />
            <input aria-label={t('crm.ficha.siguiente')} placeholder={t('crm.ficha.siguiente')} className={inputCls}
              value={actividad.paso} maxLength={300} onChange={(e) => setActividad((a) => ({ ...a, paso: e.target.value }))} />
            <label className="block text-xs font-medium text-muted">
              {t('crm.ficha.siguiente-fecha')}
              <input type="date" className={`${inputCls} mt-1`} value={actividad.fecha} onChange={(e) => setActividad((a) => ({ ...a, fecha: e.target.value }))} />
            </label>
            <Button variant="primary" disabled={ocupado || !actividad.nota.trim()}
              onClick={() => accion(async () => {
                await registrarActividadApi(ficha.id, {
                  tipo: actividad.tipo, nota: actividad.nota.trim(),
                  siguientePaso: actividad.paso.trim() || null, siguientePasoFecha: actividad.fecha || null,
                })
                setActividad({ tipo: 'LLAMADA', nota: '', paso: '', fecha: '' })
              })}>
              {t('crm.ficha.anotar')}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-medium text-ink">{t('crm.ficha.linea')}</h2>
            {personas.length > 1 && (
              <select aria-label={t('crm.linea.filtro')} className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                value={quien} onChange={(e) => setQuien(e.target.value)}>
                <option value="">{t('crm.linea.todos')}</option>
                {personas.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
          {eventos.length === 0 ? (
            <p className="text-[13px] text-muted">{t('crm.ficha.linea-vacia')}</p>
          ) : (
            <ol className="m-0 list-none space-y-2 p-0">
              {eventos.filter((e) => !quien || e.quien === quien).map((e) => (
                <li key={e.id} className="border-l-2 border-border pl-3 text-[13px]">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted">
                    <span>{formatFecha(e.en, idioma)}</span>
                    <span className="rounded bg-bg px-1.5 py-0.5">{e.etiqueta}</span>
                    {e.quien && <span>{e.quien}</span>}
                  </div>
                  <p className="text-ink">{e.texto}</p>
                  {e.detalle && <p className="demo-num text-[12px] text-muted">{e.detalle}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <FormOportunidad abierto={editar} onCerrar={() => setEditar(false)} ficha={ficha} onGuardada={(f) => setFicha((x) => (x ? { ...x, ...f } : f))} />
    </div>
  )
}
