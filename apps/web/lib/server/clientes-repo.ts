import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'

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
    agenciaId: r.agencia_id ?? null,
    tieneNegociacion: !!r.tiene_negociacion,
    negociacionValidada: !!r.negociacion_validada,
    negociacionNota: r.negociacion_nota ?? null,
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
  agenciaId?: string | null
  tieneNegociacion?: boolean | null
  negociacionValidada?: boolean | null
  negociacionNota?: string | null
  tipo?: string
  contacto?: { nombre?: string; email?: string; telefono?: string }
}

export async function crearCliente(input: ClienteInput) {
  const rows = await q(
    `insert into clientes (nombre, rfc, razon_social, regimen_fiscal, cp_fiscal, uso_cfdi, iva_pct, comision_agencia_pct, agencia_id, tiene_negociacion, negociacion_validada, negociacion_nota, tipo, contacto, tenant_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
    [
      input.nombre,
      input.rfc ?? null,
      input.razonSocial ?? null,
      input.regimenFiscal ?? null,
      input.cpFiscal ?? null,
      input.usoCfdi ?? null,
      input.ivaPct ?? 16,
      input.comisionAgenciaPct ?? 0,
      input.agenciaId ?? null,
      input.tieneNegociacion ?? false,
      input.negociacionValidada ?? false,
      input.negociacionNota ?? null,
      input.tipo ?? 'DIRECTO',
      JSON.stringify(input.contacto ?? {}),
      await tenantActual(),
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
        agencia_id    = coalesce($10, agencia_id),
        tiene_negociacion    = coalesce($11, tiene_negociacion),
        negociacion_validada = coalesce($12, negociacion_validada),
        negociacion_nota     = coalesce($13, negociacion_nota),
        tipo          = coalesce($14, tipo),
        contacto      = coalesce($15, contacto)
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
      input.agenciaId ?? null,
      input.tieneNegociacion ?? null,
      input.negociacionValidada ?? null,
      input.negociacionNota ?? null,
      input.tipo ?? null,
      input.contacto ? JSON.stringify(input.contacto) : null,
    ],
  )
  return rows[0] ? rowToCliente(rows[0]) : null
}
