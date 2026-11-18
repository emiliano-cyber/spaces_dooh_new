import { firmaPorToken } from '@/lib/server/firmas-repo'
import { FirmaPublica } from '@/components/demo/arrendadores/FirmaPublica'
import { traducir } from '@/lib/i18n/diccionario'
import { idiomaDeLaPeticion } from '@/lib/i18n/servidor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Página PÚBLICA de firma. El arrendador no tiene cuenta en la plataforma: llega
// por un enlace con token y solo ve el documento que le toca firmar.
export default async function FirmarPage({ params }: { params: { token: string } }) {
  const f = await firmaPorToken(params.token)
  // I18N (2026-11-02) · el aviso va en el idioma de la peticion (quien abre el
  // enlace no tiene cuenta). El documento que firma sigue en espanol.
  const idioma = idiomaDeLaPeticion()

  if (!f) {
    return (
      <div className="doc-wrap">
        <div className="doc-hoja doc-aviso-caja">
          <h1 className="doc-titulo">{traducir(idioma, 'arrendadores.publica.no-valido')}</h1>
          <p className="doc-p">
            {traducir(idioma, 'arrendadores.publica.no-valido-texto')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <FirmaPublica
      token={params.token}
      documento={f.documento}
      nombreEsperado={f.nombreEsperado}
      expirado={f.expirado}
      yaFirmada={f.yaFirmada}
      logoUrl={f.logoUrl}
    />
  )
}
