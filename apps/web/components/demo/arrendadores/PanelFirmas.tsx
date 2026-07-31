'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PenLine, Send, Copy, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

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
}: {
  contratoId: string
  inicial: Estado
  hayFaltantes: boolean
}) {
  const [estado, setEstado] = useState<Estado>(inicial)
  const [ocupado, setOcupado] = useState<string | null>(null)

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
        body: JSON.stringify({ accion }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'No se pudo completar la acción')
      setEstado(d)
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
          <button
            type="button"
            onClick={() => llamar('enviar')}
            disabled={hayFaltantes || ocupado !== null}
            className="doc-btn"
            style={{ marginTop: 14 }}
          >
            <Send className="h-3.5 w-3.5" />
            {ocupado === 'enviar' ? 'Congelando…' : 'Enviar a firma'}
          </button>
        </>
      ) : (
        <>
          <p className="doc-panel-nota" style={{ marginTop: 0 }}>
            Documento congelado el {fecha(estado.congeladoEn)}. Sello SHA-256:{' '}
            <span className="doc-evidencia-hash">{estado.hashCongelado}</span>
          </p>

          {/* La regla, dicha donde se ve que el contrato ya está firmado. El
              servidor la aplica (editarContrato devuelve 409), pero enterarse al
              intentar guardar es tarde: quien va a corregir un importe necesita
              saber ANTES que lo que procede es otro contrato, no una edición. */}
          {hayFirmadas && (
            <div className="doc-panel-nota" style={{ marginTop: 12 }}>
              <b>Este contrato ya está firmado, así que su información no cambia.</b> Lo
              firmado tiene que seguir coincidiendo con lo acordado. Si hay que modificar
              renta, vigencia o cualquier otra condición, se crea un contrato nuevo y este
              se conserva como está.
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

          <button
            type="button"
            onClick={() => llamar('enviar')}
            disabled={ocupado !== null}
            className="doc-btn"
            style={{ marginTop: 14, background: '#6b6b6b' }}
          >
            <Send className="h-3.5 w-3.5" /> Volver a enviar a firma (reinicia las firmas)
          </button>
        </>
      )}
    </section>
  )
}
