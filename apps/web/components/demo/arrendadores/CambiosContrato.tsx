'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, Pencil } from 'lucide-react'
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
  type CambioContratoUI,
} from '@/lib/data/estado-api'
import { PERIODICIDADES } from '@/lib/renta-periodicidad'
import { valorParaMostrar } from '@/lib/contrato-cambios'
import { desbloquearApi } from '@/lib/data/cambios-api'
import { confirmarConCandado } from '@/lib/cambios-candado'
import { ROL_CONTRATO, opcionesDeAsignacion } from '@/components/demo/razones-sociales/asignacion'

// ============================================================================
//  CONTRATO-CAMBIOS (07/10) · cambiar un contrato ANTES de firmarlo, diciendo
//  quién pidió el cambio, y ver el historial.
//
//  Un contrato se negocia: el arrendador pide otra renta, nosotros otra fecha.
//  Este bloque es lo que la ficha del contrato no tenía —un editor de TODOS los
//  términos, no solo «completar lo que falta»— y la memoria de esa negociación.
//
//  Tres reglas que vienen del servidor y aquí solo se hacen visibles:
//   · Firmado por cualquiera de las dos partes → no se edita (409). El botón ni
//     aparece: enterarse al guardar es peor que no ofrecerlo.
//   · Enviado a firma y sin firmar → se puede, pero el enlace del arrendador
//     deja de servir y hay que volver a enviarlo. Se avisa ANTES de guardar.
//   · Quién capturó el cambio lo pone el servidor con la sesión. Aquí solo se
//     elige QUÉ PARTE lo pidió, y es obligatorio: sin eso el historial no dice
//     lo que se le pidió que dijera.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const PARTE_LABEL = { ARRENDADOR: 'El arrendador', ARRENDATARIO: 'Nosotros' } as const

function fechaHora(iso: string) {
  const d = new Date(iso)
  return `${formatFecha(iso)} ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
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
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [h, f] = await Promise.all([
        cambiosDeContratoApi(contrato.id),
        estadoFirmaContratoApi(contrato.id),
      ])
      setHistorial(h)
      setFirma(f)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el historial')
    }
  }, [contrato.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Un contrato INCOMPLETO tiene su propio formulario («Completar
  // información») y uno CANCELADO no se edita: se hace otro.
  const editable =
    firma != null && !firma.firmado && contrato.estatus !== 'CANCELADO' && contrato.estatus !== 'INCOMPLETO'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <History className="h-3.5 w-3.5" /> Cambios al contrato
        </h4>
        {editable && (
          <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar términos
          </Button>
        )}
      </div>
      {firma?.firmado && (
        <p className="mb-2 text-[12px] text-muted">
          Ya está firmado, así que sus términos no cambian. Si hay que modificarlos, se hace un
          contrato nuevo.
        </p>
      )}
      {error && <p className="text-[12px] text-error">{error}</p>}
      {historial && historial.length === 0 && (
        <p className="text-[12px] text-muted">Sin cambios registrados desde que se dio de alta.</p>
      )}
      {historial && historial.length > 0 && (
        <ol className="space-y-2">
          {historial.map((h) => (
            <li key={h.id} className="rounded-md border border-border px-3 py-2 text-[12.5px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-ink">
                  {h.propuestoPor ? (
                    <>
                      Lo propuso <b>{PARTE_LABEL[h.propuestoPor].toLowerCase()}</b>
                    </>
                  ) : (
                    'Captura interna'
                  )}
                  <span className="text-muted"> · lo registró {h.usuarioNombre}</span>
                </span>
                <span className="demo-num text-[11px] text-muted">{fechaHora(h.creadoEn)}</span>
              </div>
              {h.motivo && <p className="mt-0.5 text-muted">«{h.motivo}»</p>}
              <ul className="mt-1 space-y-0.5">
                {h.cambios.map((c) => (
                  <li key={c.campo}>
                    <span className="text-muted">{c.etiqueta}:</span>{' '}
                    <span className="line-through decoration-muted">{valorParaMostrar(c.campo, c.antes) ?? 'vacío'}</span>
                    {' → '}
                    <b className="text-ink">{valorParaMostrar(c.campo, c.despues) ?? 'vacío'}</b>
                  </li>
                ))}
              </ul>
              {h.envioAnulado && (
                <p className="mt-1 text-[11.5px] text-warning">
                  Ya se había enviado a firma: ese enlace dejó de servir y hubo que reenviarlo.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {editando && firma && (
        <EditarTerminosModal
          contrato={contrato}
          enviado={firma.enviado}
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

// ─── El editor ──────────────────────────────────────────────────────────────
// Manda SOLO lo que cambió. El servidor también compara y no anota lo que no
// cambia, pero mandar el formulario entero haría que un «guardar» sin tocar
// nada pidiera la contraseña y recalculara el calendario por nada.
function EditarTerminosModal({
  contrato,
  enviado,
  onCerrar,
  onHecho,
}: {
  contrato: ContratoArrendamiento
  enviado: boolean
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
    moneda: contrato.moneda ?? 'MXN',
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
    },
    ['propuestoPor', 'arrendadorId', 'fechaInicio', 'fechaFin', 'montoRenta'],
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
      mensajeSiFalla: 'No se pudo guardar el cambio',
    })
    if (r.estado === 'hecho') {
      setPass('')
      onHecho(enviado ? 'Cambio guardado · vuelve a enviar el contrato a firma' : 'Cambio guardado en el historial')
    } else if (r.estado === 'falta-contrasena') {
      setError('Escribe tu contraseña para confirmar.')
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
      title="Editar términos del contrato"
      subtitle="Antes de firmarse. Cada cambio queda en el historial con quién lo pidió."
      footer={
        <div className="flex items-center justify-end gap-2">
          {aviso && <span className="mr-auto text-[12px] text-error">Revisa los campos marcados en rojo.</span>}
          <Button variant="secondary" size="sm" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" disabled={enviando || bloqueado || (reautenticando && !pass)} onClick={guardar}>
            {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {reautenticando ? 'Confirmar y guardar' : 'Guardar cambio'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        {enviado && (
          <p className="rounded border border-warning/40 bg-warning-soft p-2 text-[12.5px] text-ink">
            Este contrato <b>ya se envió a firma</b>. Si guardas un cambio, el enlace que tiene el
            arrendador deja de servir y tendrás que enviarlo otra vez con el texto nuevo.
          </p>
        )}

        <Campo label="¿Quién propuso el cambio?" como="div" obligatorio falta={ob.falta('propuestoPor')}>
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
                {PARTE_LABEL[p]}
              </label>
            ))}
          </div>
        </Campo>

        <Campo label="Motivo">
          <input
            className={inputCls}
            value={motivo}
            maxLength={500}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. pidió bajar la renta a cambio de un plazo más largo"
            disabled={enviando}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Campo label="Arrendador" obligatorio falta={ob.falta('arrendadorId')} className="sm:col-span-2">
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
          <Campo label="Razón social del arrendador">
            <select
              className={inputCls}
              value={f.razonSocialId}
              onChange={(e) => poner('razonSocialId', e.target.value)}
              disabled={enviando}
            >
              <option value="">Sin razón social</option>
              {razonesDelArrendador.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.razonSocial}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="La paga">
            <select
              className={inputCls}
              value={f.entidadId}
              onChange={(e) => poner('entidadId', e.target.value)}
              disabled={enviando}
            >
              {opcionesDeAsignacion(entidades ?? [], ROL_CONTRATO, contrato.entidadId).map((o) => (
                <option key={o.valor || 'sin-asignar'} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Inicio" obligatorio falta={ob.falta('fechaInicio')}>
            <input type="date" className={inputCls} value={f.fechaInicio}
              onChange={(e) => poner('fechaInicio', e.target.value)} disabled={enviando} />
          </Campo>
          <Campo
            label="Fin"
            obligatorio
            falta={ob.falta('fechaFin')}
            error={fechasInvertidas ? 'No puede ser anterior al inicio' : null}
          >
            <input type="date" className={inputCls} value={f.fechaFin}
              onChange={(e) => poner('fechaFin', e.target.value)} disabled={enviando} />
          </Campo>
          <Campo
            label="Renta"
            obligatorio
            falta={ob.falta('montoRenta')}
            error={
              rentaIlegible
                ? 'No se entiende la cifra'
                : ob.intento && rentaMala
                  ? 'Tiene que ser mayor que cero'
                  : null
            }
          >
            <CampoCifra className={inputCls} valor={f.montoRenta}
              onCambio={(crudo) => poner('montoRenta', crudo)} disabled={enviando} />
          </Campo>
          <Campo label="Periodicidad" obligatorio>
            <select className={inputCls} value={f.periodicidad}
              onChange={(e) => poner('periodicidad', e.target.value)} disabled={enviando}>
              {PERIODICIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Moneda">
            <input className={inputCls} value={f.moneda}
              onChange={(e) => poner('moneda', e.target.value.toUpperCase())} disabled={enviando} />
          </Campo>
          <Campo
            label="Depósito"
            error={
              depositoIlegible
                ? 'No se entiende la cifra'
                : depositoNegativo
                  ? 'No puede ser negativo'
                  : null
            }
          >
            <CampoCifra className={inputCls} valor={f.deposito}
              onCambio={(crudo) => poner('deposito', crudo)} disabled={enviando} />
          </Campo>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={f.autoRenovable}
              onChange={(e) => poner('autoRenovable', e.target.checked)} disabled={enviando} />
            Renovación automática
          </label>
        </div>

        {reautenticando && (
          <div className="space-y-2 border-t border-border pt-2">
            <p className="text-[12px] text-muted">
              Tu organización pide la contraseña para confirmar los cambios sensibles.
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
