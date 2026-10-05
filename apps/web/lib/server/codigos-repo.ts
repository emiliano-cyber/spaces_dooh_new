import 'server-only'
import { q, q1, pool, fijarTenant } from './db'
import { tenantActual } from './tenant'
import { usuarioActual } from './auth'
import {
  motivoCanjeImposible,
  normalizarCodigo,
  type CodigoPromocional,
} from '@/lib/codigo-promocional'
import {
  estadoCodigoDeFila,
  estatusTrasCanje,
  motivoDecisionImposible,
  textoAprobacion,
  textoReactivacion,
  textoRechazo,
  type EstadoCodigo,
} from '@/lib/codigo-aprobacion'
import { paqueteDeFila } from '@/lib/paquete'
import type { PoolClient } from 'pg'

// ============================================================================
//  lib/server/codigos-repo.ts — Los códigos promocionales de la organización y
//  su canje.  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL vive
//  aquí, siempre parametrizado, y toda operación por `id` lleva
//  `and tenant_id = $n` como segunda capa sobre la RLS.
//
//  ─── POR QUÉ ESA SEGUNDA CAPA IMPORTA ESPECIALMENTE AQUÍ ─────────────────
//  El modo de fallo de R2 no da error. Con un cupón tiene DOS formas, y la
//  segunda es peor que una fuga de lectura:
//
//   · Hacia dentro: leer sin contexto de tenant devuelve cero filas, y «cero
//     cupones» no se lee como un error, se lee como «esta empresa no tiene
//     promociones». El cliente teclea su código, le dicen que no existe, y
//     nadie investiga nada.
//   · Hacia fuera, y es la grave: canjear el cupón de OTRA organización le
//     GASTA UN USO a una empresa que no autorizó nada. No es que se vea algo
//     que no se debe: es que se consume un presupuesto ajeno.
//
//  ─── EL CONTADOR DE USOS NO ES UNA COLUMNA ───────────────────────────────
//  No hay `usos_consumidos` en ningún sitio. El número de usos es `count(*)`
//  sobre `canjes_codigo`, y ésa es la única respuesta a «cuántas veces se
//  usó». Una columna contador ADEMÁS del registro serían dos verdades, y un
//  `on delete cascade` desde `propuestas` desincronizaría la columna sin que
//  nadie lo viera — el cupón quedaría agotado para siempre con cero canjes
//  vivos. Contando filas eso no puede pasar por construcción.
// ============================================================================

/** Un cupón como lo ve la pantalla de configuración: con su cuenta de usos. */
export type CodigoFila = CodigoPromocional & {
  id: string
  /** Cuántas veces se ha canjeado YA. Es `count(*)` sobre `canjes_codigo`. */
  usos: number
}

// `pg` devuelve `numeric` como CADENA ('20.00') y `date` como `Date`. Sin esta
// conversión el porcentaje llegaría al cálculo del precio como texto, y las
// fechas como objetos con zona horaria — `new Date('2026-09-30')` es medianoche
// UTC, que en México es el día 29. Por eso el SQL las trae con `to_char`.
const aCodigo = (r: any): CodigoFila => ({
  id: String(r.id),
  codigo: String(r.codigo),
  descuentoPct: Number(r.descuento_pct),
  vigenteDesde: String(r.vigente_desde),
  vigenteHasta: String(r.vigente_hasta),
  usosMaximos: r.usos_maximos != null ? Number(r.usos_maximos) : null,
  usos: Number(r.usos ?? 0),
})

const SEL_CODIGO = `id, codigo, descuento_pct,
        to_char(vigente_desde,'YYYY-MM-DD') as vigente_desde,
        to_char(vigente_hasta,'YYYY-MM-DD') as vigente_hasta,
        usos_maximos`

/**
 * Los cupones de la organización, con su cuenta de canjes.
 *
 * NO acepta ningún argumento, y eso es el candado: el tenant sale de la RLS,
 * que la fija `db.ts` con el de la sesión. Si aceptara un `tenantId` se podría
 * leer —y, con el `id` en la mano, gastar— la promoción de otra organización.
 */
export async function listarCodigos(): Promise<CodigoFila[]> {
  const filas = await q<any>(
    `select ${SEL_CODIGO},
            (select count(*) from canjes_codigo k
              where k.codigo_id = c.id and k.tenant_id = c.tenant_id) as usos
       from codigos_promocionales c
      order by vigente_hasta desc, upper(codigo) asc`,
  )
  return filas.map(aCodigo)
}

/**
 * Alta o edición de un cupón. `null` si el `id` no es de esta organización —
 * que es lo mismo que «no existe» desde aquí dentro.
 *
 * El `tenant_id` sale SIEMPRE de `tenantActual()`, nunca del argumento: si
 * viajara en el cuerpo, cualquiera podría crear un cupón en otra organización
 * con un `curl`, y la fila escrita sería coherente consigo misma, así que el
 * `with check` de la RLS la aprobaría sin rechistar.
 *
 * EDITAR UN CUPÓN NO MUEVE NINGUNA VENTA YA HECHA, y es a propósito: el
 * porcentaje se copia a `propuestas.codigo_descuento_pct` al canjear. Subir
 * VERANO20 del 20 % al 30 % se aplica a los canjes de mañana y a ninguno de
 * ayer. Es el invariante 3 del ADR 0039.
 */
export async function guardarCodigo(c: {
  id?: string
  codigo: string
  descuentoPct: number
  vigenteDesde: string
  vigenteHasta: string
  usosMaximos: number | null
}): Promise<CodigoFila | null> {
  const tenant = await tenantActual()
  if (c.id) {
    const fila = await q1<any>(
      `update codigos_promocionales
          set codigo = $3, descuento_pct = $4, vigente_desde = $5::date,
              vigente_hasta = $6::date, usos_maximos = $7
        where id = $1 and tenant_id = $2
        returning ${SEL_CODIGO}, 0 as usos`,
      [c.id, tenant, c.codigo, c.descuentoPct, c.vigenteDesde, c.vigenteHasta, c.usosMaximos],
    )
    if (!fila) return null
    // La cuenta de usos se relee aparte y no se inventa en el `returning`: un
    // `0 as usos` devuelto a la pantalla haría creer que editar reinicia el
    // contador, que es justo lo contrario de lo que pasa.
    const n = await q1<any>(
      'select count(*)::int as usos from canjes_codigo where codigo_id = $1 and tenant_id = $2',
      [c.id, tenant],
    )
    return aCodigo({ ...fila, usos: n?.usos ?? 0 })
  }
  const fila = await q1<any>(
    `insert into codigos_promocionales
       (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
     values ($1,$2,$3,$4::date,$5::date,$6)
     returning ${SEL_CODIGO}, 0 as usos`,
    [tenant, c.codigo, c.descuentoPct, c.vigenteDesde, c.vigenteHasta, c.usosMaximos],
  )
  return fila ? aCodigo(fila) : null
}

/**
 * Borra un cupón. `false` = no existe en esta organización.
 *
 * Borrado REAL, no lógico, igual que un tramo de volumen y al revés que una
 * franja. Nada del precio depende de esta fila: `propuestas.codigo_texto` y
 * `propuestas.codigo_descuento_pct` ya tienen copiado lo que hay que cobrar.
 * Sus canjes se van con él (`on delete cascade`), que es lo correcto — el
 * presupuesto deja de existir, así que contar contra él deja de tener sentido—
 * y **ninguna propuesta se mueve**, ni la capturada ni la aprobada.
 *
 * Y por eso no hace falta una baja lógica, que además chocaría con el `unique`
 * sobre `upper(codigo)`: impediría volver a crear VERANO20 mientras existiera
 * un VERANO20 apagado.
 */
export async function borrarCodigo(id: string): Promise<boolean> {
  const tenant = await tenantActual()
  const fila = await q1<any>(
    'delete from codigos_promocionales where id = $1 and tenant_id = $2 returning id',
    [id, tenant],
  )
  return !!fila
}

/**
 * Lo que se congela en la propuesta al canjear.
 *
 * COD-03 · `estado` es SIEMPRE `'PENDIENTE'` al canjear (decisión 3 del dueño):
 * nadie aprueba su propio canje, ni siquiera quien tiene `comercial.aprobar`.
 * Que lo aplique un gerente no lo salta — es un segundo clic, y el registro
 * dice quién dio cada uno. `reactivada` = la propuesta estaba RECHAZADA y el
 * canje la devolvió a BORRADOR (decisión 1).
 */
export type CanjeHecho = {
  codigo: string
  descuentoPct: number
  estado: EstadoCodigo
  reactivada: boolean
}

/** No se puede decidir sobre el cupón de esa propuesta (→ 409). */
export class DecisionImposible extends Error {}

/**
 * La línea de Actividad, escrita DENTRO de la transacción que la provoca.
 *
 * No va por `registrarAccion()` a propósito: ésa corre en su propia conexión
 * DESPUÉS del commit y se traga cualquier fallo, que está bien para «alguien
 * hizo algo», pero aquí la línea ES la explicación de un cambio de dinero o de
 * estatus — una reactivación o un rechazo sin su motivo escrito no se puede
 * explicar después. Si la línea no se puede escribir, no se hace el cambio.
 *
 * `usuario_nombre` se congela como texto, igual que en `acciones-repo.ts`: dar
 * de baja al gerente mañana no borra quién decidió.
 */
async function anotar(
  client: PoolClient,
  tenant: string | null,
  usuario: { id: string; nombre?: string | null } | null,
  accion: string,
  entidad: string,
) {
  await client.query(
    `insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id)
     values ($1,$2,$3,$4,$5)`,
    [accion, entidad, usuario?.id ?? null, usuario?.nombre ?? 'Sistema', tenant],
  )
}

/** Cómo se nombra la propuesta en Actividad: folio y nombre, o el id si faltan. */
function entidadDe(p: { folio?: string | null; nombre?: string | null }, id: string): string {
  const partes = [p.folio, p.nombre].filter(Boolean)
  return partes.length ? partes.join(' · ') : id
}

/**
 * Quita el cupón de una propuesta y DEVUELVE EL USO, dentro de una transacción
 * que ya existe. La comparten `quitarCodigo` (el vendedor lo quita),
 * `decidirCodigo` (un gerente lo RECHAZA) y la aceptación pública con el cupón
 * PENDIENTE (`propuestas-repo.ts`), para que las tres limpien LO MISMO: si una
 * olvidara `codigo_estado`, el CHECK `propuestas_codigo_revision_ck` la tiraría
 * — pero en producción, con un 500 delante de un cliente.
 *
 * Se borra la FILA del canje, que es el contador: no hay columna que
 * decrementar, así que contador y registro no pueden discrepar.
 */
export async function quitarCanjeEnTx(
  client: PoolClient,
  propuestaId: string,
  tenant: string | null,
) {
  await client.query('delete from canjes_codigo where propuesta_id=$1 and tenant_id=$2', [
    propuestaId,
    tenant,
  ])
  // Las SEIS columnas se limpian JUNTAS. Los CHECK `propuestas_codigo_pareja_ck`
  // y `propuestas_codigo_revision_ck` rechazarían dejar una sin las otras, y es
  // a propósito: un porcentaje sin su código es un descuento que nadie puede
  // auditar, y un estado sin cupón no significa nada.
  await client.query(
    `update propuestas
        set codigo_texto=null, codigo_descuento_pct=0, codigo_canjeado_en=null,
            codigo_estado=null, codigo_aprobado_por=null, codigo_aprobado_en=null
      where id=$1 and tenant_id=$2`,
    [propuestaId, tenant],
  )
}

/** El canje no se pudo hacer, y el mensaje explica por qué. */
export class CanjeImposible extends Error {}

/**
 * ⚠️ CANJEA UN CÓDIGO CONTRA UNA PROPUESTA. Es el corazón de esta fase.
 *
 * Recibe **el código tecleado y nada más**. No recibe el porcentaje, ni el
 * importe, ni un «ya validado»: todo eso lo decide aquí el servidor leyendo la
 * base. Es el invariante número uno de la Fase 3, y es consecuencia directa del
 * hallazgo B40 — la cadena de precio de la Fase 1 vive entera en el navegador,
 * y sobre eso un cupón no se puede construir.
 *
 * ═══ CÓMO SE RESUELVE LA CARRERA DEL ÚLTIMO USO ═════════════════════════════
 *
 * Dos vendedores canjeando a la vez el último uso es una carrera REAL, y el
 * camino ingenuo —contar, comprobar, insertar— la pierde siempre: los dos leen
 * N−1 y los dos insertan.
 *
 * Se resuelve con el `for update` del paso 1, y el orden importa:
 *
 *   1. `select … for update` sobre la FILA DEL CUPÓN. El segundo que llegue se
 *      queda esperando AQUÍ, antes de haber contado nada.
 *   2. Solo entonces se cuentan los canjes. Como en READ COMMITTED cada
 *      sentencia toma una instantánea nueva, cuando el primero confirma, el
 *      segundo cuenta **incluyendo** el canje recién insertado.
 *   3. Y decide `motivoCanjeImposible`, que ve el conteo de verdad.
 *
 * Contar ANTES de bloquear no serviría de nada: sería el mismo `select` sin
 * lock con un `for update` decorativo detrás.
 *
 * `current_date` sale de POSTGRES y no de `new Date()` en Node, y viaja en la
 * misma consulta que bloquea la fila: una sola lectura del reloj, la del
 * servidor de base de datos. Con `next dev`, `new Date()` correría en la
 * máquina de quien desarrolla.
 *
 * ═══ LO QUE NO VIGILA ESTA FUNCIÓN ══════════════════════════════════════════
 * Que la propuesta no esté APROBADA lo comprueba el paso 0. Que no tenga ya un
 * código lo comprueba el paso 4 **y además** el `unique (propuesta_id)` de la
 * base, que es lo único que sirve contra un doble clic.
 */
export async function canjearCodigo(
  propuestaId: string,
  codigoTecleado: string,
): Promise<CanjeHecho> {
  const codigo = normalizarCodigo(codigoTecleado)
  const tenant = await tenantActual()
  const usuario = await usuarioActual()
  const usuarioId = usuario?.id ?? null

  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)

    // ── 0 · la propuesta existe, es de esta organización y NO está aprobada ──
    // Una propuesta aprobada es inmutable: su precio ya está congelado en el
    // snapshot y el cliente lo aceptó. Aplicarle un cupón después cambiaría un
    // documento firmado.
    //
    // COD-03 · y la fila se lee BLOQUEADA (`for no key update`). Sin el
    // bloqueo, aprobar la propuesta por dentro —o que el cliente la acepte—
    // podría colarse entre esta lectura y el update del paso 5, y la propuesta
    // quedaría APROBADA con un cupón PENDIENTE que el snapshot congelaría: un
    // descuento firmado que nadie aprobó. Con el bloqueo, quien llegue segundo
    // espera y lee el estado de verdad. `no key update` y no `update`: no
    // cambia ninguna clave, así que no tiene por qué bloquear a quien solo
    // inserta filas que la referencian (el propio `canjes_codigo` de abajo).
    const prop = (
      await client.query(
        `select estatus, codigo_texto, folio, nombre,
                paquete_nombre, paquete_precio, paquete_admite_codigo
           from propuestas
          where id=$1 and tenant_id=$2 for no key update`,
        [propuestaId, tenant],
      )
    ).rows[0]
    if (!prop) throw new CanjeImposible('Esa propuesta no existe en esta organizacion.')
    if (prop.estatus === 'APROBADA') {
      throw new CanjeImposible(
        'La propuesta ya esta aprobada y es inmutable; un cambio va como adenda.',
      )
    }

    // ── 0-bis · REGLA 2 DEL ADR 0039, DESDE ESTE LADO ──────────────────────
    // 2026-10-05. Un paquete es PRECIO FINAL y, si su bandera congelada dice
    // que no admite cupón, `armarPropuesta` lo anula (`propuestas-repo.ts`,
    // `codigoAnulaPaquete`). Hasta hoy este canje NO lo miraba: insertaba la
    // fila de `canjes_codigo` —que ES el contador— y el descuento salía 0. Un
    // uso de la promoción gastado a cambio de nada, con un 200 OK y sin una
    // frase. El camino inverso (poner el paquete sobre una propuesta con
    // cupón) ya se negaba en `aplicarPaquete` (`paquetes-repo.ts`); éste es
    // su espejo.
    //
    // Se decide con `paqueteDeFila`, la MISMA lectura que usa `armarPropuesta`,
    // para que el canje se rechace exactamente cuando el cupón no descontaría:
    // ni uno más ni uno menos. Va ANTES de bloquear el cupón, igual que la
    // APROBADA: no se le retiene la fila a una promoción por un intento que no
    // podía prosperar. Y la fila de la propuesta ya está bloqueada (`for no
    // key update`, arriba), así que nadie le pone ni le quita el paquete entre
    // esta lectura y el insert: `aplicarPaquete` lee esa misma fila con el
    // mismo bloqueo y espera a que este canje confirme o revierta.
    const paquete = paqueteDeFila(prop)
    if (paquete && !paquete.admiteCodigo) {
      throw new CanjeImposible(
        `El paquete "${paquete.nombre}" de esta propuesta es precio final y no admite codigos ` +
          'promocionales. Quita el paquete, o cambialo por uno que si los admita, antes de aplicar el codigo.',
      )
    }

    // ── 1 · BLOQUEA la fila del cupón. Aquí se serializa la carrera ─────────
    // `upper(codigo) = upper($2)` usa el mismo índice único que impide que
    // existan `verano20` y `VERANO20` a la vez.
    const cup = (
      await client.query(
        `select ${SEL_CODIGO}, current_date::text as hoy
           from codigos_promocionales
          where tenant_id = $1 and upper(codigo) = upper($2)
          for update`,
        [tenant, codigo],
      )
    ).rows[0]

    // ── 2 · con la fila ya bloqueada, se cuentan los canjes ────────────────
    const usos = cup
      ? Number(
          (
            await client.query(
              'select count(*)::int as n from canjes_codigo where codigo_id=$1 and tenant_id=$2',
              [cup.id, tenant],
            )
          ).rows[0]?.n,
        )
      : 0

    // ── 3 · decide el módulo puro, con los datos que acaba de leer la base ──
    const motivo = motivoCanjeImposible(
      cup
        ? {
            codigo: String(cup.codigo),
            descuentoPct: Number(cup.descuento_pct),
            vigenteDesde: String(cup.vigente_desde),
            vigenteHasta: String(cup.vigente_hasta),
            usosMaximos: cup.usos_maximos != null ? Number(cup.usos_maximos) : null,
          }
        : null,
      cup ? String(cup.hoy) : '',
      usos,
    )
    if (motivo) throw new CanjeImposible(motivo)

    // ── 4 · un solo código por propuesta ───────────────────────────────────
    // Se comprueba para poder decir una frase; el `unique (propuesta_id)` es lo
    // que de verdad lo impide, y es lo único que sirve contra un doble clic.
    if (prop.codigo_texto != null) {
      throw new CanjeImposible(
        `Esta propuesta ya tiene el codigo "${prop.codigo_texto}". Quitalo antes de poner otro.`,
      )
    }

    await client.query(
      `insert into canjes_codigo (tenant_id, codigo_id, propuesta_id, usuario_id)
       values ($1,$2,$3,$4)`,
      [tenant, cup.id, propuestaId, usuarioId],
    )

    // ── 5 · EL PRECIO SE CONGELA EN LA PROPUESTA ───────────────────────────
    // El texto y el porcentaje se copian aquí, igual que el ítem ya copiaba
    // `tarifa_unitaria` y `descuento_volumen_pct`. A partir de este instante la
    // venta no depende del cupón: cambiarlo o borrarlo mañana no la mueve.
    // El snapshot la volverá a congelar al aprobar. Dos redes.
    // Los TRES campos se escriben juntos, y el CHECK
    // `propuestas_codigo_pareja_ck` rechazaría dejar uno sin los otros. El
    // momento sale de `now()` de Postgres —el mismo reloj que dijo que el cupón
    // estaba vigente—, no de Node.
    //
    // COD-03 · y nace PENDIENTE, en el MISMO update: no existe un instante en
    // que la fila tenga cupón y no tenga estado (el CHECK
    // `propuestas_codigo_revision_ck` tampoco lo dejaría). La aprobación se
    // limpia aunque viniera vacía: un cupón nuevo no hereda la de nadie.
    const pct = Number(cup.descuento_pct)
    await client.query(
      `update propuestas
          set codigo_texto=$2, codigo_descuento_pct=$3, codigo_canjeado_en=now(),
              codigo_estado='PENDIENTE', codigo_aprobado_por=null, codigo_aprobado_en=null
        where id=$1 and tenant_id=$4`,
      [propuestaId, String(cup.codigo), pct, tenant],
    )

    // ── 6 · DECISIÓN 1 DEL DUEÑO: el cupón reactiva una RECHAZADA ──────────
    // «En propuesta se debe de poder poner un cupón si fue rechazada para
    // volverla a activar.» Vuelve a BORRADOR —no a ENVIADA—: el cupón todavía
    // tiene que aprobarse y la propuesta volver a mandarse; reactivarla es
    // devolverla a la mesa, no al cliente. Va DENTRO de la transacción del
    // canje: si el canje falla (vencido, agotado, de otra empresa), la
    // propuesta se queda RECHAZADA, y si la reactivación fallara, no se gasta
    // el uso.
    const reactivada = estatusTrasCanje(String(prop.estatus)) !== String(prop.estatus)
    if (reactivada) {
      await client.query(
        `update propuestas set estatus='BORRADOR'::est_propuesta
          where id=$1 and tenant_id=$2 and estatus='RECHAZADA'`,
        [propuestaId, tenant],
      )
      await anotar(client, tenant, usuario, textoReactivacion(String(cup.codigo)), entidadDe(prop, propuestaId))
    }

    await client.query('commit')
    return { codigo: String(cup.codigo), descuentoPct: pct, estado: 'PENDIENTE', reactivada }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

/**
 * Quita el código de una propuesta y **DEVUELVE EL USO**.
 *
 * Es la contrapartida de haber contado el canje al aplicar: el uso solo se
 * queda retenido mientras la propuesta siga viva y con el código puesto, que es
 * exactamente mientras la promesa al cliente siga en pie. Borrar la propuesta
 * también lo devuelve, por el `on delete cascade` de `canjes_codigo`.
 *
 * `false` = esa propuesta no existe aquí o no tenía código.
 *
 * Nota sobre el borrado del canje: se borra la FILA, que es el contador. No hay
 * ninguna columna que decrementar, así que no hay forma de que el contador y el
 * registro discrepen.
 */
export async function quitarCodigo(propuestaId: string): Promise<boolean> {
  const tenant = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // Bloqueada por lo mismo que en el canje: que nadie la apruebe a la vez.
    const prop = (
      await client.query(
        'select estatus, codigo_texto from propuestas where id=$1 and tenant_id=$2 for no key update',
        [propuestaId, tenant],
      )
    ).rows[0]
    if (!prop) {
      await client.query('rollback')
      return false
    }
    if (prop.estatus === 'APROBADA') {
      throw new CanjeImposible(
        'La propuesta ya esta aprobada y es inmutable; un cambio va como adenda.',
      )
    }
    if (prop.codigo_texto == null) {
      await client.query('rollback')
      return false
    }
    await quitarCanjeEnTx(client, propuestaId, tenant)
    await client.query('commit')
    return true
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

/** La decisión de un gerente. El motivo solo existe al rechazar. */
export type Decision = { decision: 'APROBAR' } | { decision: 'RECHAZAR'; motivo: string }

/**
 * ⚠️ APRUEBA O RECHAZA EL CUPÓN PENDIENTE DE UNA PROPUESTA.  COD-03.
 *
 * Quién puede llamarla lo decide la ruta (`exigir('comercial','aprobar')`);
 * aquí se decide SOBRE QUÉ: solo un cupón PENDIENTE de una propuesta de esta
 * organización que no esté aprobada. `null` = no existe aquí (→ 404, y no 403:
 * decir «existe pero no es tuyo» ya cuenta algo de otra empresa).
 *
 * La fila se lee BLOQUEADA y el `update` de APROBAR repite
 * `and codigo_estado='PENDIENTE'` en el `where`: dos gerentes decidiendo a la
 * vez, o un gerente aprobando mientras el cliente acepta, se serializan aquí,
 * y el segundo lee el estado que dejó el primero.
 *
 * Quién aprobó sale de la SESIÓN (`usuarioActual()`), nunca del cuerpo: si
 * viajara en la petición, cualquiera firmaría la aprobación con el nombre de
 * su gerente.
 *
 * RECHAZAR reutiliza `quitarCanjeEnTx`: el cupón se va y el uso VUELVE, igual
 * que si lo quitara el vendedor. Lo que cambia es que el MOTIVO queda escrito.
 */
export async function decidirCodigo(
  propuestaId: string,
  d: Decision,
): Promise<{ decision: Decision['decision']; codigo: string; descuentoPct: number } | null> {
  const tenant = await tenantActual()
  const usuario = await usuarioActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    const prop = (
      await client.query(
        `select estatus, folio, nombre, codigo_texto, codigo_descuento_pct, codigo_estado
           from propuestas where id=$1 and tenant_id=$2 for no key update`,
        [propuestaId, tenant],
      )
    ).rows[0]
    if (!prop) {
      await client.query('rollback')
      return null
    }
    const motivo = motivoDecisionImposible({
      estatus: String(prop.estatus),
      codigoEstado: estadoCodigoDeFila(prop),
    })
    if (motivo) throw new DecisionImposible(motivo)

    const codigo = String(prop.codigo_texto)
    const pct = Number(prop.codigo_descuento_pct)
    if (d.decision === 'APROBAR') {
      const upd = await client.query(
        `update propuestas
            set codigo_estado='APROBADO', codigo_aprobado_por=$3, codigo_aprobado_en=now()
          where id=$1 and tenant_id=$2 and codigo_estado='PENDIENTE'
          returning id`,
        [propuestaId, tenant, usuario?.id ?? null],
      )
      // Con la fila bloqueada esto no debería pasar; si pasa, alguien cambió el
      // estado por otro camino y lo honesto es no decir «aprobado».
      if (!upd.rows.length) throw new DecisionImposible('El codigo cambio mientras se aprobaba; recarga.')
      await anotar(client, tenant, usuario, textoAprobacion(codigo, pct), entidadDe(prop, propuestaId))
    } else {
      await quitarCanjeEnTx(client, propuestaId, tenant)
      await anotar(client, tenant, usuario, textoRechazo(codigo, d.motivo), entidadDe(prop, propuestaId))
    }
    await client.query('commit')
    return { decision: d.decision, codigo, descuentoPct: pct }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

/**
 * El cupón de una propuesta como lo lee la pantalla INTERNA: qué código, en
 * qué estado y quién lo aprobó. `null` = la propuesta no es de esta
 * organización.
 *
 * El nombre del aprobador sale por `left join` con `usuarios` y la segunda
 * capa `u.tenant_id = p.tenant_id`: un id de usuario de otra organización no
 * puede ponerle nombre a una aprobación de ésta.
 */
export async function leerCodigoDePropuesta(propuestaId: string): Promise<{
  estatus: string
  codigoTexto: string | null
  codigoDescuentoPct: number
  codigoEstado: EstadoCodigo | null
  codigoAprobadoPor: string | null
  codigoAprobadoEn: string | null
} | null> {
  const tenant = await tenantActual()
  const r = await q1<any>(
    `select p.estatus, p.codigo_texto, p.codigo_descuento_pct, p.codigo_estado,
            u.nombre as aprobado_por_nombre, p.codigo_aprobado_en
       from propuestas p
       left join usuarios u on u.id = p.codigo_aprobado_por and u.tenant_id = p.tenant_id
      where p.id = $1 and p.tenant_id = $2`,
    [propuestaId, tenant],
  )
  if (!r) return null
  const estado = estadoCodigoDeFila(r)
  return {
    estatus: String(r.estatus),
    codigoTexto: r.codigo_texto ?? null,
    codigoDescuentoPct: Number(r.codigo_descuento_pct ?? 0),
    codigoEstado: estado,
    codigoAprobadoPor: estado === 'APROBADO' ? (r.aprobado_por_nombre ?? null) : null,
    codigoAprobadoEn:
      r.codigo_aprobado_en instanceof Date
        ? r.codigo_aprobado_en.toISOString()
        : (r.codigo_aprobado_en ?? null),
  }
}
