import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  actualizarSitio,
  actualizarModalidades,
  borrarSitio,
  toggleNetwork,
  getSitio,
  importarSitios,
} from './sitios-repo'
import { LIMITES, uploadZod } from './uploads'
import { motivoModalidadInvalida, normalizar } from '@/lib/modalidades'

// ============================================================================
//  lib/server/sitios-controller.ts — Edición, borrado e importación de pantallas.
//  El model whitelistea columnas (CAMPO_COL) y usa SQL parametrizado; aquí se
//  valida la forma de la entrada y se mapean errores de FK/negocio a HTTP.
// ============================================================================

const updateSchema = z.record(z.string(), z.unknown())

// ADR 0008 · cupo de clientes. Entra por el mismo PATCH genérico que el resto
// del inventario, pero no es un dato cualquiera: decide si una venta se puede
// cerrar. Se valida aquí en vez de dejarlo caer crudo a la columna — un texto
// reventaría en el driver con un 22P02 sin mensaje útil, y un 0 dejaría la
// pantalla muerta (para eso está estatus_comercial='BLOQUEADO').
// Vacío o null = quitar el cupo (vuelve al default global).
const cupoSchema = z.object({
  maxClientes: z.union([
    z.null(),
    z.literal(''),
    z.coerce
      .number()
      .int('El cupo de clientes debe ser un número entero')
      .min(1, 'El cupo de clientes debe ser al menos 1')
      .max(999, 'El cupo de clientes no puede pasar de 999'),
  ]),
})

// Las modalidades NO entran por el PATCH general, y rechazarlas es parte del
// arreglo del 2026-09-28. Explicación larga en
// `app/api/sitios/[id]/modalidades/route.ts`; lo corto: una modalidad es una
// TARIFA, el PATCH general decide el candado con una lista blanca de campos
// (`CAMPOS_SENSIBLES`), y colar el dinero por un campo que no está en la lista
// es cambiar el precio de una pantalla sin contraseña.
//
// Se RECHAZA en vez de ignorarse. `actualizarSitio` ya se lo saltaría —no está
// en `CAMPO_COL`—, pero un 200 con la tarifa intacta es el «mentir en vez de
// callarse» que costó el arreglo de B38: la pantalla cantaría «guardado» y no
// habría guardado nada.
const MENSAJE_MODALIDADES_FUERA =
  'Las tarifas por unidad se guardan en su propia ruta (PATCH /api/sitios/:id/modalidades), que siempre pide la contraseña.'

export async function actualizarSitioCtrl(id: string, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if ('modalidadesDetalle' in b || 'modalidades' in b) {
    throw new AppError(MENSAJE_MODALIDADES_FUERA, 400)
  }
  if (b.toggleNetwork) {
    const s = await toggleNetwork(id)
    if (!s) throw new AppError('No encontrado', 404)
    return { sitio: s, toggled: true }
  }
  const d = validar(updateSchema, b)
  if ('maxClientes' in d) {
    const { maxClientes } = validar(cupoSchema, { maxClientes: d.maxClientes })
    d.maxClientes = maxClientes === '' ? null : maxClientes
  }
  const s = await actualizarSitio(id, d)
  if (!s) throw new AppError('No encontrado', 404)
  return { sitio: s, toggled: false }
}

// ─── Tarifas por unidad de venta (sitio_modalidades) ────────────────────────
//
// `tarifaPublicada` obligatoria y sin default: es el dato que da sentido a la
// unidad. Una modalidad sin precio no dice «gratis», dice que alguien la creó a
// medias — y como `spotsDisponibles` y el cotizador la leerían igual, la
// pantalla se ofrecería en una unidad sin tarifa.
//
// El CERO sí entra, a propósito y al revés que `rentaValida`: allí un 0 se lee
// como «el espacio es gratis» y rompe el P&L; aquí una unidad de cortesía —un
// spot de bonificación— es una decisión comercial legítima que alguien teclea a
// conciencia. La diferencia es que la renta la puede dejar en blanco un archivo
// y esto lo escribe una persona en un formulario.
const modalidadSchema = z.object({
  unidad: z.string().trim().min(1, 'Elige la unidad de venta'),
  tarifaPublicada: z.coerce
    .number({ invalid_type_error: 'La tarifa tiene que ser un número' })
    .finite('La tarifa tiene que ser un número')
    .nonnegative('La tarifa no puede ser negativa'),
  // Espejo de `costo_compra` (ADR 0006): no se captura, se conserva en cero para
  // no dejar NULL donde la columna es `not null`.
  costoCompra: z.coerce.number().finite().nonnegative().default(0),
})

const modalidadesSchema = z.object({
  guardar: z.array(modalidadSchema).default([]),
  quitar: z.array(z.string().trim().min(1)).default([]),
})

export async function actualizarModalidadesCtrl(id: string, body: unknown) {
  const d = validar(modalidadesSchema, (body ?? {}) as Record<string, unknown>)
  // Los `.default()` de zod son opcionales en la ENTRADA, así que el tipo que
  // devuelve `validar` los trae como `| undefined`. Se normalizan aquí, una vez,
  // en vez de sembrar `?? []` por todo el cuerpo.
  const guardar = (d.guardar ?? []).map((m) => ({
    unidad: normalizar(m.unidad),
    tarifaPublicada: m.tarifaPublicada,
    costoCompra: m.costoCompra ?? 0,
  }))
  const quitar = (d.quitar ?? []).map(normalizar)

  // Lo mismo dos veces en la misma petición. La base NO lo vería: el camino es
  // `on conflict do update`, así que la segunda pisaría a la primera SIN error y
  // quedaría un precio que nadie eligió. Lo mismo con `quitar`, que además
  // sugiere que quien lo mandó cree que quitó dos cosas.
  const repetida = (lista: string[]) => lista.find((u, i) => lista.indexOf(u) !== i)
  const dupGuardar = repetida(guardar.map((m) => m.unidad))
  if (dupGuardar) throw new AppError(`La unidad "${dupGuardar}" viene repetida.`, 400)
  const dupQuitar = repetida(quitar)
  if (dupQuitar) throw new AppError(`La unidad "${dupQuitar}" viene repetida.`, 400)
  const enAmbas = guardar.find((m) => quitar.includes(m.unidad))
  if (enAmbas) {
    throw new AppError(
      `La unidad "${enAmbas.unidad}" se manda a guardar y a quitar a la vez: decide una.`,
      400,
    )
  }

  // La EXHIBICIÓN se lee de la base, nunca del cuerpo. Si se tomara de la
  // petición, la regla de la pantalla fija se saltaría con una línea de `curl`
  // mandando `exhibicion: 'digital'` — que es justo el modo de fallo que
  // `clientes-controller` documenta: la UI valida y el servidor se fía de ella.
  const sitio = await getSitio(id)
  if (!sitio) throw new AppError('No encontrado', 404)

  for (const unidad of [...guardar.map((m) => m.unidad), ...quitar]) {
    const motivo = motivoModalidadInvalida(unidad, sitio.exhibicion)
    if (motivo) throw new AppError(motivo, 400)
  }

  // Sin nada que hacer no se escribe ni se registra una acción: el usuario
  // abrió el cuadro y lo cerró sin tocar nada.
  if (!guardar.length && !quitar.length) {
    return { sitio, guardadas: 0, quitadas: 0 }
  }

  const actualizado = await actualizarModalidades(id, { guardar, quitar })
  if (!actualizado) throw new AppError('No encontrado', 404)
  return { sitio: actualizado, guardadas: guardar.length, quitadas: quitar.length }
}

export async function borrarSitioCtrl(id: string) {
  const previo = await getSitio(id)
  try {
    await borrarSitio(id)
  } catch (e) {
    // 23503 = FK: la pantalla tiene reservas / OT / impresión asociadas.
    if ((e as { code?: string })?.code === '23503') {
      throw new AppError('No se puede eliminar: la pantalla tiene reservas u órdenes asociadas.', 409)
    }
    throw e
  }
  return previo?.nombre ?? id
}

const importSchema = z.object({
  filas: z.array(z.any()).min(1, 'No hay filas para importar'),
  // ADR 0002: toda pantalla nace con propietario conocido. La pertenencia al
  // tenant se comprueba contra la BD en importarSitios(); aquí solo la forma.
  arrendadorId: z
    .string()
    .uuid('Elige el arrendador de las pantallas antes de importar.'),
  // OPCIONAL: marca que todas las pantallas del archivo están en el mismo predio.
  // Uno existente ({id}) o uno nuevo a crear ({nombre, direccion}). Sin esto, las
  // pantallas entran sueltas. La pertenencia del predio al arrendador se
  // comprueba contra la BD en resolverPredio().
  predio: z
    .union([
      z.object({ id: z.string().uuid('Predio inválido') }),
      z.object({
        nombre: z.string().trim().min(1, 'El predio nuevo necesita un nombre.'),
        direccion: z.string().nullish(),
      }),
    ])
    .nullish(),
  modoDuplicado: z.enum(['ACTUALIZAR', 'NUEVA_VERSION']).default('ACTUALIZAR'),
  precioM2: z.coerce.number().nonnegative().nullish(),
  // Fotos de pantallas del import masivo: clave = código de proveedor, valor =
  // data URL. Cada una se valida por separado (8 MB, imagen real) — Bloque D.
  // Antes era z.any(): entraba cualquier cosa, de cualquier peso, en lote.
  imagenes: z
    .record(z.string(), uploadZod(LIMITES.fotoSitio.allowlist, LIMITES.fotoSitio.maxMB))
    .nullish(),
})

export async function importarSitiosCtrl(body: unknown) {
  const d = validar(importSchema, body ?? {})
  return importarSitios({
    filas: d.filas,
    arrendadorId: d.arrendadorId,
    predio: d.predio ?? null,
    modoDuplicado: d.modoDuplicado ?? 'ACTUALIZAR',
    precioM2: d.precioM2 ?? null,
    imagenes: d.imagenes && typeof d.imagenes === 'object' ? (d.imagenes as Record<string, string>) : undefined,
  })
}
