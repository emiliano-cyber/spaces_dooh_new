'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PenLine, Send, Copy, CheckCircle2, AlertTriangle, Clock, ClipboardCheck } from 'lucide-react'
import type { DatosArrendatario, DatosArrendador, DatosEspacio, DatosTerminos } from '@/lib/contrato-documento'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { periodicidadLabel } from '@/lib/renta-periodicidad'
import { formatearFecha } from '@/lib/i18n/dinero'
import { localeDe, numeroEnIdioma } from '@/lib/i18n/formato-idioma'

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

// I18N (2026-11-02) · este panel es la herramienta que RODEA al documento
// (`doc-no-print`): se traduce. El documento, su hash y la constancia no.
const ETIQUETA: Record<Firma['parte'], ClaveTexto> = {
  ARRENDADOR: 'arrendadores.firmas.parte.arrendador',
  ARRENDATARIO: 'arrendadores.firmas.parte.arrendatario',
}

// Ola 7 · la vigencia que se revisa antes de congelar. En espanol, la fecha ISO
// del dato, como siempre; en ingles, «Jan 1, 2026» (glosario). Es solo como se
// ENSENA: lo que se congela es el documento, que la recita en espanol.
const diaDeVigencia = (iso: string, idioma: Idioma) =>
  idioma === 'es' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : formatearFecha(iso, idioma, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const fecha = (iso: string | null, idioma: Idioma = 'es') =>
  iso ? new Date(iso).toLocaleString(localeDe(idioma), { dateStyle: 'long', timeStyle: 'short' }) : '—'

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
  const { idioma, t } = useIdioma()

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
      if (!r.ok) throw new Error(d.error ?? t('arrendadores.firmas.no-accion'))
      setEstado(d)
      setRevisando(false)
      toast.success(accion === 'enviar' ? t('arrendadores.firmas.enviado') : t('arrendadores.firmas.firmado'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('arrendadores.firmas.no-accion'))
    } finally {
      setOcupado(null)
    }
  }

  function copiarEnlace(token: string) {
    const url = `${window.location.origin}/spaces-dooh/firmar/${token}/`
    navigator.clipboard.writeText(url).then(
      () => toast.success(t('arrendadores.firmas.copiado')),
      () => toast.error(t('arrendadores.firmas.no-copiar', { url })),
    )
  }

  return (
    <section className="doc-panel-firma doc-no-print">
      <h2 className="doc-panel-titulo">{t('arrendadores.firmas.titulo')}</h2>

      {!enviado ? (
        <>
          <p className="doc-panel-nota">
            {interpolarNodos(t('arrendadores.firmas.nota'), { congela: <b>{t('arrendadores.firmas.congela')}</b> })}
          </p>
          {hayFaltantes && (
            <p className="doc-panel-error">
              {t('arrendadores.firmas.faltan')}
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
              <Send className="h-3.5 w-3.5" /> {t('arrendadores.firmas.enviar')}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="doc-panel-nota" style={{ marginTop: 0 }}>
            {interpolarNodos(t('arrendadores.firmas.congelado'), {
              fecha: fecha(estado.congeladoEn, idioma),
              hash: <span className="doc-evidencia-hash">{estado.hashCongelado}</span>,
            })}
          </p>

          {/* La regla, dicha donde se ve que el contrato ya está firmado. Desde
              el 23/10 un firmado SÍ se cambia (con motivo, desde «Editar
              términos» en la ficha), y quien va a corregir un importe tiene que
              saber ANTES que eso archiva esta versión y obliga a firmar otra. */}
          {hayFirmadas && (
            <div className="doc-panel-nota" style={{ marginTop: 12 }}>
              {interpolarNodos(t('arrendadores.firmas.ya-tiene'), { titulo: <b>{t('arrendadores.firmas.ya-tiene-titulo')}</b> })}
            </div>
          )}

          {desfasado && (
            <div className="doc-barra-aviso" style={{ marginTop: 12 }}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                {interpolarNodos(t('arrendadores.firmas.desfasado'), { titulo: <b>{t('arrendadores.firmas.desfasado-titulo')}</b> })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {[arrendador, arrendatario].filter(Boolean).map((f) => (
              <div key={f!.parte} className="doc-evidencia">
                <p className="doc-evidencia-titulo">{t(ETIQUETA[f!.parte])}</p>

                {f!.estatus === 'FIRMADA' ? (
                  <>
                    <p className="doc-evidencia-fila">
                      {f!.invalidada ? (
                        <span className="doc-evidencia-mal">
                          <AlertTriangle className="inline h-3.5 w-3.5" /> {t('arrendadores.firmas.invalidada')}
                        </span>
                      ) : (
                        <span style={{ color: '#146c39', fontWeight: 600 }}>
                          <CheckCircle2 className="inline h-3.5 w-3.5" /> {t('arrendadores.firmas.firmada')}
                        </span>
                      )}
                    </p>
                    <p className="doc-evidencia-fila">
                      {interpolarNodos(t('arrendadores.firmas.firmo'), {
                        nombre: <b>{f!.nombreFirmante}</b>,
                        fecha: fecha(f!.firmadoEn, idioma),
                      })}
                    </p>
                    <p className="doc-evidencia-fila">
                      {t('arrendadores.firmas.ip', { ip: f!.ip ?? '—', navegador: f!.userAgent?.slice(0, 70) ?? '—' })}
                    </p>
                    <p className="doc-evidencia-hash">{t('arrendadores.firmas.documento', { hash: f!.documentoHash ?? '' })}</p>
                  </>
                ) : (
                  <>
                    <p className="doc-evidencia-fila">
                      <Clock className="inline h-3.5 w-3.5" />{' '}
                      {f!.nombreEsperado
                        ? t('arrendadores.firmas.pendiente-de', { nombre: f!.nombreEsperado })
                        : t('arrendadores.firmas.pendiente')}
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
                        {ocupado === 'firmar' ? t('arrendadores.firmas.firmando') : t('arrendadores.firmas.firmar-arrendataria')}
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
                          <Copy className="h-3.5 w-3.5" /> {t('arrendadores.firmas.copiar')}
                        </button>
                        <p className="doc-panel-nota">
                          {t('arrendadores.firmas.envia', { fecha: fecha(f!.tokenExpiraEn, idioma) })}
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
                  ? t('arrendadores.firmas.anula')
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
                ? t('arrendadores.firmas.reenviar-archiva')
                : t('arrendadores.firmas.reenviar-reinicia')}
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
  const { arrendatario: e, arrendador: a, espacio: s, terminos: term } = revision.datos
  const { idioma, t } = useIdioma()
  // El importe se arma como lo recita el contrato (cifra y codigo de moneda): es
  // el dato que se va a congelar, no una etiqueta de la interfaz. No cambia.
  const importe = (n: number | null) => importeDeRevision(n, term.moneda, idioma)
  const bloques: { titulo: string; filas: [string, string | null][] }[] = [
    {
      titulo: t('arrendadores.firmas.parte.arrendatario'),
      filas: [
        [t('arrendadores.comun.razon-social'), e.razonSocial],
        [t('inventario.wizard.rfc'), e.rfc],
        [t('arrendadores.revision.domicilio-fiscal'), e.domicilioFiscal],
        [t('arrendadores.revision.representante'), e.representanteLegal],
      ],
    },
    {
      titulo: t('arrendadores.parte.arrendador'),
      filas: [
        [t('arrendadores.revision.nombre'), a.nombre],
        [t('arrendadores.comun.razon-social'), a.razonSocial],
        [t('inventario.wizard.rfc'), a.rfc],
        [t('arrendadores.comun.domicilio'), a.direccion],
      ],
    },
    {
      titulo: t('arrendadores.revision.espacio'),
      filas: [
        [t('arrendadores.revision.nombre'), s.nombre],
        [t('arrendadores.revision.direccion'), s.direccion],
      ],
    },
    {
      titulo: t('arrendadores.revision.terminos'),
      filas: [
        [t('arrendadores.comun.renta'), importe(term.montoRenta)],
        [
          t('arrendadores.comun.periodicidad'),
          term.periodicidad
            ? idioma === 'es'
              ? term.periodicidad.toLowerCase()
              : periodicidadLabel(term.periodicidad, '—', idioma).toLowerCase()
            : null,
        ],
        [
          t('arrendadores.comun.vigencia'),
          term.fechaInicio && term.fechaFin
            ? t('arrendadores.revision.rango', { desde: diaDeVigencia(term.fechaInicio, idioma), hasta: diaDeVigencia(term.fechaFin, idioma) })
            : null,
        ],
        [t('arrendadores.comun.deposito'), importe(term.deposito)],
      ],
    },
  ]
  return (
    <div className="doc-evidencia" style={{ marginTop: 14 }}>
      <p className="doc-evidencia-titulo">
        <ClipboardCheck className="inline h-3.5 w-3.5" /> {t('arrendadores.revision.titulo')}
      </p>
      <p className="doc-panel-nota" style={{ marginTop: 4 }}>
        {t('arrendadores.revision.nota')}
      </p>
      {bloques.map((b) => (
        <div key={b.titulo} style={{ marginTop: 10 }}>
          <p className="doc-evidencia-fila">
            <b>{b.titulo}</b>
          </p>
          {b.filas.map(([k, val]) => (
            <p key={k} className="doc-evidencia-fila">
              {interpolarNodos(t('arrendadores.revision.fila'), {
                campo: k,
                valor: val ? <b>{val}</b> : <span className="doc-evidencia-mal">{t('arrendadores.revision.sin-capturar')}</span>,
              })}
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
          <Send className="h-3.5 w-3.5" /> {ocupado ? t('arrendadores.revision.congelando') : t('arrendadores.revision.correctos')}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="doc-btn"
          style={{ background: '#6b6b6b' }}
        >
          {t('arrendadores.revision.corregir')}
        </button>
      </div>
    </div>
  )
}

/**
 * El importe de la revision previa a enviar a firma, «como lo recita el
 * contrato». En espanol y en ingles el contrato dice «$6,000.00 MXN» y aqui
 * sale igual que siempre. El contrato ITALIANO dice «6.000,00 MXN» (ADR 0049):
 * con la interfaz en italiano se mostraba el formato mexicano (recorrido del
 * 04/11), que en Italia se lee al reves. El PORTUGUES (P3, 05/11) igual: su
 * contrato dice «1.234.567,89 MXN» (H1 de la validacion de P3).
 */
export function importeDeRevision(n: number | null, moneda: string, idioma: Idioma): string | null {
  if (n == null) return null
  const opciones = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  if (idioma === 'it' || idioma === 'pt') return `${numeroEnIdioma(n, idioma, opciones)} ${moneda}`
  return `$${n.toLocaleString('es-MX', opciones)} ${moneda}`
}
