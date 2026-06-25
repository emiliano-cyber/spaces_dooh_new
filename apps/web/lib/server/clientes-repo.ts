import 'server-only'
import { q } from './db'

// ============================================================================
//  lib/server/clientes-repo.ts — CRUD de clientes con datos fiscales (RFC,
//  razón social, régimen, CP, uso CFDI). El listado vive en campanas-repo
//  (listarClientes); aquí van las altas/ediciones del módulo Clientes.
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

function rowToCliente(r: any) {
  return {
    id: r.id,
    nombre: r.nombre,
    rfc: r.rfc ?? null,
    razonSocial: r.razon_social ?? null,
    regimenFiscal: r.regimen_fiscal ?? null,
    cpFiscal: r.cp_fiscal ?? null,
    usoCfdi: r.uso_cfdi ?? null,
    ivaPct: r.iva_pct != null ? Number(r.iva_pct) : 16,
    comisionAgenciaPct: r.comision_agencia_pct != null ? Number(r.comision_agencia_pct) : 0,
    tipo: r.tipo,
    contacto: r.contacto ?? {},
    activo: !!r.activo,
    creadoEn: iso(r.creado_en),
  }
}

export interface ClienteInput {
  nombre: string
  rfc?: string | null
  razonSocial?: string | null
  regimenFiscal?: string | null
  cpFiscal?: string | null
  usoCfdi?: string | null
  ivaPct?: number | null
  comisionAgenciaPct?: number | null
  tipo?: string
  contacto?: { nombre?: string; email?: string; telefono?: string }
}

export async function crearCliente(input: ClienteInput) {
  const rows = await q(
    `insert into clientes (nombre, rfc, razon_social, regimen_fiscal, cp_fiscal, uso_cfdi, iva_pct, comision_agencia_pct, tipo, contacto)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      input.nombre,
      input.rfc ?? null,
      input.razonSocial ?? null,
      input.regimenFiscal ?? null,
      input.cpFiscal ?? null,
      input.usoCfdi ?? null,
      input.ivaPct ?? 16,
      input.comisionAgenciaPct ?? 0,
      input.tipo ?? 'DIRECTO',
      JSON.stringify(input.contacto ?? {}),
    ],
  )
  return rowToCliente(rows[0])
}

// Edición parcial: solo actualiza los campos presentes (coalesce con el actual).
export async function actualizarCliente(id: string, input: Partial<ClienteInput>) {
  const rows = await q(
    `update clientes set
        nombre        = coalesce($2, nombre),
        rfc           = coalesce($3, rfc),
        razon_social  = coalesce($4, razon_social),
        regimen_fiscal= coalesce($5, regimen_fiscal),
        cp_fiscal     = coalesce($6, cp_fiscal),
        uso_cfdi      = coalesce($7, uso_cfdi),
        iva_pct       = coalesce($8, iva_pct),
        comision_agencia_pct = coalesce($9, comision_agencia_pct),
        tipo          = coalesce($10, tipo),
        contacto      = coalesce($11, contacto)
      where id = $1
      returning *`,
    [
      id,
      input.nombre ?? null,
      input.rfc ?? null,
      input.razonSocial ?? null,
      input.regimenFiscal ?? null,
      input.cpFiscal ?? null,
      input.usoCfdi ?? null,
      input.ivaPct ?? null,
      input.comisionAgenciaPct ?? null,
      input.tipo ?? null,
      input.contacto ? JSON.stringify(input.contacto) : null,
    ],
  )
  return rows[0] ? rowToCliente(rows[0]) : null
}
