// ============================================================================
//  lib/cliente-pipeline.ts — las campañas y el pipeline de UN cliente
// ----------------------------------------------------------------------------
//  Pedido del dueño (20/10): «ver en Clientes las campañas de cada cliente y su
//  pipeline». Funciones puras: la ficha del cliente
//  (components/demo/clientes/) solo las pinta, y así se prueban sin React.
//
//  ─── Qué es «pipeline» aquí, y por qué no es el de Campañas ────────────────
//  En este repositorio la palabra se usa para DOS cosas:
//
//   · El pipeline OPERATIVO de una campaña (reservada → … → facturada,
//     `ETAPAS_PIPELINE` en lib/data/derive.ts). Es de UNA campaña y ya se ve en
//     su detalle; en la lista de campañas del cliente se enseña su etapa actual.
//   · El pipeline COMERCIAL: el embudo de propuestas de `funnelPropuestas`
//     (derive.ts), donde «valor de pipeline» = borrador + enviada. Es el que
//     tiene sentido por cliente, y es el que se arma aquí.
//
//  Se alarga el embudo de propuestas con las campañas que salieron de él, para
//  que se lea de punta a punta: Borrador → Enviada → Aprobada → Campaña en
//  curso → Terminada. Lo que se cae (rechazadas, canceladas) va aparte.
//
//  Montos: todos CON IVA, para que las columnas se puedan comparar. La
//  propuesta usa `total` (base + IVA, el mismo que suma `funnelPropuestas`) y
//  la campaña `presupuestoBruto` (neto + IVA, campanas-repo.ts).
// ============================================================================

import type { Campana, EstComercialCampana, Propuesta } from '@/lib/data/types'

export type EtapaClientePipeline = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'EN_CURSO' | 'TERMINADA'

export const ETAPA_CLIENTE_LABEL: Record<EtapaClientePipeline, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  EN_CURSO: 'Campaña en curso',
  TERMINADA: 'Terminada',
}

const ORDEN: EtapaClientePipeline[] = ['BORRADOR', 'ENVIADA', 'APROBADA', 'EN_CURSO', 'TERMINADA']

export interface ColumnaPipelineCliente {
  etapa: EtapaClientePipeline
  label: string
  n: number
  monto: number
}

export interface PipelineCliente {
  columnas: ColumnaPipelineCliente[]
  rechazadas: { n: number; monto: number }
  canceladas: { n: number; monto: number }
  valorAbierto: number // borrador + enviada, igual que `pipelineValue` del funnel
  winRate: number | null // aprobadas / (aprobadas + rechazadas)
  total: number // propuestas + campañas del cliente
}

/**
 * Propuestas en las que participa el cliente: como cliente final o como la
 * agencia que la arma. Sin lo segundo, la ficha de una agencia saldría vacía
 * aunque sea quien mueve todas sus propuestas.
 */
export function propuestasDelCliente(propuestas: Propuesta[], clienteId: string): Propuesta[] {
  return propuestas.filter((p) => p.clienteId === clienteId || p.agenciaId === clienteId)
}

/**
 * Campañas del cliente, la más reciente primero. Con `propuestas`, entran
 * también las que nacieron de una propuesta que el cliente armó como agencia
 * (la campaña guarda solo el cliente final en `clienteId`).
 */
export function campanasDelCliente(
  campanas: Campana[],
  clienteId: string,
  propuestas: Propuesta[] = [],
): Campana[] {
  const suyas = new Set(propuestasDelCliente(propuestas, clienteId).map((p) => p.id))
  return campanas
    .filter((c) => c.clienteId === clienteId || (c.propuestaId != null && suyas.has(c.propuestaId)))
    .sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : a.fechaInicio > b.fechaInicio ? -1 : 0))
}

// Los siete `EstComercialCampana` (lib/data/types.ts). Un Record y no un if
// para que añadir un estado al tipo rompa el typecheck aquí en vez de caer
// callado en una columna cualquiera.
const ETAPA_POR_ESTADO: Record<EstComercialCampana, 'EN_CURSO' | 'TERMINADA' | 'CANCELADA'> = {
  DRAFT: 'EN_CURSO',
  COTIZACION: 'EN_CURSO',
  CONFIRMADA: 'EN_CURSO',
  ACTIVA: 'EN_CURSO',
  COMPLETADA: 'TERMINADA',
  LISTA_FACTURAR: 'TERMINADA',
  CANCELADA: 'CANCELADA',
}

export function etapaDeCampana(c: Campana): 'EN_CURSO' | 'TERMINADA' | 'CANCELADA' {
  return ETAPA_POR_ESTADO[c.estadoComercial] ?? 'EN_CURSO'
}

export function pipelineCliente(
  clienteId: string,
  propuestas: Propuesta[],
  campanas: Campana[],
): PipelineCliente {
  const props = propuestasDelCliente(propuestas, clienteId)
  const camps = campanasDelCliente(campanas, clienteId, propuestas)
  const cols = new Map<EtapaClientePipeline, ColumnaPipelineCliente>(
    ORDEN.map((e) => [e, { etapa: e, label: ETAPA_CLIENTE_LABEL[e], n: 0, monto: 0 }]),
  )
  const sumar = (e: EtapaClientePipeline, monto: number) => {
    const c = cols.get(e)!
    c.n++
    c.monto += monto
  }
  const rechazadas = { n: 0, monto: 0 }
  const canceladas = { n: 0, monto: 0 }
  let aprobadas = 0

  // Una propuesta aprobada que ya generó su campaña se cuenta en la CAMPAÑA,
  // no en las dos: si no, el mismo dinero sale dos veces en el embudo.
  const conCampana = new Set(camps.map((c) => c.propuestaId).filter((x): x is string => !!x))

  for (const p of props) {
    switch (p.estatus) {
      case 'BORRADOR': sumar('BORRADOR', p.total); break
      case 'ENVIADA': sumar('ENVIADA', p.total); break
      case 'APROBADA':
        aprobadas++
        if (!conCampana.has(p.id)) sumar('APROBADA', p.total)
        break
      case 'RECHAZADA': rechazadas.n++; rechazadas.monto += p.total; break
    }
  }
  for (const c of camps) {
    const monto = c.presupuestoBruto ?? 0
    const e = etapaDeCampana(c)
    if (e === 'CANCELADA') { canceladas.n++; canceladas.monto += monto }
    else sumar(e, monto)
  }

  const cerradas = aprobadas + rechazadas.n
  return {
    columnas: ORDEN.map((e) => cols.get(e)!),
    rechazadas,
    canceladas,
    valorAbierto: cols.get('BORRADOR')!.monto + cols.get('ENVIADA')!.monto,
    winRate: cerradas > 0 ? aprobadas / cerradas : null,
    total: props.length + camps.length,
  }
}
