import { firmaPorToken } from '@/lib/server/firmas-repo'
import { FirmaPublica } from '@/components/demo/arrendadores/FirmaPublica'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Página PÚBLICA de firma. El arrendador no tiene cuenta en la plataforma: llega
// por un enlace con token y solo ve el documento que le toca firmar.
export default async function FirmarPage({ params }: { params: { token: string } }) {
  const f = await firmaPorToken(params.token)

  if (!f) {
    return (
      <div className="doc-wrap">
        <div className="doc-hoja doc-aviso-caja">
          <h1 className="doc-titulo">Enlace no válido</h1>
          <p className="doc-p">
            Este enlace de firma no existe o fue reemplazado por uno nuevo. Pide al
            remitente que te envíe el enlace vigente.
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
    />
  )
}
