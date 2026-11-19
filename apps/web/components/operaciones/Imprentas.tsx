'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo } from '@/components/demo/ui/Campo'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useIdioma } from '@/lib/i18n/contexto'
import { cifraIlegible } from '@/lib/captura-cifra'
import { formatNumero } from '@/lib/formato-numero'
import {
  FORMATOS_ARTE,
  resolverRequisitos,
  type FormatoArte,
  type Requisitos,
  type RequisitosParciales,
} from '@/lib/requisitos-impresion'
import {
  actualizarImprentaApi,
  crearImprentaApi,
  guardarRequisitosEmpresaApi,
  listarImprentasApi,
  type ImprentaApi,
} from '@/lib/data/estado-api'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// ============================================================================
//  Imprentas — IMP-REQ (18/11). Cada proveedor de impresión con lo que pide
//  del arte, y los requisitos por omisión de la empresa. La valoración del arte
//  (`ValoracionArte.tsx`) los resuelve imprenta > empresa > constantes
//  (`lib/requisitos-impresion.ts`).
//
//  Permisos, los que ya existían: imprentas con `imprenta.crear` (el mismo que
//  crear órdenes); los de la empresa con `administracion.crear`, porque se
//  guardan por `PATCH /api/config`.
// ============================================================================

/** Las imprentas de la organización (GET /api/imprentas), con recarga. */
export function useImprentas(activo: boolean) {
  const [lista, setLista] = useState<ImprentaApi[] | null>(null)
  const recargar = useCallback(async () => {
    try {
      setLista(await listarImprentasApi())
    } catch {
      setLista([])
    }
  }, [])
  useEffect(() => {
    if (activo) void recargar()
  }, [activo, recargar])
  return { imprentas: lista, recargar }
}

const CAMPOS: { k: keyof Omit<Requisitos, 'formatos'>; clave: ClaveTexto; decimales: number }[] = [
  { k: 'dpiGranVerde', clave: 'operaciones.imprenta.imprentas.campo.gran-verde', decimales: 1 },
  { k: 'dpiGranAmbar', clave: 'operaciones.imprenta.imprentas.campo.gran-ambar', decimales: 1 },
  { k: 'dpiCercanaVerde', clave: 'operaciones.imprenta.imprentas.campo.cercana-verde', decimales: 1 },
  { k: 'dpiCercanaAmbar', clave: 'operaciones.imprenta.imprentas.campo.cercana-ambar', decimales: 1 },
  { k: 'corteGranM', clave: 'operaciones.imprenta.imprentas.campo.corte', decimales: 2 },
  { k: 'margenCm', clave: 'operaciones.imprenta.imprentas.campo.margen', decimales: 1 },
]

/** «Verde desde 10 DPI (grande) y 30 DPI (chica) · margen 5 cm». */
export function ResumenRequisitos({ r }: { r: Requisitos }) {
  const { t, idioma } = useIdioma()
  const n = (x: number) => formatNumero(x, x % 1 ? 1 : 0, idioma)
  return (
    <span className="demo-num text-[12px] text-muted">
      {t('operaciones.imprenta.imprentas.resumen', { gran: n(r.dpiGranVerde), cercana: n(r.dpiCercanaVerde), margen: n(r.margenCm) })}
      {r.formatos && ` · ${r.formatos.join(', ')}`}
    </span>
  )
}

type Edicion =
  | { tipo: 'empresa' }
  | { tipo: 'nueva' }
  | { tipo: 'imprenta'; imprenta: ImprentaApi }

/** La tarjeta de Imprenta: los de la empresa y la lista de imprentas. */
export function ImprentasCard({
  imprentas,
  recargar,
  requisitosEmpresa,
}: {
  imprentas: ImprentaApi[] | null
  recargar: () => Promise<void>
  requisitosEmpresa: RequisitosParciales | undefined
}) {
  const { t } = useIdioma()
  const puedeImprentas = usePuede('imprenta', 'crear')
  const puedeEmpresa = usePuede('administracion', 'crear')
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const empresa = resolverRequisitos(null, requisitosEmpresa)

  return (
    <CardColapsable
      id="imprenta.imprentas"
      titulo={t('operaciones.imprenta.imprentas.titulo')}
      resumen={<span className="text-[12px] text-muted">{t('operaciones.imprenta.imprentas.detalle')}</span>}
      accion={
        puedeImprentas ? (
          <Button size="sm" variant="success" onClick={() => setEdicion({ tipo: 'nueva' })}>
            <Plus className="h-3.5 w-3.5" /> {t('operaciones.imprenta.imprentas.nueva')}
          </Button>
        ) : undefined
      }
    >
      <ul className="m-0 list-none divide-y divide-border p-0">
        <li className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink">{t('operaciones.imprenta.imprentas.empresa')}</div>
            <ResumenRequisitos r={empresa} />
          </div>
          {puedeEmpresa && (
            <Button size="sm" variant="secondary" onClick={() => setEdicion({ tipo: 'empresa' })}>
              <Pencil className="h-3.5 w-3.5" /> {t('operaciones.imprenta.imprentas.editar')}
            </Button>
          )}
        </li>
        {imprentas && imprentas.length === 0 && (
          <li className="py-2 text-[12px] text-muted">{t('operaciones.imprenta.imprentas.vacio')}</li>
        )}
        {(imprentas ?? []).map((im) => (
          <li key={im.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${im.activo ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                {im.nombre}
                {!im.activo && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted">
                    {t('operaciones.imprenta.imprentas.inactiva')}
                  </span>
                )}
              </div>
              <ResumenRequisitos r={resolverRequisitos(im.requisitos, requisitosEmpresa)} />
            </div>
            {puedeImprentas && (
              <Button size="sm" variant="secondary" onClick={() => setEdicion({ tipo: 'imprenta', imprenta: im })}>
                <Pencil className="h-3.5 w-3.5" /> {t('operaciones.imprenta.imprentas.editar')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {edicion && (
        <FormRequisitos
          key={edicion.tipo === 'imprenta' ? edicion.imprenta.id : edicion.tipo}
          edicion={edicion}
          requisitosEmpresa={requisitosEmpresa}
          onClose={() => setEdicion(null)}
          onGuardado={recargar}
        />
      )}
    </CardColapsable>
  )
}

function FormRequisitos({
  edicion,
  requisitosEmpresa,
  onClose,
  onGuardado,
}: {
  edicion: Edicion
  requisitosEmpresa: RequisitosParciales | undefined
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const { t, idioma } = useIdioma()
  const propios: RequisitosParciales =
    edicion.tipo === 'imprenta' ? edicion.imprenta.requisitos : edicion.tipo === 'empresa' ? requisitosEmpresa ?? {} : {}
  // Lo que se hereda si un campo se deja vacío: la empresa hereda las
  // constantes; una imprenta, lo resuelto de la empresa.
  const heredado = resolverRequisitos(null, edicion.tipo === 'empresa' ? null : requisitosEmpresa)
  const [nombre, setNombre] = useState(edicion.tipo === 'imprenta' ? edicion.imprenta.nombre : '')
  const [activo, setActivo] = useState(edicion.tipo === 'imprenta' ? edicion.imprenta.activo : true)
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.k, propios[c.k] != null ? String(propios[c.k]) : ''])),
  )
  const [formatos, setFormatos] = useState<FormatoArte[]>(propios.formatos ?? [])
  const [enviando, setEnviando] = useState(false)

  async function guardar() {
    if (CAMPOS.some((c) => cifraIlegible(valores[c.k], idioma))) return
    const requisitos: RequisitosParciales = {}
    for (const c of CAMPOS) if (valores[c.k] !== '') requisitos[c.k] = Number(valores[c.k])
    if (formatos.length) requisitos.formatos = formatos
    setEnviando(true)
    try {
      if (edicion.tipo === 'empresa') await guardarRequisitosEmpresaApi(requisitos)
      else if (edicion.tipo === 'nueva') await crearImprentaApi({ nombre: nombre.trim(), requisitos })
      else await actualizarImprentaApi(edicion.imprenta.id, { nombre: nombre.trim(), requisitos, activo })
      await onGuardado()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.imprentas.no-guardar'))
    }
    setEnviando(false)
  }

  const n = (x: number) => formatNumero(x, x % 1 ? 2 : 0, idioma)
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={
        edicion.tipo === 'empresa'
          ? t('operaciones.imprenta.imprentas.empresa')
          : edicion.tipo === 'nueva'
            ? t('operaciones.imprenta.imprentas.nueva')
            : edicion.imprenta.nombre
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button
            variant="success"
            size="sm"
            disabled={enviando || (edicion.tipo !== 'empresa' && !nombre.trim())}
            onClick={guardar}
          >
            {t('comun.guardar')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {edicion.tipo !== 'empresa' && (
          <Campo label={t('operaciones.imprenta.imprentas.campo.nombre')} obligatorio>
            <input
              value={nombre}
              maxLength={120}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
            />
          </Campo>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <Campo key={c.k} label={t(c.clave)}>
              <EntradaCifra
                type="number"
                inputMode="decimal"
                valor={valores[c.k]}
                onCambio={(v: string) => setValores((x) => ({ ...x, [c.k]: v }))}
                placeholder={t('operaciones.imprenta.imprentas.hereda', { valor: n(heredado[c.k]) })}
                decimales={c.decimales}
                minimo={0}
                className="demo-num w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
              />
            </Campo>
          ))}
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-ink">{t('operaciones.imprenta.imprentas.campo.formatos')}</legend>
          <div className="flex flex-wrap gap-3">
            {FORMATOS_ARTE.map((f) => (
              <label key={f} className="inline-flex items-center gap-1.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={formatos.includes(f)}
                  onChange={(e) => setFormatos((x) => (e.target.checked ? [...x, f] : x.filter((y) => y !== f)))}
                />
                {f}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted">{t('operaciones.imprenta.imprentas.formatos-todos')}</p>
        </fieldset>
        {edicion.tipo === 'imprenta' && (
          <label className="inline-flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            {t('operaciones.imprenta.imprentas.campo.activa')}
          </label>
        )}
      </div>
    </Modal>
  )
}
