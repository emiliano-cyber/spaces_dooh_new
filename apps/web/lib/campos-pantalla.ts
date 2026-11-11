// ============================================================================
//  lib/campos-pantalla.ts — qué campos del alta de pantalla oculta ESTA
//  instancia. Decidido por el dueño el 2026-11-11.
// ----------------------------------------------------------------------------
//  «Todo, pero opcional en el aspecto de que los quite de su propio menú
//  porque no los ocupa — solo en la instalación de la app en el droplet».
//
//  Así que no es «obligatorio sí/no»: un campo oculto DESAPARECE del
//  formulario «Nueva pantalla», y con él su obligatoriedad. Se elige al
//  instalar con `--ocultar-campos-pantalla` (provision-instancia.sh e
//  instalar-hijo.sh) y queda en `app.env` como `PANTALLA_CAMPOS_OCULTOS=`.
//  `update.sh` no reescribe `app.env`, así que una actualización no lo toca;
//  y como es del ENTORNO de cada servidor, no afecta a ninguna otra empresa.
//  No hay pantalla para cambiarlo: es editar `app.env` y recrear el contenedor.
//
//  El NOMBRE no está en la lista y no se puede ocultar: identifica la
//  pantalla en todas las demás pantallas de la aplicación, y el servidor lo
//  exige (`app/api/sitios/route.ts`, «Falta nombre»).
//
//  La lista es la MISMA que `CAMPOS_PANTALLA` de
//  `infra/scripts/entorno-instancia.sh`; una prueba lee ese archivo para que
//  no se separen. Si el alta aceptara un nombre que la aplicación no conoce,
//  la instancia nacería con el campo visible sin avisar a nadie.
// ============================================================================

export const CAMPOS_PANTALLA = [
  'arrendador', // arrendador, renta y la casilla «pantalla propia»
  'direccion',
  'exhibicion', // fija o digital
  'ubicacion', // latitud y longitud
  'tipo', // tipo de pantalla
  'estado', // estado comercial
  'resolucion',
  'caras',
  'modalidades',
  'slots', // duración del slot, total y disponibles
  'vision', // la pestaña Computer Vision / AdMobilize
  'tarifa',
  'precio-m2',
  'imagen',
  // Solo en el alta de Comercial (`AltaSitioDialog`):
  'distrito',
  'medidas', // ancho y alto
  'iluminado',
  'comercializacion', // tradicional o programática
  'network', // el switch «En la Network» al nacer
  'cms', // CMS y tipo de contenido de una digital
] as const

export type CampoPantalla = (typeof CAMPOS_PANTALLA)[number]

const CONOCIDOS = new Set<string>(CAMPOS_PANTALLA)

/**
 * Lee el valor de `PANTALLA_CAMPOS_OCULTOS` («ubicacion,imagen»). Tolera
 * espacios y mayúsculas; un nombre desconocido se IGNORA (no oculta nada) y lo
 * devuelve aparte para que el servidor lo avise en el log. Vacío = nada oculto,
 * que es como se comportaba la aplicación antes de existir esto.
 */
export function leerCamposOcultos(valor: string | undefined | null): {
  ocultos: CampoPantalla[]
  desconocidos: string[]
} {
  const ocultos: CampoPantalla[] = []
  const desconocidos: string[] = []
  for (const crudo of (valor ?? '').split(',')) {
    const c = crudo.trim().toLowerCase()
    if (!c) continue
    if (CONOCIDOS.has(c)) {
      if (!ocultos.includes(c as CampoPantalla)) ocultos.push(c as CampoPantalla)
    } else desconocidos.push(c)
  }
  return { ocultos, desconocidos }
}
