// ============================================================================
//  vigilar.mjs — una pasada del vigilante.  (ADR 0026)
//
//  Lo llama el cron del PADRE. Toda la decision vive en `vigilante.mjs`; aqui
//  solo se conectan las piezas de verdad y se traduce el resultado a un codigo
//  de salida, que es lo unico que el cron sabe leer.
//
//  Sale con 1 si el aviso NO pudo mandarse. Importa: con 1, cron manda correo
//  al root de la maquina y queda en el log. Con 0 silencioso, un vigilante roto
//  parece un vigilante tranquilo.
// ============================================================================

import { join } from 'node:path'
import { vigilar, enviarPorResend, leerPrevioDe, guardarEn } from './vigilante.mjs'
import { filasDeLaFlota } from './servidor.mjs'

const DIR_ESTADO = process.env.DIR_ESTADO ?? join(process.cwd(), 'estado')
const ARCHIVO = join(DIR_ESTADO, 'vigilancia.json')

const r = await vigilar({
  config: process.env,
  obtenerFilas: () => filasDeLaFlota({ dirEstado: DIR_ESTADO }),
  leerPrevio: () => leerPrevioDe(ARCHIVO),
  guardar: (estado) => guardarEn(ARCHIVO, estado),
  enviar: (m) => enviarPorResend(m),
})

console.log(JSON.stringify({ evento: 'vigilante-flota', cuando: new Date().toISOString(), ...r }))
if (!r.ok) process.exit(1)
