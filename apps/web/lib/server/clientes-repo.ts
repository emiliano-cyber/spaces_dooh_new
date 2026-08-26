import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'
import { AppError } from './errores'

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
  /** El alta ya vio el aviso de «se llama igual que otro» y confirma que es distinto. */
  confirmaNombreRepetido?: boolean
}

// ─── Duplicados (VAL-03) ─────────────────────────────────────────────────────
//  La auditoría del 2026-08-26 dio de alta el mismo cliente dos veces —mismo
//  nombre y mismo RFC— y las dos respondieron 201. El módulo de arrendadores ya
//  había resuelto esto en agosto (A5 / INC-07); esto es su espejo, a propósito,
//  para que las dos altas no diverjan. Dos redes para dos problemas distintos:
//
//   · RFC — regla dura, la pone un índice único por organización
//     (`db/migrations/20260826_clientes_rfc_unico.sql`). Dos clientes con el
//     mismo RFC son el mismo contribuyente. La salvedad que arrendadores no
//     tenía: los RFC GENÉRICOS del SAT se comparten por diseño, y el índice los
//     deja fuera; el nombre repetido los cubre.
//
//   · NOMBRE — comprobación aquí, con salida. Dos clientes distintos SÍ pueden
//     llamarse igual, así que un índice único frenaría un alta legítima sin
//     forma de continuar. Se avisa y, si quien da el alta confirma, pasa.
export class ClienteDuplicado extends AppError {
  // Puede venir null: si el choque lo provocó otra petición en el mismo
  // instante, su fila quizá no sea visible todavía cuando se va a buscar.
  existente: ReturnType<typeof rowToCliente> | null
  motivo: 'rfc' | 'nombre'
  constructor(mensaje: string, motivo: 'rfc' | 'nombre', existente: ReturnType<typeof rowToCliente> | null) {
    super(mensaje, 409)
    this.name = 'ClienteDuplicado'
    this.motivo = motivo
    this.existente = existente
  }
}

// Normalización del nombre para comparar. NO es `upper(btrim(...))` como en
// arrendadores, y la diferencia es deliberada: el alta de campaña desde una
// reserva ya reutiliza el cliente que coincide con este mismo criterio
// —minúsculas, recortado y con los espacios interiores colapsados
// (`campanas-repo.ts`)—. Dos definiciones distintas de «el mismo cliente»
// serían peores que una sola imperfecta: el aviso diría que existe y la reserva
// crearía otro, o al revés.
const nombreNormalizado = (expr: string) =>
  `lower(regexp_replace(btrim(${expr}), '\\s+', ' ', 'g'))`

export async function crearCliente(input: ClienteInput) {
  const tenant = await tenantActual()

  // Red del nombre. Se mira ANTES de insertar y a propósito no se blinda contra
  // la carrera: si dos altas idénticas entran a la vez y ninguna ve a la otra,
  // quedan dos filas — que es justo lo que la regla permite cuando alguien
  // confirma. Lo que evita es el caso real: una persona repitiendo un minuto
  // después porque no encontró al cliente en la lista.
  //
  // Incluye los dados de baja (sin filtrar por `activo`): un nombre que
  // reaparece suele ser alguien recuperando lo que borró, y decírselo es más
  // útil que crear un segundo registro en la sombra.
  if (!input.confirmaNombreRepetido) {
    const previo = await q1<any>(
      `select * from clientes
        where tenant_id = $1
          and ${nombreNormalizado('nombre')} = ${nombreNormalizado('$2::text')}
        order by creado_en asc limit 1`,
      [tenant, input.nombre],
    )
    if (previo) {
      throw new ClienteDuplicado(
        `Ya existe un cliente llamado «${previo.nombre}»` +
          (previo.activo === false ? ' (dado de baja)' : '') +
          '. Si es otro distinto, confírmalo para darlo de alta igualmente.',
        'nombre',
        rowToCliente(previo),
      )
    }
  }

  try {
    return await insertarCliente(input, tenant)
  } catch (e) {
    // 23505 sobre el índice del RFC. Sin esto saldría el 409 genérico («El
    // registro ya existe»), que no dice cuál ni deja llegar a él — y quien da
    // el alta no puede adivinar que el choque es por un RFC que quizá ni
    // recuerda haber capturado en otro cliente.
    if ((e as { code?: string })?.code !== '23505') throw e
    if (!String((e as { constraint?: string })?.constraint ?? '').includes('rfc')) throw e
    const dueno = await q1<any>(
      `select * from clientes
        where tenant_id = $1 and upper(btrim(rfc)) = upper(btrim($2)) limit 1`,
      [tenant, input.rfc ?? ''],
    )
    throw new ClienteDuplicado(
      dueno
        ? `El RFC ${String(input.rfc).toUpperCase()} ya es de «${dueno.nombre}». Un RFC pertenece a un solo contribuyente.`
        : 'Ese RFC ya está registrado en otro cliente.',
      'rfc',
      dueno ? rowToCliente(dueno) : null,
    )
  }
}

async function insertarCliente(input: ClienteInput, tenant: string | null) {
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
      tenant,
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
