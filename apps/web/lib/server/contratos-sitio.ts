import 'server-only'
import type { PoolClient } from 'pg'
import { AppError } from './errores'

// ============================================================================
//  lib/server/contratos-sitio.ts — Contrato de arrendamiento en el ALTA de una
//  pantalla.
//
//  El ADR 0001 abre un contrato INCOMPLETO cuando se VENDE una pantalla que no
//  tiene ninguno. Eso tapa el agujero tarde: hasta la primera venta, una pantalla
//  cargada por Excel o por el formulario manual no tiene rastro de a quién se le
//  paga la renta. El ADR 0002 mueve el disparador al alta, que es donde el dato
//  se conoce, y exige elegir arrendador para poder abrirlo.
//
//  El contrato nace INCOMPLETO a propósito: ya sabe DE QUIÉN es el espacio, pero
//  todavía no la vigencia ni el importe. El CHECK `contrato_completo_ck` exige
//  los cuatro datos para cualquier estatus que afirme un acuerdo real, así que
//  INCOMPLETO es el único estatus que este alta puede producir con honestidad.
// ============================================================================

// Comprueba que el arrendador exista DENTRO del tenant. Se valida contra la BD y
// no solo por forma: el id viene del cliente, y sin esta consulta se podría
// colgar una pantalla del arrendador de otra organización. Devuelve su id.
export async function exigirArrendador(
  client: PoolClient,
  tenantId: string | null,
  arrendadorId: unknown,
): Promise<string> {
  if (typeof arrendadorId !== 'string' || !arrendadorId.trim()) {
    throw new AppError(
      'Elige el arrendador de la pantalla: sin propietario no se puede abrir su contrato de arrendamiento.',
      400,
    )
  }
  const { rows } = await client.query(
    'select id from arrendadores where id = $1 and tenant_id = $2',
    [arrendadorId, tenantId],
  )
  if (!rows[0]) throw new AppError('El arrendador elegido no existe.', 404)
  return rows[0].id as string
}

// Predio de una carga masiva: uno ya existente, o uno nuevo a crear.
export type PredioDeCarga = { id: string } | { nombre: string; direccion?: string | null }

// Resuelve el predio de un import. Devuelve su id, o null si la carga no marcó
// predio (pantallas sueltas, cada una con su propio contrato).
//
// Un predio pertenece a UN arrendador (`predios.arrendador_id` es NOT NULL), así
// que el existente se valida contra el arrendador elegido además del tenant: sin
// esa comprobación se podrían colgar pantallas de un predio de otro propietario y
// la renta se atribuiría al equivocado.
export async function resolverPredio(
  client: PoolClient,
  tenantId: string | null,
  arrendadorId: string,
  predio: PredioDeCarga | null | undefined,
): Promise<string | null> {
  if (!predio) return null

  if ('id' in predio) {
    const { rows } = await client.query(
      'select id from predios where id = $1 and tenant_id = $2 and arrendador_id = $3',
      [predio.id, tenantId, arrendadorId],
    )
    if (!rows[0]) {
      throw new AppError('El predio elegido no existe o pertenece a otro arrendador.', 404)
    }
    return rows[0].id as string
  }

  const nombre = String(predio.nombre ?? '').trim()
  if (!nombre) throw new AppError('El predio nuevo necesita un nombre.', 400)
  // Alta mínima. NO se reutiliza `insertarPredioEnTx` de arrendadores-repo porque
  // ese módulo ya importa sitios-repo, y sitios-repo importa este: exportarla
  // cerraría un ciclo. Las columnas omitidas (lat, lng, tipo_ubicacion, estado)
  // tienen default o admiten NULL, y se completan luego en Arrendadores.
  const { rows } = await client.query(
    `insert into predios (arrendador_id, nombre, direccion, tenant_id)
     values ($1, $2, $3, $4) returning id`,
    [arrendadorId, nombre, predio.direccion?.trim() || null, tenantId],
  )
  return rows[0].id as string
}

// Cuelga una pantalla de su arrendador Y de su predio, sin abrir contrato: la
// renta de un predio la define UN contrato compartido por todas sus pantallas,
// así que el contrato se abre una sola vez para el lote (abrirContratoDePredio).
export async function ligarSitioAPredio(
  client: PoolClient,
  args: { tenantId: string | null; sitioId: string; arrendadorId: string; predioId: string },
): Promise<void> {
  await client.query(
    'update sitios set arrendador_id = $1, predio_id = $2 where id = $3 and tenant_id = $4',
    [args.arrendadorId, args.predioId, args.sitioId, args.tenantId],
  )
}

// Abre el contrato pendiente de un PREDIO (uno solo, compartido por sus
// pantallas). `sitio_id` es NOT NULL en la tabla, así que se guarda una pantalla
// del predio como representante histórico; quien manda es `predio_id`.
//
// Ojo: el índice `contratos_predio_activo_uq` NO cubre este caso —solo aplica a
// VIGENTE/POR_VENCER/RENOVADO, no a INCOMPLETO—, así que la unicidad del
// pendiente por predio depende enteramente del `not exists` de aquí abajo.
// `montoRenta` aquí es la renta del PREDIO ENTERO, no la de una pantalla: el
// contrato es uno solo y cubre a todas sus caras. El llamador (importarSitios)
// solo la manda cuando puede calcularla sin adivinar; ver allí la regla.
export async function abrirContratoDePredio(
  client: PoolClient,
  args: {
    tenantId: string | null
    predioId: string
    arrendadorId: string
    sitioId: string
    montoRenta?: number | null
  },
): Promise<void> {
  const { tenantId, predioId, arrendadorId, sitioId } = args
  const monto = args.montoRenta != null && args.montoRenta > 0 ? args.montoRenta : null
  await client.query(
    `insert into contratos_arrendamiento
       (id, sitio_id, predio_id, arrendador_id, razon_social_id, fecha_inicio, monto_renta, moneda, auto_renovable, estatus, tenant_id)
     select gen_random_uuid(), $1, $2, $3,
            (select rs.id from arrendador_razon_social rs
              where rs.arrendador_id = $3 and rs.tenant_id = $4
                and (select count(*) from arrendador_razon_social r2
                      where r2.arrendador_id = $3 and r2.tenant_id = $4) = 1
              limit 1),
            current_date,
            $5::numeric,
            coalesce((select moneda from tenants where id = $4), 'MXN'),
            false, 'INCOMPLETO'::est_contrato, $4
      where not exists (
              select 1 from contratos_arrendamiento c
               where c.predio_id = $2 and c.estatus <> 'CANCELADO'
            )
     on conflict do nothing`,
    [sitioId, predioId, arrendadorId, tenantId, monto],
  )
}

// Estatus que NO acreditan un derecho vigente sobre el espacio:
//   • INCOMPLETO — le faltan arrendador, importe, vigencia o periodicidad. Es un
//     pendiente de captura, no un acuerdo (ADR 0001).
//   • CANCELADO  — hubo acuerdo y se rompió. No cubre nada.
// El resto (VIGENTE, POR_VENCER, RENOVADO, VENCIDO) sí son contratos completos:
// tienen los cuatro datos que exige `contrato_completo_ck`. VENCIDO se admite a
// propósito —está completo, solo caducado— porque el hueco de fechas ya lo señala
// la alerta «El contrato no cubre la campaña» del ADR 0001, y bloquear por fecha
// aquí sería una regla distinta de la que se pidió.
const NO_ACREDITAN = ['INCOMPLETO', 'CANCELADO']

// Impide reservar/vender una pantalla cuyo contrato todavía no está completo
// (ADR 0003). Se mira la misma cobertura de dos anclajes que usa el resto del
// módulo: el contrato propio de la pantalla suelta, o el del predio que la cubre
// junto con sus hermanas.
export async function exigirContratoCompleto(
  client: PoolClient,
  args: { tenantId: string | null; sitioId: string },
): Promise<void> {
  const { tenantId, sitioId } = args
  const { rows } = await client.query(
    `select s.nombre,
            exists (
              select 1 from contratos_arrendamiento c
               where c.tenant_id = $2
                 and not (c.estatus = any($3::est_contrato[]))
                 and ( (c.predio_id is null and c.sitio_id = s.id)
                    or (c.predio_id is not null and c.predio_id = s.predio_id) )
            ) as cubierta
       from sitios s
      where s.id = $1 and s.tenant_id = $2`,
    [sitioId, tenantId, NO_ACREDITAN],
  )
  const fila = rows[0]
  if (!fila) throw new AppError('La pantalla no existe.', 404)
  if (!fila.cubierta) {
    throw new AppError(
      `"${fila.nombre}" todavía no se puede vender: su contrato de arrendamiento está incompleto. ` +
        'Complétalo en Arrendadores (arrendador, vigencia, importe y periodicidad) antes de reservarla.',
      409,
    )
  }
}

// Cuelga la pantalla de su arrendador y le abre el contrato pendiente. Son dos
// sentencias pero una sola acción de negocio, y van juntas a propósito: una
// pantalla con arrendador pero sin contrato, o al revés, es justo el estado a
// medias que el ADR 0002 elimina.
//
// El arrendador se fija con un UPDATE y NO añadiendo `arrendador_id` a COLS: esa
// lista la reutiliza `actualizarSitioCompleto()` para la re-importación, que pisa
// todas sus columnas con lo que traiga el Excel. Como la plantilla no lleva
// propietario, meterlo ahí borraría el arrendador en cada recarga del archivo
// —el mismo fallo que ya tenían las columnas de pausa legal—.
//
// No pisa nada si la pantalla YA está cubierta. Se miran los dos anclajes
// posibles, igual que en campanas-repo: un predio tiene UN contrato que comparten
// todas sus pantallas, así que colgar una segunda cara de un predio ya contratado
// no debe abrir un pendiente duplicado. La unicidad la respalda además el índice
// parcial `contratos_sitio_incompleto_uq`, de modo que un reintento o una carrera
// no dejan dos pendientes del mismo sitio.
//
// Los datos fiscales se heredan del arrendador: si tiene UNA sola razón social se
// ancla al contrato. Con varias no se adivina —cuál factura es decisión de quien
// captura— y con ninguna no hay nada que heredar; en ambos casos queda NULL y
// pasa a ser parte de lo que falta por completar.
// `montoRenta` es lo que el Excel del import trae en la columna
// `renta_arrendador`. Es OPCIONAL: sin ella el contrato nace como siempre, sin
// importe. Con ella el pendiente ya dice CUÁNTO se paga, que es la mitad cara
// del dato —la otra mitad (periodicidad y vigencia) se captura en Arrendadores—.
//
// El contrato sigue naciendo INCOMPLETO aunque traiga importe, y NO es un
// descuido: `contrato_completo_ck` exige los cuatro datos para cualquier estatus
// que afirme un acuerdo real, y aquí faltan dos. Ponerlo en VIGENTE con el
// importe suelto sería afirmar un acuerdo que nadie capturó.
export async function asignarArrendadorYAbrirContrato(
  client: PoolClient,
  args: {
    tenantId: string | null
    sitioId: string
    arrendadorId: string
    montoRenta?: number | null
  },
): Promise<void> {
  const { tenantId, sitioId, arrendadorId } = args
  // Un 0 o un negativo NUNCA llegan a la columna: `contrato_monto_ck` los
  // rechaza, y un 0 se leería como «este espacio es gratis» en el P&L.
  const monto = args.montoRenta != null && args.montoRenta > 0 ? args.montoRenta : null
  await client.query(
    'update sitios set arrendador_id = $1 where id = $2 and tenant_id = $3',
    [arrendadorId, sitioId, tenantId],
  )
  await client.query(
    `insert into contratos_arrendamiento
       (id, sitio_id, arrendador_id, razon_social_id, fecha_inicio, monto_renta, moneda, auto_renovable, estatus, tenant_id)
     select gen_random_uuid(), $1, $2,
            (select rs.id from arrendador_razon_social rs
              where rs.arrendador_id = $2 and rs.tenant_id = $3
                and (select count(*) from arrendador_razon_social r2
                      where r2.arrendador_id = $2 and r2.tenant_id = $3) = 1
              limit 1),
            current_date,
            $4::numeric,
            coalesce((select moneda from tenants where id = $3), 'MXN'),
            false, 'INCOMPLETO'::est_contrato, $3
      where not exists (
              select 1 from contratos_arrendamiento c
               where -- contrato propio de esta pantalla (pantalla suelta)
                     (c.predio_id is null and c.sitio_id = $1)
                     -- o el del predio que la cubre junto con sus hermanas. Un
                     -- acuerdo CANCELADO no cubre nada, así que no cuenta.
                  or (c.estatus <> 'CANCELADO'
                      and c.predio_id = (select predio_id from sitios where id = $1))
            )
     on conflict do nothing`,
    [sitioId, arrendadorId, tenantId, monto],
  )
}
