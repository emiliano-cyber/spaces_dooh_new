import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { esEmailValido } from '@/lib/validacion'
import { crearCliente, actualizarCliente, type ClienteInput } from './clientes-repo'

// ============================================================================
//  lib/server/clientes-controller.ts — Capa controller de clientes.
//  Valida datos fiscales (RFC, CP, IVA, comisión) y de contacto antes de tocar
//  el model. La ruta queda delgada (auth + bitácora + mapeo de error).
// ============================================================================

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i

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

// Reglas de formato fiscal que zod deja pasar como texto (solo si vienen).
function validarFiscales(d: { rfc?: string | null; cpFiscal?: string | null; contacto?: { email?: string } | null }) {
  if (d.rfc && !RFC_RE.test(d.rfc)) throw new AppError('RFC inválido', 400)
  if (d.cpFiscal && !/^\d{5}$/.test(d.cpFiscal)) throw new AppError('Código postal fiscal inválido (5 dígitos)', 400)
  if (d.contacto?.email && !esEmailValido(d.contacto.email)) throw new AppError('Correo de contacto inválido', 400)
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
