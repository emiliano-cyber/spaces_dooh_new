import 'server-only'

// ============================================================================
//  lib/server/integraciones.ts — Capa de conectores externos.
//  En el demo NO hay credenciales reales: cada adaptador detecta si su variable
//  de entorno está configurada; si no, opera en "modo demo" devolviendo datos
//  simulados y marcando `simulado: true`. Para producción basta con definir las
//  env vars y reemplazar el cuerpo simulado por la llamada real al proveedor.
// ============================================================================

// Lo que viaja al navegador. NO lleva el nombre de la variable de entorno: la
// pantalla de Integraciones lo imprimía tal cual (ADMOBILIZE_API_KEY,
// CMS_API_TOKEN, CFDI_PAC_KEY) y eso es inventario de infraestructura regalado
// a cualquiera que abra la página — B8 de la auditoría del 04/08/2026. Saber
// QUÉ variable falta le sirve a quien despliega, no a quien usa el producto, y
// ése ya tiene .env.example.
export interface EstadoIntegracion {
  clave: string
  nombre: string
  descripcion: string
  configurado: boolean
}

// El nombre de la variable se queda de este lado del muro: es la llave del
// lookup, no un dato de presentación.
const ENV_VAR: Record<string, string> = {
  admobilize: 'ADMOBILIZE_API_KEY',
  cms: 'CMS_API_TOKEN',
  cfdi: 'CFDI_PAC_KEY',
}

// TODO (seguridad): hoy las credenciales se leen de variables de entorno (no hay
// almacén en BD). Cuando se construya un almacén de credenciales por tenant,
// debe cifrarse en reposo (AES con llave en secreto, nunca en el repo).
export function estadoIntegraciones(): EstadoIntegracion[] {
  const def = (clave: string) => !!process.env[ENV_VAR[clave]]
  return [
    {
      clave: 'admobilize',
      nombre: 'AdMobilize (Computer Vision)',
      descripcion: 'Conteo de audiencia y vehículos por dispositivo de visión.',
      configurado: def('admobilize'),
    },
    {
      clave: 'cms',
      nombre: 'CMS / players DOOH',
      descripcion: 'Publicar contenido y traer proof-of-play (Broadsign, Doohmain, etc.).',
      configurado: def('cms'),
    },
    {
      clave: 'cfdi',
      nombre: 'Facturación fiscal (CFDI / SUNAT)',
      descripcion: 'Timbrado fiscal de facturas por país (PAC en MX / SUNAT en PE).',
      configurado: def('cfdi'),
    },
  ]
}

// Número determinista (sin Math.random) derivado de una cadena, para que los
// datos simulados sean estables por dispositivo.
function hashNum(s: string, mod: number) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_000
  return h % mod
}

// AdMobilize: métricas de audiencia. Real si hay API key; si no, simuladas.
export async function metricasAdmobilize(deviceId: string) {
  const key = deviceId || 'demo'
  if (!process.env.ADMOBILIZE_API_KEY) {
    return {
      simulado: true,
      deviceId,
      vehiculos: 1800 + hashNum(key, 1500),
      personas: 600 + hashNum(key + 'p', 900),
      velocidadPromedioKmh: 25 + hashNum(key + 'v', 25),
      ventana: 'última hora',
    }
  }
  // TODO producción: fetch a la API de AdMobilize con la API key.
  return { simulado: false, deviceId, vehiculos: 0, personas: 0, velocidadPromedioKmh: 0, ventana: 'real' }
}

// CMS: publicar / proof-of-play (stub).
export async function publicarEnCms(reservaId: string) {
  if (!process.env.CMS_API_TOKEN) {
    return { simulado: true, reservaId, estado: 'PUBLICADO (demo)', proofOfPlay: `pop-${hashNum(reservaId, 99999)}` }
  }
  return { simulado: false, reservaId, estado: 'PUBLICADO', proofOfPlay: null }
}

// CFDI/SUNAT: timbrar una factura (stub → devuelve el folio fiscal ya generado).
export async function timbrarFactura(facturaId: string, folioFiscal: string | null) {
  if (!process.env.CFDI_PAC_KEY) {
    return { simulado: true, facturaId, uuid: folioFiscal, timbrado: false, nota: 'Folio fiscal simulado (sin PAC)' }
  }
  return { simulado: false, facturaId, uuid: folioFiscal, timbrado: true, nota: 'Timbrado por PAC' }
}
