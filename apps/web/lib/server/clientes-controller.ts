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
import { RFC_RE } from '@/lib/rfc'
import { crearCliente, actualizarCliente, type ClienteInput } from './clientes-repo'

// ============================================================================
//  lib/server/clientes-controller.ts — Capa controller de clientes.
//  Valida datos fiscales (RFC, CP, IVA, comisión) y de contacto antes de tocar
//  el model. La ruta queda delgada (auth + bitácora + mapeo de error).
// ============================================================================

// RFC_RE vive en @/lib/rfc (compartido con el cliente); ver ese archivo.

const clienteBase = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
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
  contacto: z
    .object({
      nombre: z.string().trim().optional(),
      email: z.string().trim().optional(),
      telefono: z.string().trim().optional(),
    })
    .partial()
    .nullish(),
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
  contacto?: { email?: string; telefono?: string } | null
}) {
  if (d.rfc && !RFC_RE.test(d.rfc)) throw new AppError('RFC inválido', 400)
  if (d.cpFiscal && !esCpValido(d.cpFiscal)) throw new AppError(CP_INVALIDO, 400)
  if (d.contacto?.email && !esEmailValido(d.contacto.email)) throw new AppError('Correo de contacto inválido', 400)
  // M1: el teléfono no se validaba y entraba «abc123xyz» tal cual.
  if (d.contacto?.telefono && !esTelefonoValido(d.contacto.telefono)) {
    throw new AppError(TELEFONO_INVALIDO, 400)
  }
}

export async function crearClienteCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  validarFiscales(d)
  return crearCliente(d as ClienteInput)
}

export async function actualizarClienteCtrl(id: string, body: unknown) {
  const d = validar(actualizarSchema, body)
  validarFiscales(d)
  const c = await actualizarCliente(id, d as Partial<ClienteInput>)
  if (!c) throw new AppError('Cliente no encontrado', 404)
  return c
}
