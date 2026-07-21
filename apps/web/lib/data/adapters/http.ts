// ============================================================================
//  lib/data/adapters/http.ts — STUB del DataAdapter contra el backend Fastify
// ----------------------------------------------------------------------------
//  Implementa EXACTAMENTE la misma interfaz que `mock.ts` (el tipo MockAdapter
//  obliga a que las firmas coincidan al compilar). Hoy todos los métodos lanzan
//  "no implementado": la demo corre 100% con el mock.
//
//  Este adapter quedó como andamiaje histórico: apuntaba al Fastify que se
//  archivó en /_archive/api (Bloque G). El backend vivo es el BFF y las
//  pantallas hablan con él por los helpers `*-api.ts`, no por este adapter.
// ============================================================================

import type { MockAdapter } from './mock'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function noImpl(metodo: string): never {
  throw new Error(
    `httpAdapter.${metodo}() no implementado todavía. ` +
      `Conectar contra ${BASE} post-junta (ver lib/data/adapters/http.ts).`,
  )
}

export const httpAdapter: MockAdapter = {
  getSitios: () => noImpl('getSitios'),
  getSitio: () => noImpl('getSitio'),
  getArrendadores: () => noImpl('getArrendadores'),
  getContratos: () => noImpl('getContratos'),
  getPagosRenta: () => noImpl('getPagosRenta'),
  getIncidencias: () => noImpl('getIncidencias'),
  getClientes: () => noImpl('getClientes'),
  getCampanas: () => noImpl('getCampanas'),
  getCampana: () => noImpl('getCampana'),
  getCampanaPorToken: () => noImpl('getCampanaPorToken'),
  getReservas: () => noImpl('getReservas'),
  getOrdenesTrabajo: () => noImpl('getOrdenesTrabajo'),
  getOT: () => noImpl('getOT'),
  getEvidencias: () => noImpl('getEvidencias'),
  getOrdenesImpresion: () => noImpl('getOrdenesImpresion'),
  getCreatividades: () => noImpl('getCreatividades'),
  getFacturas: () => noImpl('getFacturas'),
  getCobranzas: () => noImpl('getCobranzas'),
  getReadiness: () => noImpl('getReadiness'),
  altaSitio: () => noImpl('altaSitio'),
  importarInventario: () => noImpl('importarInventario'),
  toggleNetwork: () => noImpl('toggleNetwork'),
  reservar: () => noImpl('reservar'),
  confirmarReserva: () => noImpl('confirmarReserva'),
  extenderCampana: () => noImpl('extenderCampana'),
  cerrarOT: () => noImpl('cerrarOT'),
  reportarIncidencia: () => noImpl('reportarIncidencia'),
  generarFactura: () => noImpl('generarFactura'),
  registrarPagoRenta: () => noImpl('registrarPagoRenta'),
  iniciarRenovacion: () => noImpl('iniciarRenovacion'),
}
