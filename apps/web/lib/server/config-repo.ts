import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/config-repo.ts — Configuración del negocio. UNA FILA POR TENANT
//  (ADR 0011). Se lee desde /api/config (admin) y desde /api/estado (todos los
//  roles) para que el logo, IVA y parámetros de loop/spot estén disponibles en
//  toda la app.
//
//  Hasta el 05/08/2026 era una fila GLOBAL compartida por las cinco
//  organizaciones, y `PATCH /api/config` escribía sobre ella: cambiar tu IVA se
//  lo cambiaba a todo el mundo, desde una pantalla normal y sin dejar rastro.
//
//  El nombre de la organización NO vive aquí: es `tenants.nombre`. Estaba
//  duplicado en `config_negocio.nombre_tenant`, con obtenerConfig() pisándolo y
//  obtenerConfigAdmin() no — de ahí que el sidebar dijera «G500» y
//  Configuración «RGB Catorce» (M5).
// ============================================================================

export function rowToConfig(r: any) {
  return {
    // Lo rellenan obtenerConfig()/…Admin() desde `tenants.nombre`: la columna
    // `nombre_tenant` ya no existe (ADR 0011).
    nombreTenant: '',
    // razón social / nombre comercial son POR TENANT (viven en `tenants`); aquí
    // van como placeholder null y se resuelven en obtenerConfig()/…Admin().
    razonSocial: null as string | null,
    nombreComercial: null as string | null,
    // Datos fiscales: también POR tenant. Solo los rellena obtenerConfigAdmin().
    rfc: null as string | null,
    domicilioFiscal: null as string | null,
    representanteLegal: null as string | null,
    datosConstitucion: null as string | null,
    moneda: r.moneda,
    plazosCobranza: r.plazos_cobranza ?? [],
    logoUrl: r.logo_url ?? null,
    // Correo de la organización para los avisos de OPERACIÓN. Viaja como
    // Reply-To; el From es el buzón verificado de la plataforma. null = sin
    // configurar, que es como nace toda organización.
    emailRemitente: r.email_remitente ?? null,
    ivaTasas: (r.iva_tasas ?? [16]).map((x: any) => Number(x)),
    loopSeg: r.loop_seg != null ? Number(r.loop_seg) : 60,
    spotSeg: r.spot_seg != null ? Number(r.spot_seg) : 10,
    // ADR 0008: cupo de clientes por defecto. null = sin límite (regla apagada).
    maxClientesPantalla: r.max_clientes_pantalla != null ? Number(r.max_clientes_pantalla) : null,
  }
}

// La fila de ESTE tenant. El filtro explícito por `tenant_id` es la segunda
// capa: la RLS ya lo acota, pero si algún día la app conectara con un rol
// BYPASSRLS esto sigue aislando — mismo criterio que usuarios-repo.
//
// Si falta la fila se crea con los DEFAULT de la tabla. Antes se sembraba con
// el literal 'RGB Catorce', así que una organización nueva nacía llamándose
// como otra empresa hasta que alguien lo notara.
export async function obtenerConfigRow() {
  const tenantId = await tenantActual()
  let r = await q1<any>('select * from config_negocio where tenant_id = $1', [tenantId])
  if (!r) {
    r = (await q<any>('insert into config_negocio (tenant_id) values ($1) returning *', [tenantId]))[0]
  }
  return r
}

export async function obtenerConfig() {
  const cfg = rowToConfig(await obtenerConfigRow())
  // Identidad de la organización: siempre de `tenants`. Es la ÚNICA fuente
  // (ADR 0011), así que esto ya no «pisa» un valor rival — lo rellena.
  const t = await q1<any>(
    'select nombre, razon_social, nombre_comercial from tenants where id = $1',
    [await tenantActual()],
  )
  cfg.nombreTenant = t?.nombre ?? ''
  cfg.razonSocial = t?.razon_social ?? null
  cfg.nombreComercial = t?.nombre_comercial ?? null
  // El correo de avisos NO se reparte por /api/estado: ninguna pantalla del
  // shell lo necesita y lo consume el servidor (el cron lo lee de la base, no
  // de aquí). Mismo criterio que los datos fiscales — solo sale por
  // /api/config, que ya exige permiso de `administracion`.
  cfg.emailRemitente = null
  return cfg
}

// Config para el panel de Administración: la del tenant + su identidad y datos
// fiscales, que viven en `tenants`.
//
// Antes esta función NO rellenaba `nombreTenant` a propósito, «porque ese campo
// se edita contra config_negocio» — y por eso Configuración enseñaba el nombre
// global mientras el sidebar enseñaba el del tenant. Ahora las dos leen
// `tenants.nombre`, así que no pueden discrepar.
//
// Los datos fiscales SOLO salen por aquí (panel de Administración, que ya exige
// permiso `administracion`). Son los que el generador del contrato recita en las
// declaraciones de la parte arrendataria; sin ellos el documento sale con huecos
// y no se puede enviar a firma (ver lib/contrato-documento.ts → `faltantes`).
export async function obtenerConfigAdmin() {
  const cfg = rowToConfig(await obtenerConfigRow())
  const t = await q1<any>(
    `select nombre, razon_social, nombre_comercial, rfc, domicilio_fiscal,
            representante_legal, datos_constitucion
       from tenants where id = $1`,
    [await tenantActual()],
  )
  cfg.nombreTenant = t?.nombre ?? ''
  cfg.razonSocial = t?.razon_social ?? null
  cfg.nombreComercial = t?.nombre_comercial ?? null
  cfg.rfc = t?.rfc ?? null
  cfg.domicilioFiscal = t?.domicilio_fiscal ?? null
  cfg.representanteLegal = t?.representante_legal ?? null
  cfg.datosConstitucion = t?.datos_constitucion ?? null
  return cfg
}
