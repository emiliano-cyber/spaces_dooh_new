import bcrypt from 'bcryptjs'
import { poolTest } from './db-e2e'

// ============================================================================
//  lib/test/semillas-e2e.ts — Datos mínimos para que el flujo crítico corra.
// ----------------------------------------------------------------------------
//  Dos criterios que condicionan todo lo demás:
//
//  1) LAS FECHAS SON RELATIVAS A HOY, nunca literales. Media espina depende de
//     «hoy»: vigencia de campaña, vencimientos de cobranza, `diasHasta`, el
//     estado de un pago. Con fechas fijas la suite se pudre sola en unas semanas
//     y empieza a fallar por el calendario en vez de por el código — y una
//     prueba que falla sin motivo se acaba ignorando.
//
//  2) EL CONTRATO NACE COMPLETO. El ADR 0003 impide reservar una pantalla cuya
//     cobertura contractual esté INCOMPLETO o CANCELADO. Una semilla con el
//     contrato a medias haría fallar el flujo entero por un motivo que no es el
//     que se está probando.
// ============================================================================

export const HOY = () => new Date()
export const enDias = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export const PASSWORD_DEMO = 'Prueba1234'

export interface TenantSembrado {
  id: string
  slug: string
  nombre: string
  usuarioEmail: string
  sitioId: string
  clienteId: string
}

// Crea una organización COMPLETA y autosuficiente: su dueño, su pantalla con
// contrato completo, su cliente y su fila de configuración. Cada prueba de
// aislamiento siembra dos y comprueba que no se ven entre sí.
export async function sembrarTenant(slug: string, opts?: { rol?: string }): Promise<TenantSembrado> {
  const p = poolTest()
  const nombre = `Org ${slug.toUpperCase()}`
  const rol = opts?.rol ?? 'DUENO'

  const t = await p.query(
    `insert into tenants (nombre, slug, moneda, razon_social)
     values ($1, $2, 'MXN', $3)
     on conflict (slug) do update set nombre = excluded.nombre
     returning id`,
    [nombre, slug, `${nombre} SA de CV`],
  )
  const tenantId: string = t.rows[0].id

  // Config del tenant (ADR 0011: una fila por organización, con RLS).
  await p.query(
    `insert into config_negocio (tenant_id, moneda, iva_tasas, loop_seg, spot_seg)
     values ($1,'MXN','{16}',60,10)
     on conflict (tenant_id) do nothing`,
    [tenantId],
  )

  const email = `duenio@${slug}.test`
  await p.query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3::rol_demo,$4,true,$5)
     on conflict do nothing`,
    [`Dueño ${slug}`, email, rol, await bcrypt.hash(PASSWORD_DEMO, 4), tenantId],
  )

  // Arrendador + predio + pantalla digital + contrato COMPLETO (ADR 0003).
  const arr = await p.query(
    `insert into arrendadores (nombre, tenant_id) values ($1,$2) returning id`,
    [`Arrendador ${slug}`, tenantId],
  )
  // `predios.arrendador_id` es NOT NULL: un predio siempre es de alguien.
  const predio = await p.query(
    `insert into predios (nombre, arrendador_id, tenant_id) values ($1,$2,$3) returning id`,
    [`Predio ${slug}`, arr.rows[0].id, tenantId],
  )
  const sitio = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion)
     values ($1,$2,$3,'PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc','CDMX',12,45000,45000,$4,$5,'digital')
     returning id`,
    [`Pantalla ${slug}`, `${slug.toUpperCase()}-001`, `${slug.toUpperCase()}-PROV-001`, predio.rows[0].id, tenantId],
  )
  await p.query(
    `insert into contratos_arrendamiento
       (arrendador_id, predio_id, sitio_id, fecha_inicio, fecha_fin, monto_renta,
        periodicidad, estatus, tenant_id)
     values ($1,$2,$3,$4,$5,20000,'MENSUAL','VIGENTE',$6)`,
    [arr.rows[0].id, predio.rows[0].id, sitio.rows[0].id, enDias(-30), enDias(365), tenantId],
  )

  const cli = await p.query(
    `insert into clientes (nombre, razon_social, rfc, tipo, iva_pct, tenant_id)
     values ($1,$2,'XAXX010101000','DIRECTO',16,$3) returning id`,
    [`Cliente ${slug}`, `Cliente ${slug} SA de CV`, tenantId],
  )

  return {
    id: tenantId,
    slug,
    nombre,
    usuarioEmail: email,
    sitioId: sitio.rows[0].id,
    clienteId: cli.rows[0].id,
  }
}

// Permisos: el esquema los siembra para los roles estándar, pero `inventario`
// llegó con el ADR 0010 y schema.sql lo trae; esto es la red por si una
// instalación quedara sin ellos. Idempotente.
export async function asegurarPermisos(): Promise<void> {
  await poolTest().query(
    `insert into rol_permisos (rol, modulo, accion) values
       ('DUENO','comercial','ver'),('DUENO','comercial','crear'),('DUENO','comercial','aprobar'),
       ('DUENO','inventario','ver'),('DUENO','inventario','crear'),
       ('DUENO','finanzas','ver'),('DUENO','finanzas','crear'),('DUENO','finanzas','facturar'),
       ('DUENO','administracion','ver'),('DUENO','administracion','crear'),('DUENO','administracion','aprobar'),
       ('DUENO','arrendadores','ver'),('DUENO','arrendadores','crear'),('DUENO','arrendadores','aprobar'),
       ('DUENO','operaciones','ver'),('DUENO','operaciones','crear'),
       ('DUENO','dashboard','ver'),('DUENO','network','ver'),
       ('COMERCIAL','comercial','ver'),('COMERCIAL','comercial','crear'),
       ('COMERCIAL','inventario','ver'),('COMERCIAL','dashboard','ver')
     on conflict do nothing`,
  )
}
