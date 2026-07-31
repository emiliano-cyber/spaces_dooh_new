'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, PenLine } from 'lucide-react'

// Firma del arrendador desde el enlace público. Deliberadamente austera: quien
// llega aquí no conoce la plataforma y lo único que debe hacer es leer y decidir.
export function FirmaPublica({
  token,
  documento,
  nombreEsperado,
  expirado,
  yaFirmada,
}: {
  token: string
  // Null cuando el enlace expiró: el servidor deja de mandar el texto (ver
  // `firmaPorToken`). No es un caso de error — es la vigencia haciendo su
  // trabajo— así que se explica, no se deja la hoja en blanco.
  documento: string | null
  nombreEsperado: string | null
  expirado: boolean
  yaFirmada: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [firmado, setFirmado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cerrado = expirado || yaFirmada || firmado
  const puedeFirmar = !cerrado && nombre.trim().length >= 3 && acepta && !enviando

  async function firmar() {
    setEnviando(true)
    setError(null)
    try {
      const r = await fetch(`/spaces-dooh/api/firma/${token}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'No se pudo firmar')
      setFirmado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo firmar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="doc-wrap">
      <div className="doc-barra">
        {firmado ? (
          <div className="doc-firma-ok">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <b>Contrato firmado.</b> Se registró tu firma con la fecha y hora de este
              momento. Puedes guardar una copia con Ctrl+P → «Guardar como PDF».
            </div>
          </div>
        ) : yaFirmada ? (
          <div className="doc-firma-ok">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>Este contrato ya fue firmado con este enlace.</div>
          </div>
        ) : expirado ? (
          <div className="doc-barra-aviso">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <b>El enlace expiró.</b> Pide al remitente que te envíe uno nuevo.
            </div>
          </div>
        ) : (
          <div className="doc-barra-aviso">
            <PenLine className="h-4 w-4 shrink-0" />
            <div>
              Lee el contrato completo. Al final encontrarás el espacio para firmarlo
              electrónicamente.
            </div>
          </div>
        )}
      </div>

      <article className="doc-hoja">
        {documento === null ? (
          <div className="doc-aviso-caja">
            <h1 className="doc-titulo">El enlace expiró</h1>
            <p className="doc-p">
              Por seguridad, el texto del contrato ya no se muestra desde este enlace. Pide
              al remitente que te envíe uno nuevo y podrás leerlo y firmarlo.
            </p>
          </div>
        ) : (
          /* El documento congelado se muestra tal cual se selló: texto plano, sin
             reinterpretarlo. Cualquier reformateo cambiaría lo que se firma. */
          <pre className="doc-congelado">{documento}</pre>
        )}

        {!cerrado && (
          <div className="doc-panel-firma doc-no-print">
            <h2 className="doc-panel-titulo">Firmar electrónicamente</h2>
            {nombreEsperado && (
              <p className="doc-panel-nota">
                Este contrato se envió a firma de <b>{nombreEsperado}</b>.
              </p>
            )}

            <label className="doc-campo">
              <span>Escribe tu nombre completo</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellidos"
                autoComplete="name"
                className="doc-input"
              />
            </label>

            <label className="doc-check">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>
                He leído el contrato en su totalidad y manifiesto mi voluntad de obligarme
                en sus términos. Acepto que mi firma electrónica producirá los mismos
                efectos que la firma autógrafa.
              </span>
            </label>

            {error && <p className="doc-panel-error">{error}</p>}

            <button type="button" onClick={firmar} disabled={!puedeFirmar} className="doc-btn">
              <PenLine className="h-3.5 w-3.5" />
              {enviando ? 'Firmando…' : 'Firmar contrato'}
            </button>

            <p className="doc-panel-nota">
              Al firmar se registrará la fecha y hora, tu dirección IP y el navegador
              desde el que firmas, junto con un sello digital (SHA-256) del texto exacto
              que estás firmando. Ese sello permite demostrar después que el documento no
              se modificó.
            </p>
          </div>
        )}
      </article>
    </div>
  )
}
