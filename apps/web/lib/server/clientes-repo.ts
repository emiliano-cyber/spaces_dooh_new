import 'server-only'
import { q, q1, withTenantTx } from './db'
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

// ─── Borrado (CRUD-01) ───────────────────────────────────────────────────────
//  La auditoría del 2026-08-26 dejó diez clientes de prueba que NADIE podía
//  quitar: la ruta solo exportaba PATCH. El borrado es REAL —la fila se va—,
//  aprobado con el riesgo a la vista frente a la alternativa de archivar.
//
//  Lo que decide de verdad qué se puede borrar es el ESQUEMA, no este archivo.
//  El censo de claves foráneas que apuntan a `clientes(id)` da CINCO, y CUATRO
//  bloquean:
//
//    · campanas.cliente_id    not null · on delete restrict  → bloquea
//    · facturas.cliente_id    not null · on delete restrict  → bloquea
//    · clientes.agencia_id    SIN cláusula `on delete`       → NO ACTION, bloquea
//    · propuestas.agencia_id  SIN cláusula `on delete`       → NO ACTION, bloquea
//    · propuestas.cliente_id  on delete SET NULL             → NO bloquea
//
//  Las dos de `agencia_id` las añadió `20260625_agencia_en_propuesta.sql` sin
//  `on delete`, y Postgres las dejó en NO ACTION —que bloquea igual que un
//  RESTRICT—. No se contaban al escribir esto y son la mitad de los bloqueos
//  reales: `propuestas-repo.ts:449-451` escribe `clientes.agencia_id` cada vez
//  que se crea una propuesta con cliente Y agencia, así que una agencia
//  referenciada es el caso corriente. Sin contarlas, borrar una agencia salía
//  como el 409 genérico del driver («El registro está referenciado por otro»),
//  que no dice qué la retiene ni cuánto.
//
//  Por qué se CUENTA antes en vez de intentar el DELETE y traducir el 23503:
//  el error del driver dice qué constraint saltó, pero no cuántas filas hay
//  detrás, y el usuario necesita el «cuántas» para saber qué desmontar. El
//  23503 sigue siendo la red por si algo entra entre la cuenta y el borrado;
//  cae en el mapeo genérico de `errores.ts` y responde 409, no 500.
export type ResultadoBorrado =
  | { estado: 'no-encontrado' }
  | {
      estado: 'bloqueado'
      campanas: number
      facturas: number
      clientesConEstaAgencia: number
      propuestasConEstaAgencia: number
    }
  | { estado: 'huerfanas'; propuestas: number }
  | { estado: 'borrado'; cliente: ReturnType<typeof rowToCliente> }

export async function borrarCliente(
  id: string,
  opts: { confirmaPropuestasHuerfanas?: boolean } = {},
): Promise<ResultadoBorrado> {
  const tenant = await tenantActual()

  // Contar y borrar en UNA transacción. En dos, entre la cuenta y el borrado
  // cabe una factura nueva: se respondería «se puede» y el DELETE fallaría
  // después con el error crudo del driver.
  return withTenantTx(async (client) => {
    // El `and tenant_id = $2` es la segunda capa sobre la RLS que exigen las
    // convenciones. NO se copia de `actualizarCliente` (arriba en este mismo
    // archivo), que hace `update ... where id = $1` a secas: eso es un defecto
    // de aislamiento conocido y pendiente, no el patrón a seguir.
    const existente = await client.query('select * from clientes where id = $1 and tenant_id = $2', [
      id,
      tenant,
    ])
    // 404 y no 403: para quien pregunta por un cliente de otra organización, ese
    // cliente sencillamente no existe. Un 403 confirmaría que el id es real.
    if (!existente.rows[0]) return { estado: 'no-encontrado' as const }

    const b = await client.query(
      `select
         (select count(*) from campanas   where cliente_id = $1 and tenant_id = $2) as campanas,
         (select count(*) from facturas   where cliente_id = $1 and tenant_id = $2) as facturas,
         (select count(*) from clientes   where agencia_id = $1 and tenant_id = $2) as clientes_agencia,
         (select count(*) from propuestas where agencia_id = $1 and tenant_id = $2) as propuestas_agencia,
         (select count(*) from propuestas where cliente_id = $1 and tenant_id = $2) as propuestas_cliente`,
      [id, tenant],
    )
    const n = (col: string) => Number(b.rows[0]?.[col] ?? 0)
    const campanas = n('campanas')
    const facturas = n('facturas')
    const clientesConEstaAgencia = n('clientes_agencia')
    const propuestasConEstaAgencia = n('propuestas_agencia')

    if (campanas || facturas || clientesConEstaAgencia || propuestasConEstaAgencia) {
      return {
        estado: 'bloqueado' as const,
        campanas,
        facturas,
        clientesConEstaAgencia,
        propuestasConEstaAgencia,
      }
    }

    // `propuestas.cliente_id` es SET NULL: esto NO falla, deja las propuestas
    // sin dueño y sin avisar. Una propuesta huérfana es un documento comercial
    // del que ya no se sabe a quién iba, su liga pública sigue abierta, y su
    // IVA pasa a tomar el 16 por omisión (`propuestas-repo.ts:65`) en vez del
    // del cliente — o sea que el documento cambia de precio al borrar. Se pide
    // confirmación explícita, con el mismo mecanismo que el nombre repetido del
    // alta: se avisa con la cifra y quien borra decide.
    const propuestas = n('propuestas_cliente')
    if (propuestas > 0 && !opts.confirmaPropuestasHuerfanas) {
      return { estado: 'huerfanas' as const, propuestas }
    }

    const borrado = await client.query(
      'delete from clientes where id = $1 and tenant_id = $2 returning *',
      [id, tenant],
    )
    if (!borrado.rows[0]) return { estado: 'no-encontrado' as const }
    return { estado: 'borrado' as const, cliente: rowToCliente(borrado.rows[0]) }
  })
}
