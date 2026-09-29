import 'server-only'
import { q, q1, pool, fijarTenant } from './db'
import { tenantActual } from './tenant'
import { usuarioActual } from './auth'
import {
  motivoCanjeImposible,
  normalizarCodigo,
  type CodigoPromocional,
} from '@/lib/codigo-promocional'

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

/** Lo que se congela en la propuesta al canjear. */
export type CanjeHecho = { codigo: string; descuentoPct: number }

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
  const usuarioId = (await usuarioActual())?.id ?? null

  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)

    // ── 0 · la propuesta existe, es de esta organización y NO está aprobada ──
    // Una propuesta aprobada es inmutable: su precio ya está congelado en el
    // snapshot y el cliente lo aceptó. Aplicarle un cupón después cambiaría un
    // documento firmado.
    const prop = (
      await client.query(
        'select estatus, codigo_texto from propuestas where id=$1 and tenant_id=$2',
        [propuestaId, tenant],
      )
    ).rows[0]
    if (!prop) throw new CanjeImposible('Esa propuesta no existe en esta organizacion.')
    if (prop.estatus === 'APROBADA') {
      throw new CanjeImposible(
        'La propuesta ya esta aprobada y es inmutable; un cambio va como adenda.',
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
    const pct = Number(cup.descuento_pct)
    await client.query(
      `update propuestas
          set codigo_texto=$2, codigo_descuento_pct=$3, codigo_canjeado_en=now()
        where id=$1 and tenant_id=$4`,
      [propuestaId, String(cup.codigo), pct, tenant],
    )

    await client.query('commit')
    return { codigo: String(cup.codigo), descuentoPct: pct }
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
    const prop = (
      await client.query(
        'select estatus, codigo_texto from propuestas where id=$1 and tenant_id=$2',
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
    await client.query('delete from canjes_codigo where propuesta_id=$1 and tenant_id=$2', [
      propuestaId,
      tenant,
    ])
    // Los tres campos se limpian JUNTOS. El CHECK `propuestas_codigo_pareja_ck`
    // rechazaría dejar uno sin los otros, y es a propósito: un porcentaje sin su
    // código es un descuento que nadie puede auditar.
    await client.query(
      `update propuestas
          set codigo_texto=null, codigo_descuento_pct=0, codigo_canjeado_en=null
        where id=$1 and tenant_id=$2`,
      [propuestaId, tenant],
    )
    await client.query('commit')
    return true
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
