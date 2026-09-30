import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { tienePermiso, type UsuarioSesion } from './auth'
import { crearCliente } from './clientes-repo'
import { crearArrendador, crearPredio } from './arrendadores-repo'
import {
  listarProspectos,
  obtenerProspecto,
  crearProspecto,
  editarProspecto,
  registrarAvance,
  rechazarProspecto,
  reclamarAprobacion,
  devolverARevision,
  fijarRegistro,
  type ProspectoInput,
  type ProspectoReclamado,
} from './captacion-repo'
import { ETAPAS, TIPOS_PROSPECTO, type TipoProspecto } from '@/lib/captacion'

// ============================================================================
//  lib/server/captacion-controller.ts — La forma de entrada de la bitácora de
//  captación, y quién ve qué.  CAP-01.
// ----------------------------------------------------------------------------
//  ⚠️ NINGÚN ESQUEMA ACEPTA `usuarioId`, `etapa`, `decididoPor` NI `registroId`.
//
//  Los cuatro son la parte de un prospecto que NO decide quien lo manda:
//   · el vendedor sale de la sesión — si viniera en el cuerpo, cualquiera
//     podría dar de alta o reasignar prospectos a nombre de otro;
//   · la etapa solo cambia por un AVANCE, que pasa por la regla de
//     `lib/captacion.ts` con la fila bloqueada;
//   · la decisión y el registro solo los pone la ruta de aprobar.
//  Los esquemas son `.strict()`: un campo que no está declarado es un 400, no
//  un campo que se ignora en silencio y alguien cree haber guardado.
//
//  ─── QUIÉN VE TODO ────────────────────────────────────────────────────────
//  Lo decide `captacion.aprobar`, NO el nombre del rol: quien puede aprobar ve
//  los prospectos de toda la organización; quien no, solo los suyos. Así la
//  matriz de Administración sigue siendo la única que manda.
// ============================================================================

const texto = (max: number) => z.string().trim().max(max)
const opcional = (max: number) =>
  texto(max)
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v))
const numero = z.coerce.number().finite().min(0).max(1_000_000_000).nullish()

const contactoSchema = z
  .object({
    nombre: opcional(200),
    telefono: opcional(40),
    email: z
      .string()
      .trim()
      .max(200)
      .email('El correo no parece válido')
      .or(z.literal(''))
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .strict()

// Lo propio de cada tipo. Todo opcional mientras se trabaja; lo que hace falta
// para revisar lo dice `faltantesParaRevision`.
const DATOS: Record<TipoProspecto, z.ZodTypeAny> = {
  CLIENTE: z
    .object({ rfc: opcional(20), razonSocial: opcional(200), giro: opcional(120), presupuesto: numero, notas: opcional(2000) })
    .strict(),
  ARRENDADOR: z.object({ rfc: opcional(20), notas: opcional(2000) }).strict(),
  PREDIO: z
    .object({
      arrendadorId: z.string().uuid('El arrendador no es válido').nullish(),
      tipoUbicacion: opcional(120),
      m2: numero,
      rentaPedida: numero,
      notas: opcional(2000),
    })
    .strict(),
  PANTALLA: z
    .object({
      tipoPantalla: z.enum(['DIGITAL', 'ESTATICA']).nullish(),
      anchoM: numero,
      altoM: numero,
      caras: z.coerce.number().int().min(1).max(8).nullish(),
      rentaPedida: numero,
      notas: opcional(2000),
    })
    .strict(),
}

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD')
  .or(z.literal(''))
  .nullish()
  .transform((v) => (v ? v : null))

const baseSchema = z
  .object({
    tipo: z.enum(TIPOS_PROSPECTO),
    nombre: z.string().trim().min(1, 'Ponle un nombre').max(200),
    contacto: contactoSchema.default({}),
    direccion: opcional(400),
    lat: z.coerce.number().min(-90).max(90).nullish(),
    lng: z.coerce.number().min(-180).max(180).nullish(),
    datos: z.record(z.unknown()).default({}),
    siguientePaso: opcional(300),
    siguientePasoFecha: fecha,
    nota: opcional(2000),
  })
  .strict()

function aInput(body: unknown, tipoFijo?: TipoProspecto): ProspectoInput & { nota: string | null } {
  const d = validar(baseSchema, body) as z.output<typeof baseSchema>
  // En la edición el tipo NO cambia: se valida contra el que ya tiene.
  const tipo = tipoFijo ?? d.tipo
  const datos = validar(DATOS[tipo], d.datos) as Record<string, unknown>
  return {
    tipo,
    nombre: d.nombre,
    contacto: d.contacto,
    direccion: d.direccion,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    datos,
    siguientePaso: d.siguientePaso,
    siguientePasoFecha: d.siguientePasoFecha,
    nota: d.nota,
  }
}

/** Solo lo suyo, si no puede aprobar. */
async function soloDe(u: UsuarioSesion): Promise<string | null> {
  return (await tienePermiso(u.rol, 'captacion', 'aprobar')) ? null : u.id
}

const NO_EXISTE = 'Ese prospecto no existe'

const filtroSchema = z.object({
  // Lista separada por comas: una pestaña agrupa varias etapas.
  etapas: z.array(z.enum(ETAPAS)).max(ETAPAS.length).nullish(),
  tipo: z.enum(TIPOS_PROSPECTO).nullish(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(50),
})

export async function listarProspectosCtrl(u: UsuarioSesion, params: URLSearchParams) {
  const f = validar<z.output<typeof filtroSchema>>(filtroSchema as never, {
    etapas: params.get('etapas') ? params.get('etapas')!.split(',') : null,
    tipo: params.get('tipo') || null,
    pagina: params.get('pagina') ?? undefined,
    porPagina: params.get('porPagina') ?? undefined,
  })
  const solo = await soloDe(u)
  const r = await listarProspectos({
    soloDe: solo,
    etapas: f.etapas ?? null,
    tipo: f.tipo ?? null,
    limite: f.porPagina,
    desplazamiento: (f.pagina - 1) * f.porPagina,
  })
  return { ...r, pagina: f.pagina, porPagina: f.porPagina, puedeAprobar: solo === null }
}

export async function obtenerProspectoCtrl(u: UsuarioSesion, id: string) {
  const p = await obtenerProspecto(id, await soloDe(u))
  if (!p) throw new AppError(NO_EXISTE, 404)
  return p
}

export async function crearProspectoCtrl(u: UsuarioSesion, body: unknown) {
  const d = aInput(body)
  const id = await crearProspecto(d, u.id, d.nota ?? 'Alta del prospecto')
  return obtenerProspectoCtrl(u, id)
}

export async function editarProspectoCtrl(u: UsuarioSesion, id: string, body: unknown) {
  const solo = await soloDe(u)
  const actual = await obtenerProspecto(id, solo)
  if (!actual) throw new AppError(NO_EXISTE, 404)
  const d = aInput(body, actual.tipo)
  const ok = await editarProspecto(id, d, solo)
  if (!ok) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

const avanceSchema = z
  .object({
    etapa: z.enum(ETAPAS),
    nota: z.string().trim().min(1, 'Escribe qué pasó').max(2000),
    siguientePaso: opcional(300).optional(),
    siguientePasoFecha: fecha.optional(),
  })
  .strict()

export async function registrarAvanceCtrl(u: UsuarioSesion, id: string, body: unknown) {
  const d = validar(avanceSchema, body)
  const ok = await registrarAvance(
    id,
    { etapaNueva: d.etapa, nota: d.nota, siguientePaso: d.siguientePaso, siguientePasoFecha: d.siguientePasoFecha },
    u.id,
    await soloDe(u),
  )
  if (!ok) throw new AppError(NO_EXISTE, 404)
  return obtenerProspectoCtrl(u, id)
}

const decisionSchema = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('APROBAR'),
      // El alta del cliente o arrendador ya avisó de que hay otro que se llama
      // igual, y quien aprueba confirma que es distinto.
      confirmaNombreRepetido: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      decision: z.literal('RECHAZAR'),
      motivo: z.string().trim().min(3, 'Di por qué se rechaza: el vendedor lo va a leer').max(1000),
    })
    .strict(),
])

const cadena = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Crea el registro real de un prospecto aprobado. Devuelve su id (null en una
 * PANTALLA: en esta versión la da de alta quien administra, desde Inventario,
 * porque una pantalla necesita medidas, tarifas y contrato que la captación no
 * tiene) y la línea que se escribe en la bitácora.
 */
async function crearRegistro(
  p: ProspectoReclamado,
  confirma: boolean,
): Promise<{ registroId: string | null; nota: string }> {
  const c = p.contacto ?? {}
  const d = p.datos ?? {}
  if (p.tipo === 'CLIENTE') {
    const cli = await crearCliente({
      nombre: p.nombre,
      rfc: cadena(d.rfc),
      razonSocial: cadena(d.razonSocial),
      contacto: {
        nombre: cadena(c.nombre) ?? undefined,
        email: cadena(c.email) ?? undefined,
        telefono: cadena(c.telefono) ?? undefined,
      },
      confirmaNombreRepetido: confirma,
    })
    return { registroId: String(cli.id), nota: `Aprobado: se dio de alta el cliente «${p.nombre}»` }
  }
  if (p.tipo === 'ARRENDADOR') {
    const arr = await crearArrendador({
      nombre: p.nombre,
      rfc: cadena(d.rfc),
      telefono: cadena(c.telefono),
      email: cadena(c.email),
      direccion: p.direccion,
      notas: cadena(d.notas),
      confirmaNombreRepetido: confirma,
    })
    return { registroId: String(arr.id), nota: `Aprobado: se dio de alta el arrendador «${p.nombre}»` }
  }
  if (p.tipo === 'PREDIO') {
    let arrendadorId = cadena(d.arrendadorId)
    let nota = `Aprobado: se dio de alta el predio «${p.nombre}»`
    if (!arrendadorId) {
      // El contacto ES el dueño del terreno: se da de alta como arrendador.
      const arr = await crearArrendador({
        nombre: cadena(c.nombre) ?? p.nombre,
        telefono: cadena(c.telefono),
        email: cadena(c.email),
        confirmaNombreRepetido: confirma,
      })
      arrendadorId = String(arr.id)
      nota += ` y su arrendador «${arr.nombre}»`
    }
    const predio = await crearPredio({
      arrendadorId,
      nombre: p.nombre,
      direccion: p.direccion,
      lat: p.lat,
      lng: p.lng,
      tipoUbicacion: cadena(d.tipoUbicacion),
    })
    if (!predio) throw new AppError('El arrendador de ese predio no existe en esta organización', 400)
    return { registroId: String(predio.id), nota }
  }
  return {
    registroId: null,
    nota: 'Aprobado: la pantalla queda lista para darla de alta en Inventario',
  }
}

export async function decidirProspectoCtrl(u: UsuarioSesion, id: string, body: unknown) {
  const d = validar(decisionSchema, body)
  if (d.decision === 'RECHAZAR') {
    const ok = await rechazarProspecto(id, d.motivo, u.id)
    if (!ok) throw new AppError(NO_EXISTE, 404)
    return obtenerProspectoCtrl(u, id)
  }
  const p = await reclamarAprobacion(id, u.id)
  if (!p) throw new AppError(NO_EXISTE, 404)
  let creado: { registroId: string | null; nota: string }
  try {
    creado = await crearRegistro(p, d.confirmaNombreRepetido === true)
  } catch (e) {
    // El registro no se creó: el prospecto vuelve a revisión y el error llega
    // entero. Un duplicado de cliente o arrendador es un 409 con la frase que
    // dice cuál — quien aprueba confirma y repite.
    await devolverARevision(id)
    throw e
  }
  await fijarRegistro(id, creado.registroId, creado.nota, u.id)
  return obtenerProspectoCtrl(u, id)
}
