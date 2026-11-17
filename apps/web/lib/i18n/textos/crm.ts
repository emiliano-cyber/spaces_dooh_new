// ============================================================================
//  lib/i18n/textos/crm.ts — LOS TEXTOS DEL CRM COMERCIAL (ADR 0051).
// ----------------------------------------------------------------------------
//  Archivo propio y no dentro de `propuestas.ts`: el CRM crece en cuatro fases
//  y acabará siendo su propia área del menú (Fase 4). Si estos textos vivieran
//  en propuestas, cada fase reescribiría la instantánea de aquel diccionario.
//
//  Reglas de `diccionario.ts`, sin excepción: claves `crm.<elemento>` en
//  español sin acentos; ni una cifra de dinero ni un símbolo de moneda (los
//  importes entran por hueco ya formateados); EN/IT/PT son
//  `Record<ClaveCrm, string>`, así que una clave que falte NO compila.
//  Glosario: cotización → quote · cliente → client · vendedor → sales rep ·
//  renegociación → renegotiation.
// ============================================================================

export const ES_CRM = {
  'crm.vista.grupo': 'Cómo ver la lista',
  'crm.vista.propuesta': 'Por propuesta',
  'crm.vista.cliente': 'Por cliente',
  'crm.cotejo.titulo': 'Cotejo por cliente',
  'crm.cotejo.subtitulo': 'Cuántas cotizaciones lleva cada cliente, cuánto tiempo llevamos negociando y cuánto hay en juego.',
  'crm.cotejo.vacio': 'No hay propuestas que cotejar.',
  'crm.cotejo.sin-cliente': 'Sin cliente',
  'crm.cotejo.cliente-desconocido': 'Cliente no encontrado',
  'crm.cotejo.estado.abierto': 'En negociación',
  'crm.cotejo.estado.cerrado': 'Cerrado',
  'crm.cotejo.vencidas': 'Vencidas: {n}',
  'crm.cotejo.col.cotizaciones': 'Cotizaciones',
  'crm.cotejo.col.renegociaciones': 'Renegociaciones',
  'crm.cotejo.col.dias': 'Días negociando',
  'crm.cotejo.col.en-juego': 'En juego',
  'crm.cotejo.col.ganado': 'Ganado',
  'crm.cotejo.col.cierre': 'Tasa de cierre',
  'crm.cotejo.dias.sin-fecha': 'Sin fecha de decisión: se aprobó o rechazó antes de que se guardara.',
  'crm.cotejo.con-iva': 'c/IVA',
  'crm.cotejo.primera': 'Primera cotización: {fecha}',
  'crm.cotejo.ultima': 'Última actividad: {fecha}',
  'crm.cotejo.vendedores': 'Vendedores: {nombres}',
  'crm.cotejo.sin-vendedor': 'Sin vendedor',
  'crm.cotejo.version': 'versión {n}',
  'crm.cotejo.ver': 'Ver',
  'crm.unidad.dia': 'día',
  'crm.unidad.dias': 'días',
  'crm.unidad.cliente': 'cliente',
  'crm.unidad.clientes': 'clientes',
}

export type ClaveCrm = keyof typeof ES_CRM

export const EN_CRM: Record<ClaveCrm, string> = {
  'crm.vista.grupo': 'How to view the list',
  'crm.vista.propuesta': 'By proposal',
  'crm.vista.cliente': 'By client',
  'crm.cotejo.titulo': 'Client comparison',
  'crm.cotejo.subtitulo': 'How many quotes each client has, how long we have been negotiating and how much is in play.',
  'crm.cotejo.vacio': 'There are no proposals to compare.',
  'crm.cotejo.sin-cliente': 'No client',
  'crm.cotejo.cliente-desconocido': 'Client not found',
  'crm.cotejo.estado.abierto': 'In negotiation',
  'crm.cotejo.estado.cerrado': 'Closed',
  'crm.cotejo.vencidas': 'Expired: {n}',
  'crm.cotejo.col.cotizaciones': 'Quotes',
  'crm.cotejo.col.renegociaciones': 'Renegotiations',
  'crm.cotejo.col.dias': 'Days negotiating',
  'crm.cotejo.col.en-juego': 'In play',
  'crm.cotejo.col.ganado': 'Won',
  'crm.cotejo.col.cierre': 'Close rate',
  'crm.cotejo.dias.sin-fecha': 'No decision date: it was approved or rejected before dates were recorded.',
  'crm.cotejo.con-iva': 'incl. VAT',
  'crm.cotejo.primera': 'First quote: {fecha}',
  'crm.cotejo.ultima': 'Last activity: {fecha}',
  'crm.cotejo.vendedores': 'Sales reps: {nombres}',
  'crm.cotejo.sin-vendedor': 'No sales rep',
  'crm.cotejo.version': 'version {n}',
  'crm.cotejo.ver': 'View',
  'crm.unidad.dia': 'day',
  'crm.unidad.dias': 'days',
  'crm.unidad.cliente': 'client',
  'crm.unidad.clientes': 'clients',
}

export const IT_CRM: Record<ClaveCrm, string> = {
  'crm.vista.grupo': 'Come vedere l’elenco',
  'crm.vista.propuesta': 'Per proposta',
  'crm.vista.cliente': 'Per cliente',
  'crm.cotejo.titulo': 'Confronto per cliente',
  'crm.cotejo.subtitulo': 'Quanti preventivi ha ogni cliente, da quanto tempo stiamo negoziando e quanto è in gioco.',
  'crm.cotejo.vacio': 'Non ci sono proposte da confrontare.',
  'crm.cotejo.sin-cliente': 'Senza cliente',
  'crm.cotejo.cliente-desconocido': 'Cliente non trovato',
  'crm.cotejo.estado.abierto': 'In negoziazione',
  'crm.cotejo.estado.cerrado': 'Chiuso',
  'crm.cotejo.vencidas': 'Scadute: {n}',
  'crm.cotejo.col.cotizaciones': 'Preventivi',
  'crm.cotejo.col.renegociaciones': 'Rinegoziazioni',
  'crm.cotejo.col.dias': 'Giorni di trattativa',
  'crm.cotejo.col.en-juego': 'In gioco',
  'crm.cotejo.col.ganado': 'Vinto',
  'crm.cotejo.col.cierre': 'Tasso di chiusura',
  'crm.cotejo.dias.sin-fecha': 'Senza data di decisione: è stata approvata o rifiutata prima che le date venissero salvate.',
  'crm.cotejo.con-iva': 'IVA incl.',
  'crm.cotejo.primera': 'Primo preventivo: {fecha}',
  'crm.cotejo.ultima': 'Ultima attività: {fecha}',
  'crm.cotejo.vendedores': 'Venditori: {nombres}',
  'crm.cotejo.sin-vendedor': 'Nessun commerciale',
  'crm.cotejo.version': 'versione {n}',
  'crm.cotejo.ver': 'Vedi',
  'crm.unidad.dia': 'giorno',
  'crm.unidad.dias': 'giorni',
  'crm.unidad.cliente': 'cliente',
  'crm.unidad.clientes': 'clienti',
}

export const PT_CRM: Record<ClaveCrm, string> = {
  'crm.vista.grupo': 'Como ver a lista',
  'crm.vista.propuesta': 'Por proposta',
  'crm.vista.cliente': 'Por cliente',
  'crm.cotejo.titulo': 'Comparação por cliente',
  'crm.cotejo.subtitulo': 'Quantas cotações cada cliente tem, há quanto tempo estamos negociando e quanto está em jogo.',
  'crm.cotejo.vacio': 'Não há propostas para comparar.',
  'crm.cotejo.sin-cliente': 'Sem cliente',
  'crm.cotejo.cliente-desconocido': 'Cliente não encontrado',
  'crm.cotejo.estado.abierto': 'Em negociação',
  'crm.cotejo.estado.cerrado': 'Fechado',
  'crm.cotejo.vencidas': 'Vencidas: {n}',
  'crm.cotejo.col.cotizaciones': 'Cotações',
  'crm.cotejo.col.renegociaciones': 'Renegociações',
  'crm.cotejo.col.dias': 'Dias negociando',
  'crm.cotejo.col.en-juego': 'Em jogo',
  'crm.cotejo.col.ganado': 'Ganho',
  'crm.cotejo.col.cierre': 'Taxa de fechamento',
  'crm.cotejo.dias.sin-fecha': 'Sem data de decisão: foi aprovada ou recusada antes de as datas serem salvas.',
  'crm.cotejo.con-iva': 'c/ IVA',
  'crm.cotejo.primera': 'Primeira cotação: {fecha}',
  'crm.cotejo.ultima': 'Última atividade: {fecha}',
  'crm.cotejo.vendedores': 'Vendedores: {nombres}',
  'crm.cotejo.sin-vendedor': 'Sem vendedor',
  'crm.cotejo.version': 'versão {n}',
  'crm.cotejo.ver': 'Ver',
  'crm.unidad.dia': 'dia',
  'crm.unidad.dias': 'dias',
  'crm.unidad.cliente': 'cliente',
  'crm.unidad.clientes': 'clientes',
}
