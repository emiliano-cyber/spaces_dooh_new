import { AppError } from './errores'
import { IDIOMA_POR_OMISION, esIdiomaEnLaBase, type IdiomaEnLaBase } from '@/lib/i18n/idiomas'

// ─── ADR 0049 · el idioma de los DOCUMENTOS se elige AL NACER ───────────────
//
// Copia exacta del patron de la moneda (`moneda-alta.ts`, ADR 0048). El idioma
// en que se redactan el contrato y la constancia de firmas es de la INSTANCIA:
// lo elige quien crea la PRIMERA organizacion (`POST /api/bootstrap`, campo
// `idiomaDocumentos`); sin valor, `es`. Las que nacen despues lo HEREDAN, y si
// alguien pide otro se le dice que no en vez de ignorarlo.
//
// La base lo vuelve a impedir (`20261103_idioma_documentos_por_instancia.sql`,
// trigger `tenants_idioma_documentos_unico`); esto es la capa que da el
// mensaje legible.
//
// No es el idioma de la INTERFAZ: ese es de cada persona (cookie, navegador,
// preferencia), y no pasa por aqui.

// Ola 0 del portugues (05/11): contra `IDIOMAS_EN_LA_BASE` y no contra
// `IDIOMAS`. El portugues ya es un idioma de la interfaz, pero
// `tenants.idioma_documentos` tiene un CHECK es/en/it: un `pt` aceptado aqui
// llegaria al INSERT y saldria como 500. Los papeles en portugues (y abrir el
// CHECK, y `--idioma pt`) son una tarea ROJA aparte.
const esIdiomaDocumentos = esIdiomaEnLaBase

/** Valida lo que llega en el cuerpo. `undefined` = no se pidio ninguno. */
export function idiomaDocumentosPedido(valor: unknown): IdiomaEnLaBase | undefined {
  if (valor === undefined) return undefined
  if (!esIdiomaDocumentos(valor)) throw new AppError('El idioma de los documentos debe ser es, en o it', 400)
  return valor
}

/**
 * El idioma de documentos con el que nace la organizacion.
 *
 * @param pedido        el del cuerpo, ya validado (`undefined` = ninguno)
 * @param deLaInstancia el de las organizaciones que ya hay (`null` = ninguna)
 */
export function resolverIdiomaDocumentosDeAlta(
  pedido: IdiomaEnLaBase | undefined,
  deLaInstancia: string | null,
): IdiomaEnLaBase {
  // El espanol siempre cabe en la base.
  if (deLaInstancia === null) return pedido ?? (IDIOMA_POR_OMISION as IdiomaEnLaBase)
  if (!esIdiomaDocumentos(deLaInstancia)) {
    throw new Error(`La instancia tiene un idioma de documentos no soportado: ${deLaInstancia}`)
  }
  if (pedido !== undefined && pedido !== deLaInstancia) {
    throw new AppError(
      'El idioma de los documentos de la instancia ya está fijado: una organización nueva nace en el mismo que las demás',
      400,
    )
  }
  return deLaInstancia
}
