// ============================================================================
//  BandaLicencia — la aplicacion AVISA. No bloquea, y no comprueba nada.
// ----------------------------------------------------------------------------
//  Quien apaga es `update.sh`, con `openssl`, FUERA del contenedor. Duplicar la
//  criptografia aqui no compraria nada: esta aplicacion corre en la maquina del
//  cliente y el tiene root, asi que su veredicto nunca seria de fiar.
//
//  Presentador tonto: recibe el objeto que ya decidio `avisoDeLicencia` (o
//  `null`) y solo lo pinta. La decision de que se muestra vive en
//  `lib/licencia.ts`, que si tiene prueba -- este `.tsx` no la tiene porque el
//  repo no trae jsdom ni testing-library (ver `vitest.config.ts`).
// ============================================================================

export function BandaLicencia({
  aviso,
}: {
  aviso: { tono: 'aviso' | 'gracia'; vence: string; finGracia: string } | null
}) {
  if (aviso === null) return null

  const enGracia = aviso.tono === 'gracia'
  return (
    <div
      role="status"
      className={
        enGracia
          ? 'flex flex-wrap items-center gap-x-2 bg-rose-600 px-4 py-2 text-sm font-medium text-white'
          : 'flex flex-wrap items-center gap-x-2 bg-amber-100 px-4 py-2 text-sm text-amber-900'
      }
    >
      {enGracia ? (
        <span>
          Tu licencia de SPACE OS venció el {aviso.vence}. El sistema dejará de funcionar el{' '}
          {aviso.finGracia}.
        </span>
      ) : (
        <span>Tu licencia de SPACE OS vence el {aviso.vence}.</span>
      )}
      <span>Para renovarla, contacta con tu proveedor.</span>
    </div>
  )
}
