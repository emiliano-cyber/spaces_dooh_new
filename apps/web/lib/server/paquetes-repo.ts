import 'server-only'
import { q, q1, pool, fijarTenant } from './db'
import { tenantActual } from './tenant'
import { usuarioActual } from './auth'
import { topeDescuentoDelTenant } from './config-repo'
import { descuentoDentroDelTope, DescuentoSobreTope } from '@/lib/descuento'
import { volumenDeLineas } from '@/lib/volumen'

// ============================================================================
//  lib/server/paquetes-repo.ts — El catálogo de PAQUETES CERRADOS de la
//  organización y su aplicación a una propuesta.  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL vive
//  aquí, siempre parametrizado, y toda operación por `id` lleva
//  `and tenant_id = $n` como segunda capa sobre la RLS.
//
//  ─── POR QUÉ ESA SEGUNDA CAPA IMPORTA MÁS AQUÍ QUE EN NINGUNA FASE ───────
//  El modo de fallo de R2 no da error, y con un paquete es el peor de los
//  cuatro escalones. Un cupón ajeno canjeado le gasta un uso a otra empresa;
//  un paquete ajeno aplicado **le pone a tu venta el tarifario de otra
//  empresa** — 180 000 donde tu organización cobraría 400 000, con la propuesta
//  perfectamente coherente consigo misma y contestando 200 OK.
//
//  ─── EL PRECIO SE COPIA, NO SE REFERENCIA ────────────────────────────────
//  Al aplicar un paquete, su nombre, su precio, su bandera y su composición se
//  COPIAN a `propuestas`. A partir de ese instante la venta no depende del
//  catálogo: cambiar, desactivar o borrar el paquete mañana no mueve un peso.
//  Es la misma decisión que tomó el cupón en la Fase 3 y es el invariante 4 del
//  ADR 0039 — el que decide si esta fase está bien hecha.
//
//  Lo que sí referencia es el ENLACE VIVO (`paquete_aplicaciones`), que se va
//  en cascada con el paquete. Separar las dos cosas es lo que permite que
//  borrar un paquete limpie lo vivo sin tocar lo congelado.
// ============================================================================

/** Un paquete como lo ve la pantalla de configuración, con su composición. */
export type PaqueteFila = {
  id: string
  nombre: string
  precioCerrado: number
  admiteCodigo: boolean
  activo: boolean
  notas: string | null
  sitios: string[]
  /** En cuántas propuestas está aplicado AHORA MISMO (enlaces vivos). */
  aplicadoEn: number
}

// `pg` devuelve `numeric` como CADENA ('180000.00'). Sin esta conversión el
// precio llegaría al reparto como texto y `Math.floor('180000.00' * w / W)`
// funcionaría por casualidad hasta el día que no.
const aPaquete = (r: any): PaqueteFila => ({
  id: String(r.id),
  nombre: String(r.nombre),
  precioCerrado: Number(r.precio_cerrado),
  admiteCodigo: r.admite_codigo === true,
  activo: r.activo !== false,
  notas: r.notas ?? null,
  sitios: Array.isArray(r.sitios) ? r.sitios.filter(Boolean).map(String) : [],
  aplicadoEn: Number(r.aplicado_en ?? 0),
})

const SEL_PAQUETE = `p.id, p.nombre, p.precio_cerrado, p.admite_codigo, p.activo, p.notas,
        coalesce((select array_agg(ps.sitio_id order by ps.creado_en)
                    from paquete_sitios ps
                   where ps.paquete_id = p.id and ps.tenant_id = p.tenant_id), '{}') as sitios,
        (select count(*) from paquete_aplicaciones pa
          where pa.paquete_id = p.id and pa.tenant_id = p.tenant_id) as aplicado_en`

/**
 * Los paquetes de la organización.
 *
 * NO acepta ningún argumento, y eso es el candado: el tenant sale de la RLS,
 * que la fija `db.ts` con el de la sesión. Si aceptara un `tenantId` se podría
 * leer el tarifario de conjunto de otra organización — y en esta fase eso no es
 * una fuga de lectura, es un precio ajeno listo para aplicar a una venta propia.
 */
export async function listarPaquetes(): Promise<PaqueteFila[]> {
  const filas = await q<any>(
    `select ${SEL_PAQUETE} from paquetes p order by p.activo desc, lower(p.nombre) asc`,
  )
  return filas.map(aPaquete)
}

/** Motivo de negocio por el que una operación con paquetes no se puede hacer. */
export class PaqueteImposible extends Error {}

/**
 * Alta o edición de un paquete, CON su composición, en una sola transacción.
 *
 * La composición se reescribe entera (borrar + insertar) y no se intenta un
 * diff: son un puñado de filas, y un diff mal hecho dejaría una pantalla dentro
 * del paquete que el dueño creyó haber quitado — un fallo que no da error y que
 * solo se ve al mirar el reparto de la siguiente venta.
 *
 * El `tenant_id` sale SIEMPRE de `tenantActual()`, nunca del argumento: si
 * viajara en el cuerpo, cualquiera podría escribir el tarifario de otra
 * organización con un `curl`, y la fila escrita sería coherente consigo misma,
 * así que el `with check` de la RLS la aprobaría sin rechistar.
 *
 * Devuelve `null` si el `id` no es de esta organización — que desde aquí dentro
 * es lo mismo que «no existe», y por eso el controller lo convierte en 404 y no
 * en 403: decir «existe pero no es tuyo» ya cuenta algo de otra organización.
 *
 * ⚠️ EDITAR UN PAQUETE NO MUEVE NINGUNA VENTA. Ni una en borrador, ni una
 * aprobada: el precio ya está copiado en cada propuesta que lo aplicó. Lo único
 * que cambia es lo que costará la PRÓXIMA vez que alguien lo aplique. Es a
 * propósito y es el invariante 4 del ADR 0039.
 */
export async function guardarPaquete(p: {
  id?: string
  nombre: string
  precioCerrado: number
  admiteCodigo: boolean
  activo: boolean
  notas?: string | null
  sitios: string[]
}): Promise<PaqueteFila | null> {
  const tenant = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    let id = p.id ?? null
    if (id) {
      const upd = (
        await client.query(
          `update paquetes
              set nombre=$3, precio_cerrado=$4, admite_codigo=$5, activo=$6, notas=$7
            where id=$1 and tenant_id=$2 returning id`,
          [id, tenant, p.nombre, p.precioCerrado, p.admiteCodigo, p.activo, p.notas ?? null],
        )
      ).rows[0]
      if (!upd) {
        await client.query('rollback')
        return null
      }
    } else {
      id = (
        await client.query(
          `insert into paquetes (tenant_id, nombre, precio_cerrado, admite_codigo, activo, notas)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [tenant, p.nombre, p.precioCerrado, p.admiteCodigo, p.activo, p.notas ?? null],
        )
      ).rows[0].id
    }
    await client.query('delete from paquete_sitios where paquete_id=$1 and tenant_id=$2', [
      id,
      tenant,
    ])
    for (const sitioId of p.sitios) {
      // La FK COMPUESTA `(sitio_id, tenant_id)` es lo que impide meter la
      // pantalla de otra organización en un paquete propio. No se valida aquí
      // además: una validación es algo que alguien puede olvidar en la
      // siguiente ruta, y la restricción no.
      await client.query(
        'insert into paquete_sitios (tenant_id, paquete_id, sitio_id) values ($1,$2,$3)',
        [tenant, id, sitioId],
      )
    }
    await client.query('commit')
    const fila = await q1<any>(
      `select ${SEL_PAQUETE} from paquetes p where p.id=$1 and p.tenant_id=$2`,
      [id, tenant],
    )
    return fila ? aPaquete(fila) : null
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

/**
 * Borra un paquete. `false` = no existe en esta organización.
 *
 * Borrado REAL, no lógico, y es seguro por construcción: el precio de toda
 * venta que lo usó ya está copiado en su propia propuesta. Lo que se va en
 * cascada es la composición y los enlaces vivos, que son presupuesto del
 * paquete y no precio de nadie.
 *
 * Existe además `activo`, que es otra cosa: un paquete desactivado deja de
 * poder venderse pero conserva su definición, que es lo que se quiere para una
 * promoción de temporada. Borrar es para lo que se capturó por error.
 */
export async function borrarPaquete(id: string): Promise<boolean> {
  const tenant = await tenantActual()
  const fila = await q1<any>('delete from paquetes where id=$1 and tenant_id=$2 returning id', [
    id,
    tenant,
  ])
  return !!fila
}

/** Lo que devuelve aplicar un paquete: el precio congelado y con qué pantallas. */
export type PaqueteAplicacion = {
  nombre: string
  precio: number
  admiteCodigo: boolean
  composicion: string[]
}

/**
 * Aplica un paquete a una propuesta y **CONGELA SU PRECIO EN ELLA**.
 *
 * ═══ EL ORDEN DE LAS COMPROBACIONES ES EL MECANISMO ═════════════════════════
 *
 *  0. La propuesta existe, es de esta organización y NO está aprobada. Una
 *     propuesta aprobada es inmutable: su precio ya está congelado y el cliente
 *     lo aceptó. Aplicarle un paquete después cambiaría un documento firmado —
 *     y aquí no cambiaría un porcentaje sobre él, cambiaría el importe entero.
 *  1. El paquete existe AQUÍ y está activo. `and tenant_id = $n` es lo que hace
 *     que el paquete de otra organización sencillamente no exista.
 *  2. Un solo paquete por propuesta. Se comprueba para poder decir una frase; el
 *     `unique (propuesta_id)` de `paquete_aplicaciones` es lo que de verdad lo
 *     impide, y es lo único que sirve contra un doble clic.
 *  3. REGLA 2 DEL ADR: si el paquete no admite código y la propuesta ya tiene
 *     uno, se NIEGA. Dejarlo pasar dejaría un cupón con su uso retenido y sin
 *     descontar nada — el vendedor le prometió un 20 % a un cliente y el
 *     sistema no se lo da, sin decir por qué.
 *  4. Las pantallas de la propuesta tienen que ser LAS DEL PAQUETE. Sin esto,
 *     «Paquete Periférico» a 180 000 se podría aplicar a una sola pantalla, y
 *     eso no es vender un conjunto: es poner un precio a dedo saltándose la
 *     rejilla, el volumen y el tope de descuento de golpe.
 *
 * Y entonces se copian las cinco columnas JUNTAS. El CHECK
 * `propuestas_paquete_pareja_ck` rechazaría dejar una sin las otras, a
 * propósito: un precio sin nombre es un importe que nadie puede auditar.
 */
export async function aplicarPaquete(
  propuestaId: string,
  paqueteId: string,
): Promise<PaqueteAplicacion> {
  const tenant = await tenantActual()
  const usuarioId = (await usuarioActual())?.id ?? null

  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)

    // ── 0 · la propuesta existe, es de aquí y NO está aprobada ─────────────
    const prop = (
      await client.query(
        // 2026-10-05 · `for no key update`, el MISMO bloqueo con el que lee el
        // canje de un cupón (`codigos-repo.ts`). Sin él, la regla 2 de abajo
        // tenía una carrera: este paso leía «sin cupón» mientras un canje en
        // vuelo leía «sin paquete», confirmaban los dos, y la propuesta
        // quedaba con un paquete de precio final y un uso del cupón gastado
        // que no descuenta nada. Con el bloqueo, quien llega segundo espera y
        // lee lo que el primero dejó.
        `select estatus, codigo_texto, paquete_nombre from propuestas
          where id=$1 and tenant_id=$2 for no key update`,
        [propuestaId, tenant],
      )
    ).rows[0]
    if (!prop) throw new PaqueteImposible('Esa propuesta no existe en esta organizacion.')
    if (prop.estatus === 'APROBADA') {
      throw new PaqueteImposible(
        'La propuesta ya esta aprobada y es inmutable; un cambio va como adenda.',
      )
    }

    // ── 1 · el paquete existe AQUÍ y está activo ───────────────────────────
    const paq = (
      await client.query(
        `select id, nombre, precio_cerrado, admite_codigo, activo
           from paquetes where id=$1 and tenant_id=$2`,
        [paqueteId, tenant],
      )
    ).rows[0]
    if (!paq) throw new PaqueteImposible('Ese paquete no existe en esta organizacion.')
    if (paq.activo === false) {
      throw new PaqueteImposible(
        `El paquete "${paq.nombre}" esta desactivado y no se puede vender. Actívalo si toca.`,
      )
    }

    // ── 2 · un solo paquete por propuesta ──────────────────────────────────
    if (prop.paquete_nombre != null) {
      throw new PaqueteImposible(
        `Esta propuesta ya tiene el paquete "${prop.paquete_nombre}". Quitalo antes de poner otro.`,
      )
    }

    // ── 3 · REGLA 2 · el paquete es precio final ───────────────────────────
    const admiteCodigo = paq.admite_codigo === true
    if (!admiteCodigo && prop.codigo_texto != null) {
      throw new PaqueteImposible(
        `El paquete "${paq.nombre}" es precio final y no admite codigos promocionales. ` +
          `Quita el codigo "${prop.codigo_texto}" antes de aplicarlo, o usa un paquete que si los admita.`,
      )
    }

    // ── 4 · las pantallas de la propuesta son las del paquete ──────────────
    const composicion = (
      await client.query(
        `select sitio_id from paquete_sitios
          where paquete_id=$1 and tenant_id=$2 order by creado_en asc`,
        [paqueteId, tenant],
      )
    ).rows.map((r: any) => String(r.sitio_id))
    const enPropuesta = (
      await client.query(
        'select sitio_id from propuesta_items where propuesta_id=$1 and tenant_id=$2',
        [propuestaId, tenant],
      )
    ).rows.map((r: any) => String(r.sitio_id))
    const faltan = composicion.filter((s) => !enPropuesta.includes(s))
    const sobran = enPropuesta.filter((s) => !composicion.includes(s))
    if (faltan.length || sobran.length) {
      throw new PaqueteImposible(
        `El paquete "${paq.nombre}" se vende con ${composicion.length} pantalla(s) exactas, y esta ` +
          `propuesta tiene ${enPropuesta.length}` +
          (faltan.length ? `; le faltan ${faltan.length}` : '') +
          (sobran.length ? `; le sobran ${sobran.length}` : '') +
          '. Ajusta las pantallas de la propuesta o edita la definicion del paquete.',
      )
    }

    // El ENLACE VIVO. Se va en cascada con el paquete; el precio no.
    await client.query(
      `insert into paquete_aplicaciones (tenant_id, paquete_id, propuesta_id, usuario_id)
       values ($1,$2,$3,$4)`,
      [tenant, paqueteId, propuestaId, usuarioId],
    )

    // ── EL CONGELADO ───────────────────────────────────────────────────────
    // Las cinco columnas se escriben JUNTAS. `now()` sale de Postgres —el mismo
    // reloj que registró el enlace—, no de Node: con `next dev`, `new Date()`
    // sería el reloj de quien desarrolla.
    const precio = Number(paq.precio_cerrado)
    await client.query(
      `update propuestas
          set paquete_nombre=$3, paquete_precio=$4, paquete_admite_codigo=$5,
              paquete_aplicado_en=now(), paquete_composicion=$6::jsonb
        where id=$1 and tenant_id=$2`,
      [propuestaId, tenant, String(paq.nombre), precio, admiteCodigo, JSON.stringify(composicion)],
    )

    await client.query('commit')
    return { nombre: String(paq.nombre), precio, admiteCodigo, composicion }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

/**
 * Quita el paquete de una propuesta y **DEVUELVE LOS PRECIOS DE LÍNEA**.
 *
 * Y los devuelve enteros, con su descuento por volumen incluido: al aplicar el
 * paquete no se borró nada de las líneas, solo se dejó de aplicar. Ése es el
 * motivo por el que el volumen se anula en el CÁLCULO (`armarPropuesta`) y no
 * en la BASE — anularlo en la base haría este camino irreversible.
 *
 * `false` = esa propuesta no existe aquí o no tenía paquete.
 *
 * ═══ TOPE-PAQ · y por eso SE NIEGA si el volumen devuelto pasa el tope ═════
 * Con paquete el volumen no cuenta contra el tope (PAQ-01, en
 * `actualizarPropuesta`), así que el vendedor pudo guardar un comercial que
 * SOLO cabía porque el volumen estaba apagado. Al quitar el paquete el volumen
 * vuelve, y hasta TOPE-03 (05/10) no lo revisaban ni `cambiarEstatusPropuesta`
 * ni `aceptarPropuestaPublica` (hoy sí, pero tarde). Tope 20, vol 10, com 15 →
 * 23,5 % aprobado y congelado en el snapshot por encima de lo autorizado.
 *
 * Se cierra AQUÍ y no en la aprobación por el criterio de TOPE-01: por encima
 * del tope no se guarda nada. Revalidar al aprobar no cubriría la aceptación
 * del cliente por la liga, y dejaría enviada una propuesta que no se puede
 * firmar. Misma función que la edición —`descuentoDentroDelTope`— para que la
 * política (qué capas cuentan) siga viviendo en un solo sitio.
 */
export async function quitarPaquete(propuestaId: string): Promise<boolean> {
  const tenant = await tenantActual()
  // Fuera de la transacción, igual que en `actualizarPropuesta`: es una
  // lectura de configuración con contexto de tenant, no parte del cambio.
  const tope = await topeDescuentoDelTenant()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // `for no key update`: el descuento comercial que se valida abajo no puede
    // cambiar entre esta lectura y el commit. Ojo, cubre UN lado de la carrera:
    // `actualizarPropuesta` lee sin bloqueo, así que una edición que leyó el
    // paquete vivo antes de este commit aún podría escribir después un
    // comercial que ya no cabe. Es una ventana de milisegundos con dos personas
    // tocando la misma propuesta; cerrarla del todo es bloquear también allí.
    const prop = (
      await client.query(
        `select estatus, paquete_nombre, descuento_pct, codigo_descuento_pct
           from propuestas where id=$1 and tenant_id=$2 for no key update`,
        [propuestaId, tenant],
      )
    ).rows[0]
    if (!prop) {
      await client.query('rollback')
      return false
    }
    if (prop.estatus === 'APROBADA') {
      throw new PaqueteImposible(
        'La propuesta ya esta aprobada y es inmutable; un cambio va como adenda.',
      )
    }
    if (prop.paquete_nombre == null) {
      await client.query('rollback')
      return false
    }

    // ── TOPE-PAQ · el volumen vuelve: ¿cabe el comercial con él? ───────────
    // Con 0 % comercial no se valida: no hay discreción del vendedor que
    // acotar, la propuesta queda igual que una recién creada con esas líneas
    // —que `crearPropuesta` admite— y negarse dejaría el paquete pegado sin
    // salida. Si el volumen SOLO pasa el tope, es el tope por debajo de la
    // escala propia, y eso se arregla en Administración (VOL-02).
    const comercial = Number(prop.descuento_pct ?? 0)
    if (comercial > 0) {
      const lineas = (
        await client.query(
          `select precio, descuento_volumen_pct from propuesta_items
            where propuesta_id=$1 and tenant_id=$2`,
          [propuestaId, tenant],
        )
      ).rows
      const volumenPct = volumenDeLineas(
        lineas.map((l: any) => ({
          precio: Number(l.precio),
          descuentoVolumenPct: Number(l.descuento_volumen_pct ?? 0),
        })),
      ).volumenPctEfectivo
      try {
        // Sin paquete el cupón vuelve a descontar siempre, así que pasa entero
        // (y hoy `CODIGO_CUENTA_CONTRA_TOPE` lo anula igualmente).
        descuentoDentroDelTope(comercial, tope, volumenPct, Number(prop.codigo_descuento_pct ?? 0))
      } catch (e) {
        if (!(e instanceof DescuentoSobreTope)) throw e
        throw new PaqueteImposible(
          `No se puede quitar el paquete "${prop.paquete_nombre}": sin el paquete vuelve a ` +
            `aplicarse el descuento por volumen de las lineas. ${e.message} ` +
            'Baja primero el descuento comercial y vuelve a quitar el paquete.',
        )
      }
    }

    await client.query('delete from paquete_aplicaciones where propuesta_id=$1 and tenant_id=$2', [
      propuestaId,
      tenant,
    ])
    // Las cinco columnas se limpian JUNTAS. El CHECK
    // `propuestas_paquete_pareja_ck` rechazaría dejar una sin las otras.
    await client.query(
      `update propuestas
          set paquete_nombre=null, paquete_precio=null, paquete_admite_codigo=false,
              paquete_aplicado_en=null, paquete_composicion=null
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
