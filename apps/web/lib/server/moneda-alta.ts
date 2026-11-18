import { AppError } from './errores'
import { esMoneda, MONEDA_POR_OMISION, type Moneda } from '@/lib/i18n/dinero'

// ─── ADR 0048 · la moneda se elige AL NACER, y solo la primera organizacion ──
//
// La moneda es de la INSTANCIA. La elige quien crea la PRIMERA organizacion
// (`POST /api/bootstrap`, campo `moneda`); sin valor, MXN. Las que nacen
// despues en la misma instancia (`/api/tenants`, `/api/signup`) HEREDAN la de
// la instancia, y si alguien pide otra se le dice que no en vez de ignorarlo:
// ignorarlo dejaria al operador creyendo que creo una organizacion en dolares.
//
// La base lo vuelve a impedir (`20261102_moneda_inmutable_por_instancia.sql`,
// trigger `tenants_moneda_unica`); esto es la capa que da el mensaje legible.
//
// Se valida a mano y no con `z.enum` para que el mensaje sea un literal de
// `AppError` y lo vea el catalogo de `errores-servidor.ts`.

/** Valida lo que llega en el cuerpo. `undefined` = no se pidio ninguna. */
export function monedaPedida(valor: unknown): Moneda | undefined {
  if (valor === undefined) return undefined
  if (!esMoneda(valor)) throw new AppError('La moneda debe ser MXN o USD', 400)
  return valor
}

/**
 * La moneda con la que nace la organizacion.
 *
 * @param pedida        la del cuerpo, ya validada (`undefined` = ninguna)
 * @param deLaInstancia la de las organizaciones que ya hay (`null` = ninguna)
 */
export function resolverMonedaDeAlta(pedida: Moneda | undefined, deLaInstancia: string | null): Moneda {
  if (deLaInstancia === null) return pedida ?? MONEDA_POR_OMISION
  if (!esMoneda(deLaInstancia)) throw new Error(`La instancia tiene una moneda no soportada: ${deLaInstancia}`)
  if (pedida !== undefined && pedida !== deLaInstancia) {
    throw new AppError('La moneda de la instancia ya está fijada: una organización nueva nace en la misma que las demás', 400)
  }
  return deLaInstancia
}
