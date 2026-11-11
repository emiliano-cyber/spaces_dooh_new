'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileSignature, History, Loader2, Pencil } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { CampoContrasena } from '@/components/demo/ui/CampoContrasena'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { CRUDO_INVALIDO } from '@/lib/captura-cifra'
import {
  useArrendadores,
  useRazonesSociales,
  useEntidadesFiscales,
  formatFecha,
  type ContratoArrendamiento,
} from '@/lib/data/client'
import {
  editarContratoApi,
  cambiosDeContratoApi,
  estadoFirmaContratoApi,
  versionesFirmadasApi,
  versionFirmadaApi,
  type CambioContratoUI,
  type VersionFirmadaUI,
} from '@/lib/data/estado-api'
import { PERIODICIDADES, periodicidadLabel } from '@/lib/renta-periodicidad'
import { valorParaMostrar } from '@/lib/contrato-cambios'
import { desbloquearApi } from '@/lib/data/cambios-api'
import { confirmarConCandado } from '@/lib/cambios-candado'
import { ROL_CONTRATO, opcionesDeAsignacion } from '@/components/demo/razones-sociales/asignacion'
import { monedaInstancia } from '@/lib/i18n/dinero'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { Idioma } from '@/lib/i18n/idiomas'
import { CLAVE_CAMPO_CONTRATO, CLAVE_PARTE } from '@/components/demo/arrendadores/etiquetas'
import { localeDe } from '@/lib/i18n/formato-idioma'

// ============================================================================
//  CONTRATO-CAMBIOS (07/10) · cambiar un contrato ANTES de firmarlo, diciendo
//  quién pidió el cambio, y ver el historial.
//
//  Un contrato se negocia: el arrendador pide otra renta, nosotros otra fecha.
//  Este bloque es lo que la ficha del contrato no tenía —un editor de TODOS los
//  términos, no solo «completar lo que falta»— y la memoria de esa negociación.
//
//  Tres reglas que vienen del servidor y aquí solo se hacen visibles:
//   · Firmado por cualquiera de las dos partes → se edita CON MOTIVO (23/10):
//     la versión firmada se archiva entera, las firmas se anulan y se vuelve a
//     firmar. Hasta el 22/10 era 409 y el botón ni aparecía.
//   · Enviado a firma y sin firmar → se puede, pero el enlace del arrendador
//     deja de servir y hay que volver a enviarlo. Se avisa ANTES de guardar.
//   · Quién capturó el cambio lo pone el servidor con la sesión. Aquí solo se
//     elige QUÉ PARTE lo pidió, y es obligatorio: sin eso el historial no dice
//     lo que se le pidió que dijera.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// I18N (2026-11-02) · la etiqueta de cada parte es `CLAVE_PARTE`
// (arrendadores/etiquetas.ts): «El arrendador» y «Nosotros» en espanol.

// En espanol, la de siempre; en ingles, la fecha de `formatFecha` y la hora
// de reloj de alla.
function fechaHora(iso: string, idioma: Idioma = 'es') {
  const d = new Date(iso)
  return `${formatFecha(iso, idioma)} ${d.toLocaleTimeString(localeDe(idioma), { hour: '2-digit', minute: '2-digit' })}`
}

export function CambiosContrato({
  contrato,
  onToast,
}: {
  contrato: ContratoArrendamiento
  onToast: (msg: string) => void
}) {
  const [historial, setHistorial] = useState<CambioContratoUI[] | null>(null)
  const [firma, setFirma] = useState<{ firmado: boolean; enviado: boolean } | null>(null)
  const [versiones, setVersiones] = useState<VersionFirmadaUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const { idioma, t } = useIdioma()

  const cargar = useCallback(async () => {
    try {
      const [h, f, v] = await Promise.all([
        cambiosDeContratoApi(contrato.id),
        estadoFirmaContratoApi(contrato.id),
        versionesFirmadasApi(contrato.id),
      ])
      setHistorial(h)
      setFirma(f)
      setVersiones(v)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('arrendadores.cambios.no-historial'))
    }
  }, [contrato.id, t])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Un contrato INCOMPLETO tiene su propio formulario («Completar
  // información») y uno CANCELADO no se edita: se hace otro.
  const editable = firma != null && contrato.estatus !== 'CANCELADO' && contrato.estatus !== 'INCOMPLETO'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <History className="h-3.5 w-3.5" /> {t('arrendadores.cambios.titulo')}
        </h4>
        {editable && (
          <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
            <Pencil className="h-3.5 w-3.5" /> {t('arrendadores.cambios.editar')}
          </Button>
        )}
      </div>
      {firma?.firmado && (
        <p className="mb-2 text-[12px] text-muted">
          {t('arrendadores.cambios.ya-firmado')}
        </p>
      )}
      {error && <p className="text-[12px] text-error">{error}</p>}
      {historial && historial.length === 0 && (
        <p className="text-[12px] text-muted">{t('arrendadores.cambios.vacio')}</p>
      )}
      {historial && historial.length > 0 && (
        <ol className="space-y-2">
          {historial.map((h) => (
            <li key={h.id} className="rounded-md border border-border px-3 py-2 text-[12.5px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-ink">
                  {h.propuestoPor ? (
                    <>
                      {interpolarNodos(t('arrendadores.cambios.lo-propuso'), {
                        parte: <b>{t(CLAVE_PARTE[h.propuestoPor]).toLowerCase()}</b>,
                      })}
                    </>
                  ) : (
                    t('arrendadores.cambios.interna')
                  )}
                  <span className="text-muted">{t('arrendadores.cambios.registro', { nombre: h.usuarioNombre })}</span>
                </span>
                <span className="demo-num text-[11px] text-muted">{fechaHora(h.creadoEn, idioma)}</span>
              </div>
              {h.motivo && <p className="mt-0.5 text-muted">{t('arrendadores.comun.motivo', { motivo: h.motivo })}</p>}
              <ul className="mt-1 space-y-0.5">
                {h.cambios.map((c) => (
                  <li key={c.campo}>
                    {/* La etiqueta viene GUARDADA en espanol con cada cambio; en ingles se
                        pinta la del campo, que es estable. Uno desconocido, tal cual. */}
                    <span className="text-muted">
                      {idioma !== 'es' && CLAVE_CAMPO_CONTRATO[c.campo] ? t(CLAVE_CAMPO_CONTRATO[c.campo]) : c.etiqueta}:
                    </span>{' '}
                    <span className="line-through decoration-muted">{valorParaMostrar(c.campo, c.antes, idioma) ?? t('arrendadores.cambios.vacio-valor')}</span>
                    {' → '}
                    <b className="text-ink">{valorParaMostrar(c.campo, c.despues, idioma) ?? t('arrendadores.cambios.vacio-valor')}</b>
                  </li>
                ))}
              </ul>
              {h.versionFirmada != null ? (
                <p className="mt-1 text-[11.5px] text-warning">
                  {t('arrendadores.cambios.archivada', { n: h.versionFirmada })}
                </p>
              ) : h.envioAnulado && (
                <p className="mt-1 text-[11.5px] text-warning">
                  {t('arrendadores.cambios.envio-anulado')}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {versiones.length > 0 && <VersionesFirmadas contratoId={contrato.id} versiones={versiones} />}

      {editando && firma && (
        <EditarTerminosModal
          contrato={contrato}
          enviado={firma.enviado}
          firmado={firma.firmado}
          onCerrar={() => setEditando(false)}
          onHecho={(msg) => {
            onToast(msg)
            setEditando(false)
            void cargar()
          }}
        />
      )}
    </div>
  )
}

// ─── Versiones firmadas archivadas (23/10) ──────────────────────────────────
// Lo que se firmó antes de cada edición o reenvío. Es evidencia: quién firmó,
// cuándo, desde qué IP y el texto exacto, que se abre bajo demanda.
function VersionesFirmadas({ contratoId, versiones }: { contratoId: string; versiones: VersionFirmadaUI[] }) {
  const [abierta, setAbierta] = useState<VersionFirmadaUI | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { idioma, t } = useIdioma()

  async function abrir(v: number) {
    setError(null)
    try {
      setAbierta(await versionFirmadaApi(contratoId, v))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('arrendadores.versiones.no-leer'))
    }
  }

  return (
    <div className="mt-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <FileSignature className="h-3.5 w-3.5" /> {t('arrendadores.versiones.titulo')}
      </h4>
      <ol className="space-y-2">
        {versiones.map((v) => (
          <li key={v.version} className="rounded-md border border-border px-3 py-2 text-[12.5px]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-ink">
                <b>{t('arrendadores.versiones.version', { n: v.version })}</b>
                <span className="text-muted">{t('arrendadores.versiones.archivada', { fecha: fechaHora(v.archivadoEn, idioma) })}</span>
              </span>
              <button
                type="button"
                onClick={() => void abrir(v.version)}
                className="text-[12px] text-accent underline-offset-2 hover:underline"
              >
                {t('arrendadores.versiones.ver')}
              </button>
            </div>
            {v.motivo && (
              <p className="mt-0.5 text-muted">
                {t('arrendadores.comun.motivo', { motivo: v.motivo })}{v.usuarioNombre ? ` · ${v.usuarioNombre}` : ''}
              </p>
            )}
            <ul className="mt-1 space-y-0.5">
              {v.firmas.map((f) => (
                <li key={f.parte}>
                  {interpolarNodos(t(f.firmadoEn ? 'arrendadores.versiones.firmo-el' : 'arrendadores.versiones.firmo'), {
                    parte: <span className="text-muted">{t(CLAVE_PARTE[f.parte])}:</span>,
                    nombre: <b>{f.nombreFirmante}</b>,
                    fecha: f.firmadoEn ? fechaHora(f.firmadoEn, idioma) : '',
                  })}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
      {abierta && (
        <Modal
          open
          onOpenChange={(o) => (o ? undefined : setAbierta(null))}
          title={t('arrendadores.versiones.modal', { n: abierta.version })}
          subtitle={t('arrendadores.versiones.sello', { hash: abierta.documentoHash })}
        >
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-[12px] text-ink">{abierta.documento}</pre>
        </Modal>
      )}
    </div>
  )
}

// ─── El editor ──────────────────────────────────────────────────────────────
// Manda SOLO lo que cambió. El servidor también compara y no anota lo que no
// cambia, pero mandar el formulario entero haría que un «guardar» sin tocar
// nada pidiera la contraseña y recalculara el calendario por nada.
function EditarTerminosModal({
  contrato,
  enviado,
  firmado,
  onCerrar,
  onHecho,
}: {
  contrato: ContratoArrendamiento
  enviado: boolean
  // Alguien ya firmó (23/10): el motivo pasa a ser obligatorio, porque el
  // servidor archiva esa versión firmada y sin motivo responde 400.
  firmado: boolean
  onCerrar: () => void
  onHecho: (msg: string) => void
}) {
  const arrendadores = useArrendadores()
  const razones = useRazonesSociales()
  const entidades = useEntidadesFiscales()

  const inicial = {
    arrendadorId: contrato.arrendadorId ?? '',
    razonSocialId: contrato.razonSocialId ?? '',
    entidadId: contrato.entidadId ?? '',
    fechaInicio: contrato.fechaInicio.slice(0, 10),
    fechaFin: contrato.fechaFin ? contrato.fechaFin.slice(0, 10) : '',
    montoRenta: contrato.montoRenta != null ? String(contrato.montoRenta) : '',
    periodicidad: contrato.periodicidad ?? 'MENSUAL',
    moneda: contrato.moneda ?? monedaInstancia(),
    deposito: contrato.deposito != null ? String(contrato.deposito) : '',
    autoRenovable: contrato.autoRenovable,
  }
  const [f, setF] = useState(inicial)
  const [propuestoPor, setPropuestoPor] = useState<'ARRENDADOR' | 'ARRENDATARIO' | ''>('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [reautenticando, setReautenticando] = useState(false)
  const [pass, setPass] = useState('')
  const { idioma, t } = useIdioma()

  const poner = <K extends keyof typeof inicial>(k: K, v: (typeof inicial)[K]) => setF((x) => ({ ...x, [k]: v }))

  // Al cambiar de arrendador, su razón social anterior ya no le corresponde.
  const razonesDelArrendador = (razones ?? []).filter((r) => r.arrendadorId === f.arrendadorId)

  const patch: Parameters<typeof editarContratoApi>[1] = {}
  if (f.arrendadorId !== inicial.arrendadorId) patch.arrendadorId = f.arrendadorId
  if (f.razonSocialId !== inicial.razonSocialId) patch.razonSocialId = f.razonSocialId || null
  if (f.entidadId !== inicial.entidadId) patch.entidadId = f.entidadId || null
  if (f.fechaInicio !== inicial.fechaInicio) patch.fechaInicio = f.fechaInicio
  if (f.fechaFin !== inicial.fechaFin) patch.fechaFin = f.fechaFin
  if (Number(f.montoRenta) !== Number(inicial.montoRenta)) patch.montoRenta = Number(f.montoRenta)
  if (f.periodicidad !== inicial.periodicidad) patch.periodicidad = f.periodicidad
  if (f.moneda.trim() !== inicial.moneda) patch.moneda = f.moneda.trim()
  if (f.deposito !== inicial.deposito) patch.deposito = f.deposito === '' ? null : Number(f.deposito)
  if (f.autoRenovable !== inicial.autoRenovable) patch.autoRenovable = f.autoRenovable
  const hayCambios = Object.keys(patch).length > 0

  // OBLIG-01: antes un solo `faltante` deshabilitaba el botón y explicaba en
  // gris, en el pie, SOLO el primer dato que faltaba. Ahora lo obligatorio no
  // deshabilita: se pulsa y cada campo que falta se pinta en rojo.
  // Obligatorios = los que ya exigía `faltante` (quién propuso, arrendador,
  // renta y fin) más el inicio, que el PATCH rechaza vacío
  // (`fechaInicio: z.string().min(1)`, lib/server/arrendadores-controller.ts:231).
  const ob = useObligatorios(
    {
      propuestoPor,
      arrendadorId: f.arrendadorId,
      fechaInicio: f.fechaInicio,
      fechaFin: f.fechaFin,
      montoRenta: f.montoRenta,
      motivo: motivo.trim(),
    },
    ['propuestoPor', 'arrendadorId', 'fechaInicio', 'fechaFin', 'montoRenta', { campo: 'motivo', si: firmado }],
  )
  // Una cifra que CampoCifra no entiende llega como 'NaN': se dice así, y no
  // con el «tiene que ser mayor que cero» o «no puede ser negativo» de abajo,
  // que también la pararían pero diciendo otra cosa.
  const rentaIlegible = f.montoRenta === CRUDO_INVALIDO
  const depositoIlegible = f.deposito === CRUDO_INVALIDO
  // Una renta que se entiende pero no es mayor que cero no está «vacía» (el 0
  // es un dato) y aun así no vale: se dice en su campo tras el intento.
  const rentaMala = !ob.faltan.includes('montoRenta') && !(Number(f.montoRenta) > 0)
  const fechasInvertidas = !!f.fechaInicio && !!f.fechaFin && f.fechaFin < f.fechaInicio
  const depositoNegativo = f.deposito !== '' && !depositoIlegible && !(Number(f.deposito) >= 0)
  // Lo que SÍ deshabilita: no haber cambiado nada y los errores de formato,
  // que se ven al teclear y no son «falta un dato».
  const formatoMalo = rentaIlegible || depositoIlegible || fechasInvertidas || depositoNegativo
  const bloqueado = !hayCambios || formatoMalo
  const aviso = hayCambios && (formatoMalo || (ob.intento && (ob.faltan.length > 0 || rentaMala)))

  function cerrar() {
    setPass('')
    onCerrar()
  }

  async function guardar() {
    if (!ob.validar() || bloqueado || rentaMala || !propuestoPor) return
    setEnviando(true)
    setError(null)
    const r = await confirmarConCandado({
      reautenticando,
      contrasena: pass,
      desbloquear: desbloquearApi,
      guardar: () =>
        editarContratoApi(contrato.id, { ...patch, propuestoPor, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) }),
      mensajeSiFalla: t('arrendadores.editar.no-guardar'),
    })
    if (r.estado === 'hecho') {
      setPass('')
      onHecho(
        firmado
          ? t('arrendadores.editar.hecho-firmado')
          : enviado
            ? t('arrendadores.editar.hecho-enviado')
            : t('arrendadores.editar.hecho'),
      )
    } else if (r.estado === 'falta-contrasena') {
      setError(t('compartidos.candado.falta'))
    } else if (r.estado === 'pedir-contrasena') {
      setReautenticando(true)
      setError(r.error)
    } else {
      setError(r.error)
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => (v ? undefined : cerrar())}
      title={t('arrendadores.editar.titulo')}
      subtitle={
        firmado
          ? t('arrendadores.editar.sub-firmado')
          : t('arrendadores.editar.sub')
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          {aviso && <span className="mr-auto text-[12px] text-error">{t('arrendadores.comun.revisa-rojo')}</span>}
          <Button variant="secondary" size="sm" onClick={cerrar} disabled={enviando}>
            {t('comun.cancelar')}
          </Button>
          <Button size="sm" disabled={enviando || bloqueado || (reautenticando && !pass)} onClick={guardar}>
            {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {reautenticando ? t('comercial.comun.confirmar-guardar') : t('arrendadores.editar.guardar')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        {firmado ? (
          <p className="rounded border border-warning/40 bg-warning-soft p-2 text-[12.5px] text-ink">
            {interpolarNodos(t('arrendadores.editar.aviso-firmado'), { firmado: <b>{t('arrendadores.editar.aviso-firmado-b')}</b> })}
          </p>
        ) : enviado && (
          <p className="rounded border border-warning/40 bg-warning-soft p-2 text-[12.5px] text-ink">
            {interpolarNodos(t('arrendadores.editar.aviso-enviado'), { enviado: <b>{t('arrendadores.editar.aviso-enviado-b')}</b> })}
          </p>
        )}

        <Campo label={t('arrendadores.editar.quien')} como="div" obligatorio falta={ob.falta('propuestoPor')}>
          <div className="flex gap-4" role="radiogroup">
            {(['ARRENDADOR', 'ARRENDATARIO'] as const).map((p) => (
              <label key={p} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="propuesto-por"
                  checked={propuestoPor === p}
                  onChange={() => setPropuestoPor(p)}
                  disabled={enviando}
                />
                {t(CLAVE_PARTE[p])}
              </label>
            ))}
          </div>
        </Campo>

        <Campo label={t('arrendadores.editar.motivo')} obligatorio={firmado} falta={ob.falta('motivo')}>
          <input
            className={inputCls}
            value={motivo}
            maxLength={500}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t('arrendadores.editar.motivo-ph')}
            disabled={enviando}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Campo label={t('arrendadores.comun.arrendador')} obligatorio falta={ob.falta('arrendadorId')} className="sm:col-span-2">
            <select
              className={inputCls}
              value={f.arrendadorId}
              onChange={(e) => setF((x) => ({ ...x, arrendadorId: e.target.value, razonSocialId: '' }))}
              disabled={enviando}
            >
              {(arrendadores ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label={t('arrendadores.editar.razon-arrendador')}>
            <select
              className={inputCls}
              value={f.razonSocialId}
              onChange={(e) => poner('razonSocialId', e.target.value)}
              disabled={enviando}
            >
              <option value="">{t('arrendadores.comun.sin-razon')}</option>
              {razonesDelArrendador.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.razonSocial}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label={t('arrendadores.comun.la-paga')}>
            <select
              className={inputCls}
              value={f.entidadId}
              onChange={(e) => poner('entidadId', e.target.value)}
              disabled={enviando}
            >
              {opcionesDeAsignacion(entidades ?? [], ROL_CONTRATO, contrato.entidadId, idioma).map((o) => (
                <option key={o.valor || 'sin-asignar'} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label={t('arrendadores.editar.inicio')} obligatorio falta={ob.falta('fechaInicio')}>
            <input type="date" className={inputCls} value={f.fechaInicio}
              onChange={(e) => poner('fechaInicio', e.target.value)} disabled={enviando} />
          </Campo>
          <Campo
            label={t('arrendadores.editar.fin')}
            obligatorio
            falta={ob.falta('fechaFin')}
            error={fechasInvertidas ? t('inventario.wizard.no-antes-inicio') : null}
          >
            <input type="date" className={inputCls} value={f.fechaFin}
              onChange={(e) => poner('fechaFin', e.target.value)} disabled={enviando} />
          </Campo>
          <Campo
            label={t('arrendadores.comun.renta')}
            obligatorio
            falta={ob.falta('montoRenta')}
            error={
              rentaIlegible
                ? t('inventario.wizard.cifra')
                : ob.intento && rentaMala
                  ? t('arrendadores.editar.mayor-cero')
                  : null
            }
          >
            <CampoCifra className={inputCls} valor={f.montoRenta}
              onCambio={(crudo) => poner('montoRenta', crudo)} disabled={enviando} />
          </Campo>
          <Campo label={t('arrendadores.comun.periodicidad')} obligatorio>
            <select className={inputCls} value={f.periodicidad}
              onChange={(e) => poner('periodicidad', e.target.value)} disabled={enviando}>
              {PERIODICIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {idioma === 'es' ? p.label : periodicidadLabel(p.value, '—', idioma)}
                </option>
              ))}
            </select>
          </Campo>
          {/* ADR 0048 · la moneda NO se edita: es la de la instancia. Era un
              campo de texto libre que aceptaba cualquier codigo, y el importe
              se seguia pintando con la moneda de la instancia. El servidor
              rechaza otra (`arrendadores-controller.ts`). */}
          <Campo label={t('arrendadores.editar.moneda')}>
            <div className={`${inputCls} flex items-center bg-surface-2 text-muted`}>{f.moneda}</div>
          </Campo>
          <Campo
            label={t('arrendadores.comun.deposito')}
            error={
              depositoIlegible
                ? t('inventario.wizard.cifra')
                : depositoNegativo
                  ? t('arrendadores.editar.negativo')
                  : null
            }
          >
            <CampoCifra className={inputCls} valor={f.deposito}
              onCambio={(crudo) => poner('deposito', crudo)} disabled={enviando} />
          </Campo>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={f.autoRenovable}
              onChange={(e) => poner('autoRenovable', e.target.checked)} disabled={enviando} />
            {t('arrendadores.ficha.renovacion')}
          </label>
        </div>

        {reautenticando && (
          <div className="space-y-2 border-t border-border pt-2">
            <p className="text-[12px] text-muted">
              {t('compartidos.candado.pide')}
            </p>
            <CampoContrasena
              valor={pass}
              onChange={setPass}
              onEnter={() => {
                if (!enviando && pass) void guardar()
              }}
              deshabilitado={enviando}
            />
          </div>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    </Modal>
  )
}
