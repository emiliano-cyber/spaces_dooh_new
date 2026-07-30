import { AlertTriangle } from 'lucide-react'

// ============================================================================
//  Constancia de firma electrónica. A diferencia de PanelFirmas (que es la
//  herramienta para firmar y va marcada `doc-no-print`), esto SÍ se imprime: es
//  lo que convierte el PDF en un documento probatorio.
//
//  Se imprime el expediente completo —quién, cuándo, desde dónde y sobre qué
//  hash— porque un PDF que dijera solo "firmado" no permitiría demostrar nada
//  después. Y si una firma quedó invalidada, sale marcado EN GRANDE: un papel
//  que presente como firmado un texto que ya cambió sería peor que no tener nada.
// ============================================================================

export interface FirmaConstancia {
  parte: 'ARRENDADOR' | 'ARRENDATARIO'
  estatus: 'PENDIENTE' | 'FIRMADA' | 'CANCELADA'
  nombreFirmante: string | null
  firmadoEn: string | null
  ip: string | null
  userAgent: string | null
  documentoHash: string | null
  invalidada: boolean
}

const ETIQUETA: Record<FirmaConstancia['parte'], string> = {
  ARRENDADOR: 'EL ARRENDADOR',
  ARRENDATARIO: 'EL ARRENDATARIO',
}

// Se formatea en el servidor con zona explícita para que el PDF diga la misma
// hora que la pantalla de quien lo generó, y no la del huso del contenedor.
function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'America/Mexico_City',
  })
}

export function ConstanciaFirmas({
  estado,
}: {
  estado: {
    firmas: FirmaConstancia[]
    hashCongelado: string | null
    congeladoEn: string | null
  }
}) {
  const firmadas = estado.firmas.filter((f) => f.estatus === 'FIRMADA')
  // Sin firmas no hay constancia que dar: el documento se imprime para firmarse
  // a mano y no debe llevar un apartado vacío que sugiera lo contrario.
  if (!firmadas.length) return null

  const algunaInvalidada = firmadas.some((f) => f.invalidada)

  return (
    <section className="doc-constancia">
      <h2 className="doc-constancia-titulo">Constancia de firma electrónica</h2>

      {algunaInvalidada && (
        <p className="doc-constancia-alerta">
          <AlertTriangle className="inline h-3.5 w-3.5" /> ATENCIÓN: el contrato fue
          modificado después de firmarse. Las firmas marcadas abajo no corresponden al
          texto de este documento y no deben tenerse por válidas.
        </p>
      )}

      <p className="doc-constancia-intro">
        Este documento fue sellado el {fechaHora(estado.congeladoEn)} y firmado
        electrónicamente por las partes que se indican. El sello SHA-256 permite
        verificar que el texto no ha sido alterado desde su firma.
      </p>

      <table className="doc-constancia-tabla">
        <tbody>
          {firmadas.map((f) => (
            <tr key={f.parte}>
              <th>{ETIQUETA[f.parte]}</th>
              <td>
                <div>
                  <b>{f.nombreFirmante}</b>
                  {f.invalidada && (
                    <span className="doc-constancia-mal"> — FIRMA INVALIDADA</span>
                  )}
                </div>
                <div>Fecha y hora: {fechaHora(f.firmadoEn)}</div>
                <div>Dirección IP: {f.ip ?? 'no registrada'}</div>
                <div className="doc-constancia-ua">
                  Navegador: {f.userAgent ?? 'no registrado'}
                </div>
                <div className="doc-constancia-hash">
                  Sello del documento firmado: {f.documentoHash ?? '—'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="doc-constancia-nota">
        Firma electrónica simple. La dirección IP y el navegador son datos que aporta el
        propio equipo del firmante y se conservan como indicios; no constituyen por sí
        solos prueba de identidad. Esta constancia no incluye certificado de e.firma del
        SAT ni constancia de conservación NOM-151.
      </p>
    </section>
  )
}
