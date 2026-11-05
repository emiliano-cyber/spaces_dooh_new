'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, PenLine } from 'lucide-react'
import { useTexto } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'

// Firma del arrendador desde el enlace público. Deliberadamente austera: quien
// llega aquí no conoce la plataforma y lo único que debe hacer es leer y decidir.
export function FirmaPublica({
  token,
  documento,
  nombreEsperado,
  expirado,
  yaFirmada,
  logoUrl,
}: {
  token: string
  // Membrete de la organización que ofrece el contrato. El mismo documento ya
  // salía con logo por dentro (/contrato/[id]) y aquí no — justo donde lo lee
  // quien lo firma.
  logoUrl?: string | null
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
  // I18N (2026-11-02) · la interfaz va en el idioma de quien abre el enlace; el
  // documento que firma (`documento`, congelado y sellado) NO se toca.
  const t = useTexto()

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
      if (!r.ok) throw new Error(d.error ?? t('arrendadores.publica.no-firmar'))
      setFirmado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('arrendadores.publica.no-firmar'))
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
              {interpolarNodos(t('arrendadores.publica.firmado'), { titulo: <b>{t('arrendadores.publica.firmado-titulo')}</b> })}
            </div>
          </div>
        ) : yaFirmada ? (
          <div className="doc-firma-ok">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>{t('arrendadores.publica.ya-firmada')}</div>
          </div>
        ) : expirado ? (
          <div className="doc-barra-aviso">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              {interpolarNodos(t('arrendadores.publica.expiro'), { titulo: <b>{t('arrendadores.publica.expiro-titulo')}</b> })}
            </div>
          </div>
        ) : (
          <div className="doc-barra-aviso">
            <PenLine className="h-4 w-4 shrink-0" />
            <div>
              {t('arrendadores.publica.lee')}
            </div>
          </div>
        )}
      </div>

      <article className="doc-hoja">
        {/* Mismo membrete que /contrato/[id], con las mismas clases: el CSS de
            impresión ya fuerza que el color no se pierda al mandar a papel. */}
        {logoUrl && (
          <div className="doc-membrete">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="doc-logo" />
          </div>
        )}
        {documento === null ? (
          <div className="doc-aviso-caja">
            <h1 className="doc-titulo">{t('arrendadores.publica.expiro-h1')}</h1>
            <p className="doc-p">
              {t('arrendadores.publica.expiro-texto')}
            </p>
          </div>
        ) : (
          /* El documento congelado se muestra tal cual se selló: texto plano, sin
             reinterpretarlo. Cualquier reformateo cambiaría lo que se firma. */
          <pre className="doc-congelado">{documento}</pre>
        )}

        {!cerrado && (
          <div className="doc-panel-firma doc-no-print">
            <h2 className="doc-panel-titulo">{t('arrendadores.publica.firmar-titulo')}</h2>
            {nombreEsperado && (
              <p className="doc-panel-nota">
                {interpolarNodos(t('arrendadores.publica.enviado-a'), { nombre: <b>{nombreEsperado}</b> })}
              </p>
            )}

            <label className="doc-campo">
              <span>{t('arrendadores.publica.nombre')}</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={t('arrendadores.publica.nombre-ph')}
                autoComplete="name"
                className="doc-input"
              />
            </label>

            <label className="doc-check">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>
                {t('arrendadores.publica.acepto')}
              </span>
            </label>

            {error && <p className="doc-panel-error">{error}</p>}

            <button type="button" onClick={firmar} disabled={!puedeFirmar} className="doc-btn">
              <PenLine className="h-3.5 w-3.5" />
              {enviando ? t('arrendadores.firmas.firmando') : t('arrendadores.publica.firmar')}
            </button>

            <p className="doc-panel-nota">
              {t('arrendadores.publica.nota')}
            </p>
          </div>
        )}
      </article>
    </div>
  )
}
