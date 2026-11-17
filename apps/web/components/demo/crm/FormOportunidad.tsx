'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { Campo } from '@/components/demo/ui/Campo'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { useIdioma } from '@/lib/i18n/contexto'
import { useClientes } from '@/lib/data/client'
import { prospectosApi, type Prospecto } from '@/lib/data/captacion-api'
import {
  crearOportunidadApi,
  editarOportunidadApi,
  type DatosOportunidadForm,
  type FichaOportunidad,
} from '@/lib/data/oportunidades-api'
import { PROBABILIDAD_POR_ETAPA, TIPOS_MEDIO, type EtapaOportunidad } from '@/lib/crm'
import { porcentajeEnIdioma } from '@/lib/i18n/formato-idioma'
import { claveMedio } from './etiquetas'

// ============================================================================
//  Alta y edición de una oportunidad: lo que el cliente QUIERE.  ADR 0051 §1.
// ----------------------------------------------------------------------------
//  Al dar de alta se elige de quién es: un cliente que ya existe o un
//  prospecto de tipo cliente (los que el servidor deja ver a quien la da de
//  alta, con la regla de Captación). Al editar eso ya no cambia.
//
//  El vendedor NO se elige: lo pone el servidor desde la sesión.
//  La probabilidad vacía significa «la de la etapa», que se aplica al leer
//  (`lib/crm.ts`): por eso se manda null y no el número de la etapa.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface Valores {
  nombre: string
  origen: 'cliente' | 'prospecto'
  clienteId: string
  prospectoId: string
  presupuestoMin: string
  presupuestoMax: string
  fechaInicioDeseada: string
  fechaFinDeseada: string
  fechaDecision: string
  plazas: string
  tiposMedio: string[]
  objetivo: string
  probabilidadPct: string
  nota: string
}

const vacio = (): Valores => ({
  nombre: '', origen: 'cliente', clienteId: '', prospectoId: '', presupuestoMin: '', presupuestoMax: '',
  fechaInicioDeseada: '', fechaFinDeseada: '', fechaDecision: '', plazas: '', tiposMedio: [], objetivo: '',
  probabilidadPct: '', nota: '',
})

const deFicha = (f: FichaOportunidad): Valores => ({
  ...vacio(),
  nombre: f.nombre,
  presupuestoMin: f.presupuestoMin == null ? '' : String(f.presupuestoMin),
  presupuestoMax: f.presupuestoMax == null ? '' : String(f.presupuestoMax),
  fechaInicioDeseada: f.fechaInicioDeseada ?? '',
  fechaFinDeseada: f.fechaFinDeseada ?? '',
  fechaDecision: f.fechaDecision ?? '',
  plazas: f.plazas ?? '',
  tiposMedio: f.tiposMedio,
  objetivo: f.objetivo ?? '',
  probabilidadPct: f.probabilidadPct == null ? '' : String(f.probabilidadPct),
})

// Un número tecleado, o null si está vacío. Un texto que no es número viaja
// como NaN y el servidor lo rechaza con su mensaje: no se inventa un cero.
const cifra = (s: string) => (s.trim() === '' ? null : Number(s))
const texto = (s: string) => (s.trim() === '' ? null : s.trim())

export function FormOportunidad({
  abierto,
  onCerrar,
  ficha,
  onGuardada,
  probabilidades,
}: {
  abierto: boolean
  onCerrar: () => void
  /** Si viene, se edita; si no, es un alta. */
  ficha?: FichaOportunidad | null
  onGuardada: (f: FichaOportunidad) => void
  /** La tabla de la instancia; sin ella, la de fábrica. */
  probabilidades?: Record<EtapaOportunidad, number>
}) {
  const { t, idioma } = useIdioma()
  const clientes = useClientes()
  const [v, setV] = useState<Valores>(vacio)
  const [prospectos, setProspectos] = useState<Prospecto[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const editando = !!ficha

  useEffect(() => {
    if (abierto) setV(ficha ? deFicha(ficha) : vacio())
  }, [abierto, ficha])

  // Los prospectos solo se piden al elegir «un prospecto»: la mayoría de las
  // altas son de clientes que ya existen.
  useEffect(() => {
    if (!abierto || editando || v.origen !== 'prospecto' || prospectos) return
    prospectosApi({ tipo: 'CLIENTE', porPagina: 100 })
      .then((p) => setProspectos(p.prospectos.filter((x) => x.etapa !== 'PERDIDO' && x.etapa !== 'RECHAZADO')))
      .catch(() => setProspectos([]))
  }, [abierto, editando, v.origen, prospectos])

  const cambia = <K extends keyof Valores>(k: K, valor: Valores[K]) => setV((x) => ({ ...x, [k]: valor }))
  const etapa: EtapaOportunidad = ficha?.etapa ?? 'CONTACTO'
  const pctEtapa = porcentajeEnIdioma(String((probabilidades ?? ficha?.probabilidades ?? PROBABILIDAD_POR_ETAPA)[etapa]), idioma)

  async function guardar() {
    const datos: DatosOportunidadForm = {
      nombre: v.nombre.trim(),
      presupuestoMin: cifra(v.presupuestoMin),
      presupuestoMax: cifra(v.presupuestoMax),
      fechaInicioDeseada: texto(v.fechaInicioDeseada),
      fechaFinDeseada: texto(v.fechaFinDeseada),
      fechaDecision: texto(v.fechaDecision),
      plazas: texto(v.plazas),
      tiposMedio: v.tiposMedio,
      objetivo: texto(v.objetivo),
      probabilidadPct: cifra(v.probabilidadPct),
    }
    setGuardando(true)
    try {
      const f = ficha
        ? await editarOportunidadApi(ficha.id, datos)
        : await crearOportunidadApi({
            ...datos,
            clienteId: v.origen === 'cliente' ? texto(v.clienteId) : null,
            prospectoId: v.origen === 'prospecto' ? texto(v.prospectoId) : null,
            nota: texto(v.nota),
          })
      onGuardada(f)
      onCerrar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={abierto}
      onOpenChange={(x) => !x && onCerrar()}
      title={editando ? t('crm.form.titulo-editar') : t('crm.nueva')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCerrar}>{t('crm.form.cancelar')}</Button>
          <Button variant="success" disabled={guardando || !v.nombre.trim()} onClick={guardar}>
            {editando ? t('crm.form.guardar') : t('crm.form.crear')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label={t('crm.form.nombre')} obligatorio className="sm:col-span-2">
          <input className={inputCls} value={v.nombre} maxLength={200} placeholder={t('crm.form.nombre-ejemplo')}
            onChange={(e) => cambia('nombre', e.target.value)} />
        </Campo>

        {!editando && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-xs font-medium text-muted">{t('crm.form.de-quien')}</legend>
            <div className="flex flex-wrap gap-4 text-[13px] text-ink">
              {(['cliente', 'prospecto'] as const).map((o) => (
                <label key={o} className="flex items-center gap-1.5">
                  <input type="radio" name="origen" checked={v.origen === o} onChange={() => cambia('origen', o)} />
                  {t(o === 'cliente' ? 'crm.form.cliente' : 'crm.form.prospecto')}
                </label>
              ))}
            </div>
            <div className="mt-2">
              {v.origen === 'cliente' ? (
                <select aria-label={t('crm.form.cliente')} className={inputCls} value={v.clienteId}
                  onChange={(e) => cambia('clienteId', e.target.value)}>
                  <option value="">{t('crm.form.elige')}</option>
                  {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              ) : prospectos && prospectos.length === 0 ? (
                <p className="text-[13px] text-muted">{t('crm.form.sin-prospectos')}</p>
              ) : (
                <select aria-label={t('crm.form.prospecto')} className={inputCls} value={v.prospectoId}
                  onChange={(e) => cambia('prospectoId', e.target.value)}>
                  <option value="">{t('crm.form.elige')}</option>
                  {(prospectos ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
            </div>
          </fieldset>
        )}

        <Campo label={t('crm.form.presupuesto-min')}>
          <EntradaCifra className={inputCls} type="number" min={0} valor={v.presupuestoMin}
            onCambio={(c) => cambia('presupuestoMin', c)} decimales={2} minimo={0} />
        </Campo>
        <Campo label={t('crm.form.presupuesto-max')}>
          <EntradaCifra className={inputCls} type="number" min={0} valor={v.presupuestoMax}
            onCambio={(c) => cambia('presupuestoMax', c)} decimales={2} minimo={0} />
        </Campo>
        <Campo label={t('crm.form.inicio')}>
          <input type="date" className={inputCls} value={v.fechaInicioDeseada} onChange={(e) => cambia('fechaInicioDeseada', e.target.value)} />
        </Campo>
        <Campo label={t('crm.form.fin')}>
          <input type="date" className={inputCls} value={v.fechaFinDeseada} onChange={(e) => cambia('fechaFinDeseada', e.target.value)} />
        </Campo>
        <Campo label={t('crm.form.decision')}>
          <input type="date" className={inputCls} value={v.fechaDecision} onChange={(e) => cambia('fechaDecision', e.target.value)} />
        </Campo>
        <Campo label={t('crm.form.probabilidad')}>
          <EntradaCifra className={inputCls} type="number" min={0} max={100} valor={v.probabilidadPct}
            onCambio={(c) => cambia('probabilidadPct', c)} decimales={0} minimo={0} maximo={100}
            placeholder={t('crm.form.probabilidad-ayuda', { pct: pctEtapa })} />
        </Campo>
        <Campo label={t('crm.form.plazas')} className="sm:col-span-2">
          <input className={inputCls} value={v.plazas} maxLength={1000} placeholder={t('crm.form.plazas-ejemplo')}
            onChange={(e) => cambia('plazas', e.target.value)} />
        </Campo>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-medium text-muted">{t('crm.form.medios')}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink">
            {TIPOS_MEDIO.map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="checkbox" checked={v.tiposMedio.includes(m)}
                  onChange={(e) => cambia('tiposMedio', e.target.checked ? [...v.tiposMedio, m] : v.tiposMedio.filter((x) => x !== m))} />
                {t(claveMedio(m))}
              </label>
            ))}
          </div>
        </fieldset>

        <Campo label={t('crm.form.objetivo')} className="sm:col-span-2">
          <textarea className={`${inputCls} h-20 py-2`} value={v.objetivo} maxLength={2000}
            onChange={(e) => cambia('objetivo', e.target.value)} />
        </Campo>
        {!editando && (
          <Campo label={t('crm.form.nota')} className="sm:col-span-2">
            <input className={inputCls} value={v.nota} maxLength={2000} onChange={(e) => cambia('nota', e.target.value)} />
          </Campo>
        )}
      </div>
    </Modal>
  )
}
