// ============================================================================
//  lib/comercial-opex.ts — Prospección de arrendadores. MAQUETA, sin base.
// ----------------------------------------------------------------------------
//  Pedido por Jochelo el 2026-09-30 a partir de un prototipo HTML suyo:
//  «por ahora solo será html sin funciones», y «el mapa ese no lo añadas».
//
//  Así que esto NO habla con la base, NO tiene rutas de API y NO guarda nada.
//  Los datos de abajo son los del prototipo, tal cual, y viven aquí para que la
//  pantalla se pueda ver y enseñar.
//
//  ─── POR QUÉ LOS DATOS Y LAS CUENTAS VIVEN AQUÍ Y NO EN EL `.tsx` ──────────
//  Porque dentro de un componente no los comprueba nada: el arnés no monta DOM.
//  Esta misma semana tres mutantes que borraban avisos del reporte SOBREVIVIERON
//  por exactamente eso. Una maqueta no necesita pruebas de negocio, pero la
//  cuenta de «lleva más de 30 días sin contacto» sí es una cuenta, y una cuenta
//  sin prueba se equivoca en silencio.
//
//  ─── OJO: ESTO SE SOLAPA CON «CAPTACIÓN», QUE YA EXISTE Y SÍ TIENE BASE ────
//  `db/migrations/20260930_captacion.sql` trae `prospectos` y
//  `prospecto_avances` —con etapa, siguiente paso, vendedor y bitácora—, y su
//  pantalla vive en `/captacion`. Lo que esta maqueta añade y aquello no tiene:
//  VARIOS contactos por espacio (el dueño, la apoderada, la vecina, el
//  portero), la competencia, el historial de ofertas de renta y el multimedia.
//  Cuando esto deje de ser maqueta hay que decidir si se construye ENCIMA de
//  `prospectos` o aparte; construir aparte duplicaría la bitácora.
// ============================================================================

/** Las cinco etapas de encontrar a quién hay que convencer. */
export const ETAPAS_RESPONSABLE = [
  'Sin contacto',
  'Vecinos o intermediarios',
  'Dueño identificado',
  'En contacto con el dueño',
  'Responsable legal confirmado',
] as const

export type EstadoEspacio = 'negociacion' | 'activo' | 'inactivo'

export const ETIQUETA_ESTADO: Record<EstadoEspacio, string> = {
  negociacion: 'En negociación',
  activo: 'Activo',
  inactivo: 'Inactivo',
}

export type Contacto = {
  nombre: string
  papel: string
  telefono: string
  email: string
  /** Quien firma. Es el dato que cierra la última etapa. */
  legal: boolean
}

export type Avance = {
  fecha: string
  contacto: string
  canal: string
  resumen: string
  siguiente: string
}

export type Oferta = {
  version: number
  fecha: string
  importe: number
  plazoMeses: number
  estado: string
  notas: string
}

export type Competidor = { nombre: string; nota: string; desde: string }

export type Espacio = {
  id: string
  nombre: string
  tipo: string
  direccion: string
  estado: EstadoEspacio
  etapa: number
  desde: string
  negociante: string
  medidas: string
  presupuesto: { min: number; max: number; autoriza: string }
  contactos: Contacto[]
  competencia: Competidor[]
  bitacora: Avance[]
  ofertas: Oferta[]
  multimedia: { tipo: 'foto' | 'video'; nombre: string }[]
}

export const DOCUMENTOS_EMPRESA = [
  { nombre: 'Carta de representación del negociante', tipo: 'PDF', actualizado: '2026-07-01' },
  { nombre: 'Acta constitutiva (extracto)', tipo: 'PDF', actualizado: '2025-11-12' },
  { nombre: 'Portafolio de espacios y clientes', tipo: 'PDF', actualizado: '2026-08-20' },
  { nombre: 'Contrato de arrendamiento modelo', tipo: 'DOCX', actualizado: '2026-05-03' },
  { nombre: 'Póliza de responsabilidad civil', tipo: 'PDF', actualizado: '2026-01-15' },
  { nombre: 'Identificación oficial del negociante', tipo: 'JPG', actualizado: '2026-02-10' },
]

export const ESPACIOS: Espacio[] = [
  {
    id: 's1',
    nombre: 'Azotea Insurgentes 1420',
    tipo: 'Espectacular en azotea',
    direccion: 'Av. Insurgentes Sur 1420, Col. Del Valle',
    estado: 'negociacion',
    etapa: 4,
    desde: '2025-03-10',
    negociante: 'Mariana López',
    medidas: '12.9 × 7.2 m',
    presupuesto: { min: 18000, max: 26000, autoriza: 'Dirección comercial' },
    contactos: [
      { nombre: 'Ing. Roberto Salinas', papel: 'Dueño', telefono: '55 3120 4471', email: 'rsalinas@correo.mx', legal: false },
      { nombre: 'Lic. Andrea Ruiz', papel: 'Apoderada legal', telefono: '55 8811 0932', email: 'aruiz@despachoruiz.mx', legal: true },
      { nombre: 'Sra. Carmen (vecina 1418)', papel: 'Vecina', telefono: '55 2201 7788', email: '', legal: false },
    ],
    competencia: [
      { nombre: 'Publimex Exterior', nota: 'Ofreció $22,000/mes a 3 años según la apoderada', desde: '2026-06-01' },
    ],
    bitacora: [
      { fecha: '2026-09-22', contacto: 'Lic. Andrea Ruiz', canal: 'Reunión', resumen: 'Revisó la propuesta v3. Pide cláusula de mantenimiento de la estructura a nuestro cargo y pago trimestral anticipado.', siguiente: 'Enviar v4 con cláusula de mantenimiento antes del 6 de octubre' },
      { fecha: '2026-08-14', contacto: 'Ing. Roberto Salinas', canal: 'Llamada', resumen: 'Confirma que la apoderada decide. Menciona interés de otra empresa.', siguiente: 'Agendar reunión con apoderada' },
      { fecha: '2026-06-03', contacto: 'Ing. Roberto Salinas', canal: 'Visita en sitio', resumen: 'Primera reunión con el dueño. Se entregó carta de representación y portafolio.', siguiente: 'Enviar propuesta formal' },
      { fecha: '2025-04-18', contacto: 'Sra. Carmen (vecina 1418)', canal: 'Visita en sitio', resumen: 'La vecina proporcionó el teléfono del dueño; vive en Querétaro.', siguiente: 'Llamar al dueño' },
    ],
    ofertas: [
      { version: 3, fecha: '2026-09-01', importe: 21500, plazoMeses: 36, estado: 'Contraoferta', notas: 'Contraoferta: $24,000 con mantenimiento incluido' },
      { version: 2, fecha: '2026-07-10', importe: 19000, plazoMeses: 36, estado: 'Rechazada', notas: 'Consideró el monto bajo frente a la competencia' },
      { version: 1, fecha: '2026-06-10', importe: 17500, plazoMeses: 24, estado: 'Rechazada', notas: 'Plazo corto, quiere mínimo 3 años' },
    ],
    multimedia: [
      { tipo: 'foto', nombre: 'Vista desde Insurgentes' },
      { tipo: 'foto', nombre: 'Azotea, lado norte' },
      { tipo: 'video', nombre: 'Recorrido de azotea' },
    ],
  },
  {
    id: 's2',
    nombre: 'Muro Parque Hundido',
    tipo: 'Muro',
    direccion: 'Av. Porfirio Díaz 88, Col. Nochebuena',
    estado: 'activo',
    etapa: 4,
    desde: '2024-01-15',
    negociante: 'Jorge Méndez',
    medidas: '8 × 5 m',
    presupuesto: { min: 9000, max: 13000, autoriza: 'Dirección comercial' },
    contactos: [
      { nombre: 'Condominio Porfirio 88 (administración)', papel: 'Administrador', telefono: '55 5544 1200', email: 'admin@porfirio88.mx', legal: true },
    ],
    competencia: [],
    bitacora: [
      { fecha: '2026-09-05', contacto: 'Condominio Porfirio 88 (administración)', canal: 'Correo', resumen: 'Pago de septiembre confirmado. Sin incidencias.', siguiente: 'Revisión anual del contrato en enero' },
    ],
    ofertas: [
      { version: 1, fecha: '2024-02-01', importe: 11000, plazoMeses: 48, estado: 'Aceptada', notas: 'Contrato firmado el 20/02/2024' },
    ],
    multimedia: [{ tipo: 'foto', nombre: 'Muro con campaña actual' }],
  },
  {
    id: 's3',
    nombre: 'Unipolar Viaducto km 4',
    tipo: 'Unipolar',
    direccion: 'Viaducto Miguel Alemán, lote baldío junto al 312',
    estado: 'negociacion',
    etapa: 1,
    desde: '2026-05-20',
    negociante: 'Mariana López',
    medidas: 'Terreno aprox. 120 m²',
    presupuesto: { min: 14000, max: 20000, autoriza: 'Dirección comercial' },
    contactos: [
      { nombre: 'Don Efraín (taller vecino)', papel: 'Vecino', telefono: '55 7120 3390', email: '', legal: false },
      { nombre: 'Registro Público (trámite de folio)', papel: 'Gestión', telefono: '', email: '', legal: false },
    ],
    competencia: [
      { nombre: 'Desconocido', nota: 'Un vecino vio a otra persona preguntando por el terreno en agosto', desde: '2026-08-10' },
    ],
    bitacora: [
      { fecha: '2026-08-02', contacto: 'Don Efraín (taller vecino)', canal: 'Visita en sitio', resumen: 'Cree que el terreno es de una sucesión familiar. Dará aviso si ve a alguien de la familia.', siguiente: 'Solicitar folio real en Registro Público' },
      { fecha: '2026-05-20', contacto: 'Don Efraín (taller vecino)', canal: 'Visita en sitio', resumen: 'Primer recorrido; nadie en el terreno. El vecino no conoce al dueño.', siguiente: 'Volver con carta de representación' },
    ],
    ofertas: [],
    multimedia: [{ tipo: 'foto', nombre: 'Terreno desde Viaducto' }],
  },
  {
    id: 's4',
    nombre: 'Pantalla Glorieta Mixcoac',
    tipo: 'Pantalla LED',
    direccion: 'Glorieta de Mixcoac, edificio esquina norte',
    estado: 'inactivo',
    etapa: 3,
    desde: '2023-09-01',
    negociante: 'Jorge Méndez',
    medidas: '6 × 4 m',
    presupuesto: { min: 30000, max: 40000, autoriza: 'Dirección general' },
    contactos: [
      { nombre: 'Grupo Inmobiliario Alba', papel: 'Dueño', telefono: '55 9000 1122', email: 'contacto@alba.mx', legal: true },
    ],
    competencia: [],
    bitacora: [
      { fecha: '2026-03-12', contacto: 'Grupo Inmobiliario Alba', canal: 'Correo', resumen: 'Contrato terminado. El edificio entra en remodelación hasta 2027.', siguiente: 'Retomar contacto en febrero 2027' },
    ],
    ofertas: [
      { version: 1, fecha: '2023-09-10', importe: 34000, plazoMeses: 30, estado: 'Aceptada', notas: 'Contrato concluido en marzo 2026' },
    ],
    multimedia: [],
  },
  {
    id: 's5',
    nombre: 'Azotea Félix Cuevas 210',
    tipo: 'Espectacular en azotea',
    direccion: 'Eje 7 Sur Félix Cuevas 210, Col. Tlacoquemécatl',
    estado: 'negociacion',
    etapa: 2,
    desde: '2026-07-08',
    negociante: 'Luis Herrera',
    medidas: '10 × 5 m',
    presupuesto: { min: 15000, max: 21000, autoriza: 'Dirección comercial' },
    contactos: [
      { nombre: 'Sr. Tomás Aguirre', papel: 'Dueño', telefono: '55 6677 8899', email: '', legal: false },
      { nombre: 'Portero del edificio', papel: 'Intermediario', telefono: '', email: '', legal: false },
    ],
    competencia: [],
    bitacora: [
      { fecha: '2026-07-29', contacto: 'Portero del edificio', canal: 'Visita en sitio', resumen: 'Entregó datos del dueño y dejamos carta de representación para él.', siguiente: 'Llamar al Sr. Aguirre' },
    ],
    ofertas: [],
    multimedia: [{ tipo: 'foto', nombre: 'Fachada' }],
  },
]

/** El avance más reciente, o `null` si nunca se ha hablado con nadie. */
export function ultimoAvance(e: Espacio): Avance | null {
  if (e.bitacora.length === 0) return null
  return [...e.bitacora].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
}

/**
 * Días desde el último contacto. `null` cuando no hay ninguno — y `null` NO es
 * cero: «nunca se ha hablado» y «se habló hoy» son cosas distintas, y pintar un
 * 0 donde no se sabe es el mismo error que este repositorio ya pagó con el
 * `?? 0` del mapa y con los kWh de los recibos.
 */
export function diasSinContacto(e: Espacio, hoy: Date): number | null {
  const u = ultimoAvance(e)
  if (!u) return null
  const ms = hoy.getTime() - new Date(u.fecha + 'T00:00:00Z').getTime()
  return Math.floor(ms / 86_400_000)
}

/** El umbral a partir del cual una negociación se considera enfriada. */
export const DIAS_ENFRIADO = 30

/**
 * Los que hay que retomar: EN NEGOCIACIÓN y con más de 30 días sin contacto.
 *
 * El estado importa: un espacio `activo` lleva meses sin llamada porque ya está
 * contratado y va bien, y uno `inactivo` no se está persiguiendo. Contarlos
 * llenaría el aviso de ruido y dejaría de mirarse, que es como muere un aviso.
 */
export function enfriados(espacios: Espacio[], hoy: Date): Espacio[] {
  return espacios.filter((e) => {
    if (e.estado !== 'negociacion') return false
    const d = diasSinContacto(e, hoy)
    return d !== null && d > DIAS_ENFRIADO
  })
}

export function resumen(espacios: Espacio[], hoy: Date) {
  return {
    total: espacios.length,
    enNegociacion: espacios.filter((e) => e.estado === 'negociacion').length,
    activos: espacios.filter((e) => e.estado === 'activo').length,
    enfriados: enfriados(espacios, hoy).length,
  }
}

/**
 * El espacio que se detalla en la maqueta (2026-09-30: pasó a dos columnas).
 * Sin elección, o con un id que ya no existe, el primero: una pantalla de
 * detalle vacía no enseña la forma, que es para lo que existe la maqueta.
 */
export function espacioElegido(espacios: Espacio[], id: string | null): Espacio | null {
  return espacios.find((e) => e.id === id) ?? espacios[0] ?? null
}
