import 'server-only'
import { z } from 'zod'
import { validar } from './errores'
import { verificarCompetencia } from './vallas-controller'
import { nombreDeCliente, nombresDeSitios, datosCompetenciaDePropuesta } from './propuestas-competencia-repo'

// ============================================================================
//  lib/server/propuestas-competencia.ts — LA COMPETENCIA DE MARCAS AL CREAR
//  LA PROPUESTA (PROP-MARCA, 20/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «la validación de la competencia también debe estar al
//  crear la propuesta, con las lógicas que ya están dentro». Así que aquí NO
//  hay regla: se llama a `verificarCompetencia` (`vallas-controller.ts`), la
//  misma puerta que `POST /api/vallas/verificar`, y se traduce su resultado a
//  lo que una propuesta necesita enseñar.
//
//  Reglas del dueño que esto respeta (19/11 y 20/11):
//   · SOLO AVISA. Ninguna función de aquí lanza: si algo falla al leer o al
//     evaluar, el resultado es «sin avisos». Un aviso no puede impedir guardar
//     una propuesta, y menos un aviso que no se pudo calcular. Y el nivel sale
//     fijo en 'aviso' aunque una regla futura devolviera 'bloqueo': si algún
//     día algo debe frenar una venta, se decide aparte y a propósito.
//   · Marca vacía → cuenta el NOMBRE DEL CLIENTE, como en campañas.
//   · Solo los sitios con vallas pueden chocar (la regla trabaja sobre
//     vallas): una pantalla digital sin vallas no da aviso, y es lo correcto.
//
//  QUÉ SE ENSEÑA, y por qué tan poco: quien crea propuestas tiene
//  `comercial.crear`, no necesariamente `inventario.ver` ni las campañas de
//  los demás (el vendedor solo ve lo suyo, ADR 0051). El aviso dice la marca
//  rival, la categoría, el SITIO y las fechas —lo que hace falta para decidir—
//  y NO el id ni el nombre de la campaña rival ni su cliente.
// ============================================================================

export type AvisoCompetencia = {
  regla: string
  nivel: 'aviso'
  /** En español; la pantalla arma el suyo con los campos de abajo. */
  mensaje: string
  marca: string
  marcaExistente: string
  categoria: string
  sitioId: string | null
  sitioNombre: string | null
  inicio: string
  fin: string
}

export type EntradaCompetencia = {
  marca?: string | null
  clienteId?: string | null
  fechaInicio: string
  fechaFin: string
  sitioIds: string[]
  excluirCampanaId?: string | null
}

/** La marca que cuenta: la escrita o, si va vacía, el nombre del cliente. */
async function marcaQueCuenta(marca: string | null | undefined, clienteId: string | null | undefined) {
  const escrita = marca?.trim()
  if (escrita) return escrita
  if (!clienteId) return null
  return (await nombreDeCliente(clienteId))?.trim() || null
}

async function evaluar(marca: string, e: Omit<EntradaCompetencia, 'marca' | 'clienteId'>): Promise<AvisoCompetencia[]> {
  const r = await verificarCompetencia({
    marca,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin,
    sitioIds: e.sitioIds,
    excluirCampanaId: e.excluirCampanaId ?? null,
  })
  if (!r.hallazgos.length) return []
  const sitioDeValla = new Map(r.vallas.map((v) => [v.id, v.sitioId]))
  const sitioIds = [...new Set(r.hallazgos.map((h) => sitioDeValla.get(String(h.datos?.vallaId ?? ''))).filter(Boolean))] as string[]
  const nombres = await nombresDeSitios(sitioIds)
  const vistos = new Set<string>()
  const avisos: AvisoCompetencia[] = []
  for (const h of r.hallazgos) {
    const d = (h.datos ?? {}) as Record<string, unknown>
    const sitioId = sitioDeValla.get(String(d.vallaId ?? '')) ?? null
    const sitioNombre = sitioId ? (nombres.get(sitioId) ?? null) : null
    const marcaExistente = String(d.marcaExistente ?? '')
    const categoria = String(d.categoria ?? '')
    const inicio = String(d.inicio ?? '')
    const fin = String(d.fin ?? '')
    // Sin el id de la campaña rival en la salida, dos campañas de la misma
    // marca con las mismas fechas en el mismo sitio darían dos líneas
    // idénticas: se enseña una.
    const clave = `${sitioId}|${marcaExistente}|${inicio}|${fin}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    avisos.push({
      regla: h.regla,
      nivel: 'aviso',
      marca,
      marcaExistente,
      categoria,
      sitioId,
      sitioNombre,
      inicio,
      fin,
      mensaje: h.datos
        ? `${marca} compite con ${marcaExistente} (${categoria}) en ${sitioNombre ?? 'el mismo sitio'} del ${inicio} al ${fin}`
        : h.mensaje,
    })
  }
  return avisos
}

/** Los avisos de una propuesta que todavía no se guarda (o que se está creando). */
export async function avisosCompetencia(e: EntradaCompetencia): Promise<AvisoCompetencia[]> {
  try {
    if (!e.sitioIds.length || !e.fechaInicio || !e.fechaFin) return []
    const marca = await marcaQueCuenta(e.marca, e.clienteId)
    if (!marca) return []
    return await evaluar(marca, e)
  } catch (err) {
    // Solo avisa: un fallo aquí no puede tumbar el alta ni la pantalla.
    console.error('[avisosCompetencia] no se pudo verificar la competencia:', err)
    return []
  }
}

/** Los avisos de una propuesta YA GUARDADA, leída de la base. */
export async function avisosDePropuesta(propuestaId: string): Promise<AvisoCompetencia[]> {
  try {
    const p = await datosCompetenciaDePropuesta(propuestaId)
    if (!p || !p.marca || !p.fechaInicio || !p.fechaFin) return []
    return await avisosCompetencia({
      marca: p.marca,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      sitioIds: p.sitioIds,
      excluirCampanaId: p.campanaId,
    })
  } catch (err) {
    console.error('[avisosDePropuesta] no se pudo verificar la competencia:', err)
    return []
  }
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
const previaSchema = z
  .object({
    marca: z.string().max(120, 'La marca no puede pasar de 120 caracteres').nullish(),
    clienteId: z.string().uuid().nullish(),
    fechaInicio: fecha,
    fechaFin: fecha,
    sitioIds: z.array(z.string().uuid()).max(500),
  })
  .refine((d) => d.fechaInicio <= d.fechaFin, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  })

/** `POST /api/propuestas/competencia` · la vista previa de la pantalla de alta. */
export async function avisosCompetenciaCtrl(body: unknown): Promise<{ avisosCompetencia: AvisoCompetencia[] }> {
  const d = validar(previaSchema, body ?? {})
  return { avisosCompetencia: await avisosCompetencia(d) }
}
