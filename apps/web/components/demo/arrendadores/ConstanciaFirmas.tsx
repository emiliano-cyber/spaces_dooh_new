import { AlertTriangle } from 'lucide-react'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { localeDe } from '@/lib/i18n/formato-idioma'

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

// ─── I18N · el idioma de los DOCUMENTOS de la instancia (ADR 0049, 03/11) ───
// Del 02/11 al 03/11 se pintaba en el idioma de la PETICION. La regla del dueño
// del 03/11 —«el idioma de papeles y contratos es fijo al crearse la app en
// cada server»— la vuelve un papel más: va en el idioma de la instancia, el
// mismo que el contrato que acompaña. La página `/contrato/[id]` le pasa
// `doc.idioma`. Consecuencia buscada: en una instancia en español, quien mira
// la aplicación en inglés imprime la constancia EN ESPAÑOL, igual que el
// contrato. NO entra en ningún hash ni se guarda como texto (lo que se sella es
// `documentoATexto(generarContrato(…))`), así que el cambio no toca firmas.
// El idioma llega como prop (`'es'` por omisión): es un Server Component.
const ETIQUETA: Record<FirmaConstancia['parte'], ClaveTexto> = {
  ARRENDADOR: 'arrendadores.constancia.parte.arrendador',
  ARRENDATARIO: 'arrendadores.constancia.parte.arrendatario',
}

// Se formatea en el servidor con zona explícita para que el PDF diga la misma
// hora que la pantalla de quien lo generó, y no la del huso del contenedor.
function fechaHora(iso: string | null, idioma: Idioma = 'es'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(localeDe(idioma), {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'America/Mexico_City',
  })
}

export function ConstanciaFirmas({
  estado,
  idioma = 'es',
}: {
  estado: {
    firmas: FirmaConstancia[]
    hashCongelado: string | null
    congeladoEn: string | null
  }
  idioma?: Idioma
}) {
  const t = (clave: ClaveTexto, valores?: Record<string, string | number>) => traducir(idioma, clave, valores)
  const firmadas = estado.firmas.filter((f) => f.estatus === 'FIRMADA')
  // Sin firmas no hay constancia que dar: el documento se imprime para firmarse
  // a mano y no debe llevar un apartado vacío que sugiera lo contrario.
  if (!firmadas.length) return null

  const algunaInvalidada = firmadas.some((f) => f.invalidada)

  return (
    <section className="doc-constancia">
      <h2 className="doc-constancia-titulo">{t('arrendadores.constancia.titulo')}</h2>

      {algunaInvalidada && (
        <p className="doc-constancia-alerta">
          <AlertTriangle className="inline h-3.5 w-3.5" /> {t('arrendadores.constancia.alerta')}
        </p>
      )}

      <p className="doc-constancia-intro">
        {t('arrendadores.constancia.intro', { fecha: fechaHora(estado.congeladoEn, idioma) })}
      </p>

      <table className="doc-constancia-tabla">
        <tbody>
          {firmadas.map((f) => (
            <tr key={f.parte}>
              <th>{t(ETIQUETA[f.parte])}</th>
              <td>
                <div>
                  <b>{f.nombreFirmante}</b>
                  {f.invalidada && (
                    <span className="doc-constancia-mal">{t('arrendadores.constancia.invalidada')}</span>
                  )}
                </div>
                <div>{t('arrendadores.constancia.fecha', { fecha: fechaHora(f.firmadoEn, idioma) })}</div>
                <div>{t('arrendadores.constancia.ip', { ip: f.ip ?? t('arrendadores.constancia.ip-no') })}</div>
                <div className="doc-constancia-ua">
                  {t('arrendadores.constancia.navegador', { navegador: f.userAgent ?? t('arrendadores.constancia.navegador-no') })}
                </div>
                <div className="doc-constancia-hash">
                  {t('arrendadores.constancia.sello', { hash: f.documentoHash ?? '—' })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="doc-constancia-nota">
        {t('arrendadores.constancia.nota')}
      </p>
    </section>
  )
}
