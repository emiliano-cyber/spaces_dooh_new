'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PenLine, Send, Copy, CheckCircle2, AlertTriangle, Clock, ClipboardCheck } from 'lucide-react'
import type { DatosArrendatario, DatosArrendador, DatosEspacio, DatosTerminos } from '@/lib/contrato-documento'

// Lo que el contrato va a recitar, tal como está HOY en la base, y su huella
// (`huellaDatosContrato`). Se enseña antes de congelar: es el «revisa y valida»
// del 23/10. La huella viaja de vuelta al enviar y el servidor rechaza el envío
// si los datos cambiaron mientras se revisaban.
interface Revision {
  huella: string
  datos: { arrendatario: DatosArrendatario; arrendador: DatosArrendador; espacio: DatosEspacio; terminos: DatosTerminos }
}

interface Firma {
  parte: 'ARRENDADOR' | 'ARRENDATARIO'
  estatus: 'PENDIENTE' | 'FIRMADA' | 'CANCELADA'
  nombreEsperado: string | null
  nombreFirmante: string | null
  firmadoEn: string | null
  ip: string | null
  userAgent: string | null
  documentoHash: string | null
  invalidada: boolean
  token: string | null
  tokenExpiraEn: string | null
}

interface Estado {
  firmas: Firma[]
  hashActual: string | null
  hashCongelado: string | null
  congeladoEn: string | null
}

const ETIQUETA: Record<Firma['parte'], string> = {
  ARRENDADOR: 'El arrendador (dueño del espacio)',
  ARRENDATARIO: 'Tu empresa (arrendataria)',
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '—'

export function PanelFirmas({
  contratoId,
  inicial,
  hayFaltantes,
  revision,
}: {
  contratoId: string
  inicial: Estado
  hayFaltantes: boolean
  revision: Revision | null
}) {
  const [estado, setEstado] = useState<Estado>(inicial)
  const [ocupado, setOcupado] = useState<string | null>(null)
  // El paso de revisión está abierto: «Enviar a firma» ya no congela de un
  // golpe, primero enseña los datos y pide confirmarlos.
  const [revisando, setRevisando] = useState(false)

  const arrendador = estado.firmas.find((f) => f.parte === 'ARRENDADOR')
  const arrendatario = estado.firmas.find((f) => f.parte === 'ARRENDATARIO')
  const enviado = !!estado.congeladoEn
  // Congelado NO es lo mismo que firmado: enviar a firma congela el texto, pero
  // mientras nadie haya firmado el contrato todavía se puede corregir. La regla
  // de «ya no cambia» se ata a que exista al menos una firma real.
  const hayFirmadas = estado.firmas.some((f) => f.estatus === 'FIRMADA')
  // El documento cambió después de congelarlo: lo firmado ya no es lo que dice
  // el contrato hoy.
  const desfasado =
    enviado && !!estado.hashActual && estado.hashActual !== estado.hashCongelado

  async function llamar(accion: 'enviar' | 'firmar') {
    setOcupado(accion)
    try {
      const r = await fetch(`/spaces-dooh/api/contratos/${contratoId}/firma/`, {
        method: 'POST',
        // El header CSRF lo añade el parche global de `fetch` (lib/csrf-client),
        // instalado en providers.tsx: no hay que ponerlo a mano en cada llamada.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accion === 'enviar' ? { accion, huellaRevisada: revision?.huella } : { accion }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'No se pudo completar la acción')
      setEstado(d)
      setRevisando(false)
      toast.success(accion === 'enviar' ? 'Documento congelado y enviado a firma' : 'Firmado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción')
    } finally {
      setOcupado(null)
    }
  }

  function copiarEnlace(token: string) {
    const url = `${window.location.origin}/spaces-dooh/firmar/${token}/`
    navigator.clipboard.writeText(url).then(
      () => toast.success('Enlace copiado. Envíaselo al arrendador.'),
      () => toast.error('No se pudo copiar. El enlace es: ' + url),
    )
  }

  return (
    <section className="doc-panel-firma doc-no-print">
      <h2 className="doc-panel-titulo">Firma del contrato</h2>

      {!enviado ? (
        <>
          <p className="doc-panel-nota">
            Al enviar a firma, el sistema <b>congela</b> el texto exacto de este contrato y
            lo sella con SHA-256. A partir de ese momento, lo que se firma es esa versión y
            no «lo que diga la base de datos». Si después se edita el contrato, las firmas
            se marcan como invalidadas.
          </p>
          {hayFaltantes && (
            <p className="doc-panel-error">
              No se puede enviar a firma mientras falten datos por capturar (ver arriba).
            </p>
          )}
          {revisando && revision ? (
            <RevisionDatos
              revision={revision}
              ocupado={ocupado === 'enviar'}
              onConfirmar={() => llamar('enviar')}
              onCancelar={() => setRevisando(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setRevisando(true)}
              disabled={hayFaltantes || ocupado !== null || !revision}
              className="doc-btn"
              style={{ marginTop: 14 }}
            >
              <Send className="h-3.5 w-3.5" /> Enviar a firma
            </button>
          )}
        </>
      ) : (
        <>
          <p className="doc-panel-nota" style={{ marginTop: 0 }}>
            Documento congelado el {fecha(estado.congeladoEn)}. Sello SHA-256:{' '}
            <span className="doc-evidencia-hash">{estado.hashCongelado}</span>
          </p>

          {/* La regla, dicha donde se ve que el contrato ya está firmado. Desde
              el 23/10 un firmado SÍ se cambia (con motivo, desde «Editar
              términos» en la ficha), y quien va a corregir un importe tiene que
              saber ANTES que eso archiva esta versión y obliga a firmar otra. */}
          {hayFirmadas && (
            <div className="doc-panel-nota" style={{ marginTop: 12 }}>
              <b>Este contrato ya tiene firmas.</b> Si hay que modificar renta, vigencia o
              cualquier otra condición, edítalo desde «Editar términos» en su ficha: esta
              versión se archiva tal como se firmó —texto y firmas— y el contrato se vuelve a
              enviar a firma con los datos actuales.
            </div>
          )}

          {desfasado && (
            <div className="doc-barra-aviso" style={{ marginTop: 12 }}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <b>El contrato cambió después de congelarse.</b> Las firmas ya no
                corresponden al texto actual. Vuelve a enviar a firma para sellar la
                versión nueva y recabar las firmas otra vez.
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {[arrendador, arrendatario].filter(Boolean).map((f) => (
              <div key={f!.parte} className="doc-evidencia">
                <p className="doc-evidencia-titulo">{ETIQUETA[f!.parte]}</p>

                {f!.estatus === 'FIRMADA' ? (
                  <>
                    <p className="doc-evidencia-fila">
                      {f!.invalidada ? (
                        <span className="doc-evidencia-mal">
                          <AlertTriangle className="inline h-3.5 w-3.5" /> Firma invalidada
                          (el documento cambió)
                        </span>
                      ) : (
                        <span style={{ color: '#146c39', fontWeight: 600 }}>
                          <CheckCircle2 className="inline h-3.5 w-3.5" /> Firmada
                        </span>
                      )}
                    </p>
                    <p className="doc-evidencia-fila">
                      Firmó: <b>{f!.nombreFirmante}</b> · {fecha(f!.firmadoEn)}
                    </p>
                    <p className="doc-evidencia-fila">
                      IP: {f!.ip ?? '—'} · Navegador: {f!.userAgent?.slice(0, 70) ?? '—'}
                    </p>
                    <p className="doc-evidencia-hash">Documento firmado: {f!.documentoHash}</p>
                  </>
                ) : (
                  <>
                    <p className="doc-evidencia-fila">
                      <Clock className="inline h-3.5 w-3.5" /> Pendiente
                      {f!.nombreEsperado ? ` — se espera la firma de ${f!.nombreEsperado}` : ''}
                    </p>
                    {f!.parte === 'ARRENDATARIO' && (
                      <button
                        type="button"
                        onClick={() => llamar('firmar')}
                        disabled={ocupado !== null}
                        className="doc-btn"
                        style={{ marginTop: 8 }}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        {ocupado === 'firmar' ? 'Firmando…' : 'Firmar como arrendataria'}
                      </button>
                    )}
                    {f!.parte === 'ARRENDADOR' && f!.token && (
                      <>
                        <button
                          type="button"
                          onClick={() => copiarEnlace(f!.token!)}
                          className="doc-btn"
                          style={{ marginTop: 8 }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copiar enlace de firma
                        </button>
                        <p className="doc-panel-nota">
                          Envíaselo al arrendador. Vence el {fecha(f!.tokenExpiraEn)}. Quien
                          tenga el enlace puede firmar, así que trátalo como una credencial.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {revisando && revision ? (
            <RevisionDatos
              revision={revision}
              ocupado={ocupado === 'enviar'}
              aviso={
                hayFirmadas
                  ? 'Las firmas actuales se anulan. La versión firmada queda archivada tal como se firmó.'
                  : null
              }
              onConfirmar={() => llamar('enviar')}
              onCancelar={() => setRevisando(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setRevisando(true)}
              disabled={ocupado !== null || hayFaltantes || !revision}
              className="doc-btn"
              style={{ marginTop: 14, background: '#6b6b6b' }}
            >
              <Send className="h-3.5 w-3.5" />{' '}
              {hayFirmadas
                ? 'Volver a enviar a firma (archiva las firmas actuales)'
                : 'Volver a enviar a firma (reinicia las firmas)'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

// ─── El paso de revisión (23/10) ────────────────────────────────────────────
// Los datos actuales que el contrato va a recitar, en limpio, antes de congelar.
// Un hueco se dice como tal: el documento de arriba ya los marca, pero aquí es
// donde se decide enviarlo.
function RevisionDatos({
  revision,
  ocupado,
  aviso,
  onConfirmar,
  onCancelar,
}: {
  revision: Revision
  ocupado: boolean
  aviso?: string | null
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const { arrendatario: e, arrendador: a, espacio: s, terminos: t } = revision.datos
  const importe = (n: number | null) =>
    n == null ? null : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t.moneda}`
  const bloques: { titulo: string; filas: [string, string | null][] }[] = [
    {
      titulo: 'Tu empresa (arrendataria)',
      filas: [
        ['Razón social', e.razonSocial],
        ['RFC', e.rfc],
        ['Domicilio fiscal', e.domicilioFiscal],
        ['Representante legal', e.representanteLegal],
      ],
    },
    {
      titulo: 'El arrendador',
      filas: [
        ['Nombre', a.nombre],
        ['Razón social', a.razonSocial],
        ['RFC', a.rfc],
        ['Domicilio', a.direccion],
      ],
    },
    {
      titulo: 'El espacio',
      filas: [
        ['Nombre', s.nombre],
        ['Dirección', s.direccion],
      ],
    },
    {
      titulo: 'Términos',
      filas: [
        ['Renta', importe(t.montoRenta)],
        ['Periodicidad', t.periodicidad ? t.periodicidad.toLowerCase() : null],
        ['Vigencia', t.fechaInicio && t.fechaFin ? `${t.fechaInicio} a ${t.fechaFin}` : null],
        ['Depósito', importe(t.deposito)],
      ],
    },
  ]
  return (
    <div className="doc-evidencia" style={{ marginTop: 14 }}>
      <p className="doc-evidencia-titulo">
        <ClipboardCheck className="inline h-3.5 w-3.5" /> Revisa los datos que llevará el contrato
      </p>
      <p className="doc-panel-nota" style={{ marginTop: 4 }}>
        Son los datos actuales. Si alguno está mal, corrígelo antes de enviar: los de tu empresa en
        Administración, los del arrendador en su ficha y los términos con «Editar términos».
      </p>
      {bloques.map((b) => (
        <div key={b.titulo} style={{ marginTop: 10 }}>
          <p className="doc-evidencia-fila">
            <b>{b.titulo}</b>
          </p>
          {b.filas.map(([k, val]) => (
            <p key={k} className="doc-evidencia-fila">
              {k}: {val ? <b>{val}</b> : <span className="doc-evidencia-mal">sin capturar</span>}
            </p>
          ))}
        </div>
      ))}
      {aviso && (
        <p className="doc-panel-error" style={{ marginTop: 10 }}>
          {aviso}
        </p>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onConfirmar} disabled={ocupado} className="doc-btn">
          <Send className="h-3.5 w-3.5" /> {ocupado ? 'Congelando…' : 'Los datos son correctos, enviar a firma'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="doc-btn"
          style={{ background: '#6b6b6b' }}
        >
          Corregir antes
        </button>
      </div>
    </div>
  )
}
