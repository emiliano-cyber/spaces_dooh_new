import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  esEmailValido,
  esTelefonoValido,
  esCpValido,
  TELEFONO_INVALIDO,
  CP_INVALIDO,
} from '@/lib/validacion'
import { esRfcValido } from '@/lib/rfc'
import { crearCliente, actualizarCliente, type ClienteInput } from './clientes-repo'

// ============================================================================
//  lib/server/clientes-controller.ts — Capa controller de clientes.
//  Valida datos fiscales (RFC, CP, IVA, comisión) y de contacto antes de tocar
//  el model. La ruta queda delgada (auth + bitácora + mapeo de error).
// ============================================================================

// `esRfcValido` vive en @/lib/rfc (compartido con el cliente); ver ese archivo.

// Tope del nombre. La auditoría del 2026-08-26 dio de alta un cliente con 5 000
// caracteres y respondió 201: el formulario limitaba el campo y el servidor se
// fiaba de él, pero el alta se hace igual por HTTP. Ese nombre se pinta en la
// tabla de Clientes, en las propuestas y en el CFDI, y los rompe los tres.
//
// 200 y no menos: las razones sociales mexicanas reales pasan de los 80
// caracteres con facilidad («… SOCIEDAD ANÓNIMA PROMOTORA DE INVERSIÓN DE
// CAPITAL VARIABLE»), y un tope que estorbe se acaba quitando entero.
const MAX_NOMBRE = 200

const clienteBase = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(MAX_NOMBRE),
  rfc: z.string().trim().max(13).nullish(),
  razonSocial: z.string().trim().nullish(),
  regimenFiscal: z.string().trim().nullish(),
  cpFiscal: z.string().trim().nullish(),
  usoCfdi: z.string().trim().nullish(),
  ivaPct: z.coerce.number().min(0).max(100).nullish(),
  comisionAgenciaPct: z.coerce.number().min(0).max(100).nullish(),
  agenciaId: z.string().nullish(),
  tieneNegociacion: z.boolean().nullish(),
  negociacionValidada: z.boolean().nullish(),
  negociacionNota: z.string().trim().nullish(),
  tipo: z.string().trim().optional(),
  // El correo suelto en la RAÍZ del cuerpo. No estaba declarado, y zod descarta
  // en silencio lo que no declara: `{nombre, email:'no-es-un-correo'}` respondía
  // 201 (lo que reportó la auditoría) y además el correo no se guardaba en
  // ninguna parte. Las dos mitades del mismo defecto — la peor era la segunda,
  // porque el alta salía «bien» y el dato no existía.
  //
  // Se declara como ALIAS de `contacto.email` en vez de rechazarlo: es la forma
  // en que ya llegan las llamadas de verdad (`csrf.e2e.test.ts:68` manda el
  // cuerpo exacto de la auditoría) y es como lo acepta el alta de arrendadores.
  email: z.string().trim().nullish(),
  contacto: z
    .object({
      nombre: z.string().trim().optional(),
      email: z.string().trim().optional(),
      telefono: z.string().trim().optional(),
    })
    .partial()
    .nullish(),
  // A5 / INC-07, ahora también en clientes: quien da el alta ya vio «se llama
  // igual que otro» y responde que es distinto. Por defecto `false`: omitirlo
  // NUNCA salta el aviso.
  confirmaNombreRepetido: z.boolean().optional(),
})

const crearSchema = clienteBase
const actualizarSchema = clienteBase.partial()

// Reglas de formato que zod deja pasar como texto (solo si vienen). El
// formulario comprueba lo mismo con los MISMOS helpers, pero la autoridad es
// ésta: un cliente con RFC o CP mal rompe la facturación (CFDI) mucho después,
// cuando ya nadie recuerda de dónde salió el dato.
function validarFiscales(d: {
  rfc?: string | null
  cpFiscal?: string | null
  email?: string | null
  contacto?: { email?: string; telefono?: string } | null
}) {
  if (d.rfc && !esRfcValido(d.rfc)) throw new AppError('RFC inválido', 400)
  if (d.cpFiscal && !esCpValido(d.cpFiscal)) throw new AppError(CP_INVALIDO, 400)
  if (d.email && !esEmailValido(d.email)) throw new AppError('Correo inválido', 400)
  if (d.contacto?.email && !esEmailValido(d.contacto.email)) throw new AppError('Correo de contacto inválido', 400)
  // M1: el teléfono no se validaba y entraba «abc123xyz» tal cual.
  if (d.contacto?.telefono && !esTelefonoValido(d.contacto.telefono)) {
    throw new AppError(TELEFONO_INVALIDO, 400)
  }
}

// Pliega el `email` de la raíz dentro del contacto, que es donde vive de verdad
// (la tabla guarda `contacto` como jsonb; no hay columna `email`). Gana el
// explícito: si vienen los dos, manda `contacto.email`.
//
// Devuelve el objeto SIN la clave `email` para que no viaje al model como un
// campo que ese model no conoce, y sin inventar un `contacto` vacío cuando no
// hay ningún correo.
function plegarCorreo<T extends { email?: string | null; contacto?: { email?: string } | null }>(d: T) {
  const { email, ...resto } = d
  if (!email || d.contacto?.email) return resto
  return { ...resto, contacto: { ...(d.contacto ?? {}), email } }
}

export async function crearClienteCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  validarFiscales(d)
  return crearCliente(plegarCorreo(d) as ClienteInput)
}

export async function actualizarClienteCtrl(id: string, body: unknown) {
  const d = validar(actualizarSchema, body)
  validarFiscales(d)
  const c = await actualizarCliente(id, plegarCorreo(d) as Partial<ClienteInput>)
  if (!c) throw new AppError('Cliente no encontrado', 404)
  return c
}
