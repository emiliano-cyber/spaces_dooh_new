// ============================================================================
//  lib/server/recibos-cfe/casos.ts — Recibos REALES de CFE, anonimizados.
// ----------------------------------------------------------------------------
//  Cada constante es el texto de la PAGINA 1 de un recibo de verdad, tal como
//  lo devuelve `leerPaginasDePdf()`: una linea por renglon visual, en el orden
//  en que se leen. No estan escritos a mano — salen de los 72 recibos del
//  cliente, que es la unica forma de que prueben las plantillas que EXISTEN y
//  no las que uno se imagina.
//
//  QUE SE LES QUITO, Y POR QUE NO ESTAN LOS PDF EN EL REPOSITORIO: son recibos
//  de un cliente real. Llevaban razon social, domicilio, RFC del receptor, el
//  numero de cuenta, el RMU, el UUID del CFDI y sus sellos. Todo eso se
//  elimino, y el numero de servicio y el de medidor se sustituyeron por
//  ficticios (9000000000NN / X000XX). Lo unico identificable que queda es el
//  RFC de la PROPIA CFE, que va impreso en todos los recibos del pais.
//
//  La PAGINA 2 se descarto entera: no la lee el interprete —todo lo que hace
//  falta esta en la 1— y es donde viven la cadena original y los sellos.
//
//  LAS SEIS SON LAS SEIS FORMAS DISTINTAS que aparecen en los 72:
//
//   · `pdbtBimestralConDsap`  — la comun (57 de 72). Un solo renglon de kWh,
//                               periodo de DOS meses de calendario, y DSAP
//                               despues del importe del periodo.
//   · `gdmto`                 — media tension (12 de 72). El kWh va en un
//                               renglon con el numero de medidor dentro y
//                               CUATRO cifras; la buena es la ultima.
//   · `gdmthTresRenglones`    — media tension horaria (3 de 72). NO hay un
//                               total de kWh: hay base, intermedia y punta, y
//                               hay que sumarlas.
//   · `pdbtConDeposito`       — trae un `Deposito` de 3,315.00 despues del
//                               importe del periodo. Es la trampa cara: entra
//                               en el `Total` del recibo y NO es consumo. Si
//                               se capturara el `Total`, el costo de la luz de
//                               ese predio saldria 4.3 veces el real.
//   · `pdbtConDap`            — el alumbrado publico se llama `DAP((2))` en vez
//                               de `DSAP`. Mismo concepto, otra etiqueta.
//   · `pdbtConsumoCero`       — consumo REAL de cero kWh con importe de 270.94.
//                               Existe: un medidor que no giro y el cargo fijo
//                               igual se cobra. Es el caso que obliga a
//                               distinguir «lei un cero» de «no lo encontre».
// ============================================================================

export const pdbtBimestralConDsap: string[] = [
  "===== PAGINA 1 =====",
  "Comisión Federal de Electricidad",
  "Av. Paseo de la Reforma 164, Col. Juárez,",
  "Alcaldía: Cuauhtémoc, Código Postal: 06600,",
  "Ciudad de México. RFC: CFE370814QI0",
  "TOTAL A PAGAR:",
  "$7,941",
  "(SIETE MIL NOVECIENTOS CUARENTA Y UN PESOS M.N.)",
  "EMPRESA DE PRUEBA SA DE CV",
  "NO. DE SERVICIO: 900000000001",
  "LÍMITE DE PAGO:19 ENE 26",
  "CORTE A PARTIR:20 ENE 26",
  "TARIFA: PDBT NO. MEDIDOR: A000AA",
  "MULTIPLICADOR: 1",
  "NO HILOS: 2",
  "PERIODO FACTURADO: 03 NOV 25-05 ENE 26",
  "Concepto Lectura actual Lectura anterior Total Precio Subtotal",
  "Medida X Estimada Medida X Estimada periodo (MXN) (MXN)",
  "Energía (kWh) 74,978 72,230 2,748",
  "Este gráfico refleja tu nivel de consumo. A menor uso, mayor apoyo. Subtotal",
  "↓",
  "Costos de la energía en el Mercado Eléctrico Mayorista Desglose del importe a pagar",
  "Concepto $ $/kW $/kWh Importe (MXN) Concepto Importe (MXN)",
  "Suministro 156.58 0.00 0.00 156.58 Cargo Fijo((3)) 156.58",
  "Distribución 0.00 0.00 1,919.48 1,919.48 Energia 7,101.39",
  "Transmisión 0.00 0.00 497.11 497.11 Subtotal 7,257.97",
  "CENACE 0.00 0.00 29.13 29.13 IVA 8% 580.64",
  "Energía 0.00 0.00 1,846.66 1,846.66 Fac. del Periodo 7,838.61",
  "Capacidad 0.00 0.00 2,791.97 2,791.97 DSAP 101.83",
  "SCnMEM(1) 0.00 0.00 17.04 17.04 Adeudo Anterior 9,673.91",
  "Su Pago -9,673.00",
  "Total 7,941.35",
  "(1) SCnMEM: Costos relacionados con los servicios del Mercado. (2) DAP: Derecho al Alumbrado Público. (3) Cargos o créditos: Diversos conceptos que se pueden incluir en el aviso recibo relacionados con el suministro.",
  "01 900000000001 260119 000007941 2",
  "$7,941",
  "(SIETE MIL NOVECIENTOS CUARENTA Y UN PESOS M.N.)"
]

export const gdmto: string[] = [
  "===== PAGINA 1 =====",
  "Comisión Federal de Electricidad",
  "Av. Paseo de la Reforma 164, Col. Juárez,",
  "Alcaldía: Cuauhtémoc, Código Postal: 06600,",
  "Ciudad de México. RFC: CFE370814QI0",
  "TOTAL A PAGAR:",
  "$22,557",
  "EMPRESA DE PRUEBA SA DE CV",
  "NO. DE SERVICIO: 900000000002",
  "PERIODO FACTURADO: 14 NOV 25-16 DIC 25",
  "TARIFA: GDMTO NO. MEDIDOR: B000BB MULTIPLICADOR: 1 FECHA LÍMITE DE PAGO: 29 DIC 25",
  "NO HILOS: 3",
  "CARGA CONECTADA kW: 38 DEMANDA CONTRATADA kW: 38 CORTE A PARTIR: 30 DIC 25",
  "Lectura actual Lectura anterior",
  "Concepto No. medidor Medida X Estimada Medida X Estimada Diferencia Totales",
  "kWh B000BB 48,285 41,176 7,109 7,109",
  "kW B000BB 16 0 16 16",
  "kVArh B000BB 581 581 0 0",
  "Mes Días de mes Consumo prom. diario Energía kWh Precios $/kWh",
  "Mes Factor de proporción Demanda máxima $/kW Precios $/kW Importe (MXN) Factor de potencia",
  "99.99",
  "Costos de la energía en el Mercado Eléctrico Mayorista Desglose del importe a pagar",
  "Concepto $ $/kW $/kWh Importe (MXN) Concepto Importe (MXN)",
  "Suministro 391.98 0.00 0.00 391.98 Cargo Fijo((3)) 391.98",
  "Distribución 0.00 2,805.17 0.00 2,805.17 Energia 19,161.77",
  "Transmisión 0.00 0.00 1,286.02 1,286.02 2% Baja Tension((3)) 391.08",
  "CENACE 0.00 0.00 75.36 75.36 Bonificacion Factor de Potencia((3)) -498.62",
  "Energía 0.00 0.00 9,113.74 9,113.74 Subtotal 19,446.21",
  "IVA 16% 3,111.39",
  "Capacidad 0.00 5,837.40 0.00 5,837.40",
  "Facturacion del Periodo 22,557.60",
  "SCnMEM(1) 0.00 0.00 44.08 44.08",
  "Adeudo Anterior 18,246.00",
  "Su Pago -18,246.00",
  "Total 22,557.60",
  "TOTAL 391.98 8,642.57 10,519.19 19,553.75",
  "(1) SCnMEM: Costos relacionados con los servicios del Mercado. (2) DAP: Derecho al Alumbrado Público. (3) Cargos o créditos: Diversos conceptos que se pueden incluir en el aviso recibo relacionados con el suministro.",
  "01 900000000002 251229 000022557 7",
  "$22,557",
  "(VEINTIDOS MIL QUINIENTOS CINCUENTA Y SIETE PESOS"
]

export const gdmthTresRenglones: string[] = [
  "===== PAGINA 1 =====",
  "Comisión Federal de Electricidad",
  "Av. Paseo de la Reforma 164, Col. Juárez,",
  "Alcaldía: Cuauhtémoc, Código Postal: 06600,",
  "Ciudad de México. RFC: CFE370814QI0",
  "TOTAL A PAGAR:",
  "$106,085",
  "(CIENTO SEIS MIL OCHENTA Y CINCO PESOS M.N.)",
  "EMPRESA DE PRUEBA SA DE CV",
  "NO. DE SERVICIO: 900000000003",
  "PERIODO FACTURADO: 30 NOV 25-31 DIC 25",
  "TARIFA: GDMTH NO. MEDIDOR: C000CC MULTIPLICADOR: 80 FECHA LÍMITE DE PAGO: 13 ENE 26",
  "NO HILOS: 3",
  "CARGA CONECTADA kW: 128 DEMANDA CONTRATADA kW: 128 CORTE A PARTIR: 14 ENE 26",
  "Consumo",
  "Concepto Medida X Estimada Precio (MXN) Subtotal (MXN)",
  "kWh base 7,720",
  "kWh intermedia 20,767",
  "kWh punta 2,983",
  "kW base 72",
  "kW intermedia 71",
  "kW punta 67",
  "KWMax 72",
  "Factor de potencia % 99.99",
  "Costos de la energía en el Mercado Eléctrico Mayorista Desglose del importe a pagar",
  "Concepto $ $/kW $/kWh Importe (MXN) Concepto Importe (MXN)",
  "Suministro 372.38 0.00 0.00 372.38 Cargo Fijo((3)) 372.38",
  "Distribución 0.00 12,029.04 0.00 12,029.04 Energia 91,585.47",
  "Transmisión 0.00 0.00 5,692.92 5,692.92 2% Baja Tension((3)) 1,839.16",
  "CENACE 0.00 0.00 333.58 333.58 Bonificacion Factor de Potencia((3)) -2,344.93",
  "Generación B 0.00 0.00 6,477.85 6,477.85 Subtotal 91,452.08",
  "IVA 16% 14,632.33",
  "Generación I 0.00 0.00 34,348.62 34,348.62",
  "Facturacion del Periodo 106,084.41",
  "Generación P 0.00 0.00 5,625.94 5,625.94",
  "Adeudo Anterior 109,233.97",
  "Capacidad 0.00 26,882.41 0.00 26,882.41",
  "Su Pago -109,233.00",
  "SCnMEM(1) 0.00 0.00 195.11 195.11",
  "Total 106,085.38",
  "TOTAL 372.38 38,911.45 52,674.02 91,957.85",
  "(1) SCnMEM: Costos relacionados con los servicios del Mercado. (2) DAP: Derecho al Alumbrado Público. (3) Cargos o créditos: Diversos conceptos que se pueden incluir en el aviso recibo relacionados con el suministro.",
  "01 900000000003 260113 000106085 8",
  "$106,085",
  "(CIENTO SEIS MIL OCHENTA Y CINCO PESOS M.N.)"
]

export const pdbtConDeposito: string[] = [
  "===== PAGINA 1 =====",
  "Comisión Federal de Electricidad",
  "Av. Paseo de la Reforma 164, Col. Juárez,",
  "Alcaldía: Cuauhtémoc, Código Postal: 06600,",
  "Ciudad de México. RFC: CFE370814QI0",
  "TOTAL A PAGAR:",
  "$4,309",
  "(CUATRO MIL TRESCIENTOS NUEVE PESOS M.N.)",
  "EMPRESA DE PRUEBA SA DE CV",
  "NO. DE SERVICIO: 900000000004",
  "LÍMITE DE PAGO:04 DIC 25",
  "CORTE A PARTIR:05 DIC 25",
  "TARIFA: PDBT NO. MEDIDOR: D000DD",
  "MULTIPLICADOR: 1",
  "NO HILOS: 2",
  "PERIODO FACTURADO: 24 SEP 25-18 NOV 25",
  "Concepto Lectura actual Lectura anterior Total Precio Subtotal",
  "Medida X Estimada Medida X Estimada periodo (MXN) (MXN)",
  "Energía (kWh) 168 0 168",
  "Este gráfico refleja tu nivel de consumo. A menor uso, mayor apoyo. Subtotal",
  "↓",
  "Costos de la energía en el Mercado Eléctrico Mayorista Desglose del importe a pagar",
  "Concepto $ $/kW $/kWh Importe (MXN) Concepto Importe (MXN)",
  "Suministro 67.03 0.00 0.00 67.03 Cargo Fijo((3)) 67.03",
  "Distribución 0.00 0.00 234.37 234.37 Energia 790.42",
  "Transmisión 0.00 0.00 30.40 30.40 Subtotal 857.45",
  "CENACE 0.00 0.00 1.77 1.77 IVA 16% 137.19",
  "Energía 0.00 0.00 323.40 323.40 Fac. del Periodo 994.64",
  "Capacidad 0.00 0.00 199.45 199.45 Deposito 3,315.00",
  "SCnMEM(1) 0.00 0.00 1.03 1.03",
  "Total 4,309.64",
  "(1) SCnMEM: Costos relacionados con los servicios del Mercado. (2) DAP: Derecho al Alumbrado Público. (3) Cargos o créditos: Diversos conceptos que se pueden incluir en el aviso recibo relacionados con el suministro.",
  "01 900000000004 251204 000004309 0",
  "$4,309",
  "(CUATRO MIL TRESCIENTOS NUEVE PESOS M.N.)"
]

export const pdbtConDap: string[] = [
  "===== PAGINA 1 =====",
  "Comisión Federal de Electricidad",
  "Av. Paseo de la Reforma 164, Col. Juárez,",
  "Alcaldía: Cuauhtémoc, Código Postal: 06600,",
  "Ciudad de México. RFC: CFE370814QI0",
  "TOTAL A PAGAR:",
  "$62,364",
  "(SESENTA Y DOS MIL TRESCIENTOS SESENTA Y CUATRO PESOS M.N.)",
  "EMPRESA DE PRUEBA SA DE CV",
  "NO. DE SERVICIO: 900000000005",
  "LÍMITE DE PAGO:07 SEP 25",
  "CORTE A PARTIR:08 SEP 25",
  "TARIFA: PDBT NO. MEDIDOR: E000EE",
  "MULTIPLICADOR: 1",
  "NO HILOS: 3",
  "PERIODO FACTURADO: 09 MAY 25-22 AGO 25",
  "Concepto Lectura actual Lectura anterior Total Precio Subtotal",
  "Medida X Estimada Medida X Estimada periodo (MXN) (MXN)",
  "Energía (kWh) 11,913 0 11,913",
  "Este gráfico refleja tu nivel de consumo. A menor uso, mayor apoyo. Subtotal",
  "↓",
  "Costos de la energía en el Mercado Eléctrico Mayorista Desglose del importe a pagar",
  "Concepto $ $/kW $/kWh Importe (MXN) Concepto Importe (MXN)",
  "Suministro 147.97 0.00 0.00 147.97 Cargo Fijo((3)) 147.97",
  "Distribución 0.00 0.00 12,198.92 12,198.92 Energia 51,456.55",
  "Transmisión 0.00 0.00 2,155.05 2,155.05 Pago a Cuenta((3)) -63.65",
  "CENACE 0.00 0.00 77.43 77.43 Subtotal 51,540.87",
  "Energía 0.00 0.00 24,076.29 24,076.29 IVA 16% 8,246.54",
  "Capacidad 0.00 0.00 12,875.00 12,875.00 Fac. del Periodo 59,787.41",
  "SCnMEM(1) 0.00 0.00 73.86 73.86 DAP((2)) 2,577.05",
  "Adeudo Anterior 3,467.01",
  "Su Pago -3,467.00",
  "Total 62,364.47",
  "(1) SCnMEM: Costos relacionados con los servicios del Mercado. (2) DAP: Derecho al Alumbrado Público. (3) Cargos o créditos: Diversos conceptos que se pueden incluir en el aviso recibo relacionados con el suministro.",
  "01 900000000005 250907 000062364 7",
  "$62,364",
  "(SESENTA Y DOS MIL TRESCIENTOS SESENTA Y CUATRO PESOS"
]

export const pdbtConsumoCero: string[] = [
  "===== PAGINA 1 =====",
  "Comisión Federal de Electricidad",
  "Av. Paseo de la Reforma 164, Col. Juárez,",
  "Alcaldía: Cuauhtémoc, Código Postal: 06600,",
  "Ciudad de México. RFC: CFE370814QI0",
  "TOTAL A PAGAR:",
  "$270",
  "(DOSCIENTOS SETENTA PESOS M.N.)",
  "EMPRESA DE PRUEBA SA DE CV",
  "NO. DE SERVICIO: 900000000006",
  "LÍMITE DE PAGO:17 NOV 25",
  "CORTE A PARTIR:18 NOV 25",
  "TARIFA: PDBT NO. MEDIDOR: F000FF",
  "MULTIPLICADOR: 1",
  "NO HILOS: 2",
  "PERIODO FACTURADO: 02 SEP 25-03 NOV 25",
  "Concepto Lectura actual Lectura anterior Total Precio Subtotal",
  "Medida X Estimada Medida X Estimada periodo (MXN) (MXN)",
  "Energía (kWh) 1 1 0",
  "Este gráfico refleja tu nivel de consumo. A menor uso, mayor apoyo. Subtotal",
  "↓",
  "Costos de la energía en el Mercado Eléctrico Mayorista Desglose del importe a pagar",
  "Concepto $ $/kW $/kWh Importe (MXN) Concepto Importe (MXN)",
  "Suministro 156.58 0.00 0.00 156.58 Cargo Fijo((3)) 156.58",
  "Distribución 0.00 0.00 0.00 0.00 Energia 0.00",
  "Transmisión 0.00 0.00 0.00 0.00 Subtotal 156.58",
  "CENACE 0.00 0.00 0.00 0.00 IVA 8% 12.53",
  "Energía 0.00 0.00 0.00 0.00 Fac. del Periodo 169.11",
  "Capacidad 0.00 0.00 0.00 0.00 DSAP 101.83",
  "SCnMEM(1) 0.00 0.00 0.00 0.00 Adeudo Anterior 271.05",
  "Su Pago -271.00",
  "Total 270.99",
  "(1) SCnMEM: Costos relacionados con los servicios del Mercado. (2) DAP: Derecho al Alumbrado Público. (3) Cargos o créditos: Diversos conceptos que se pueden incluir en el aviso recibo relacionados con el suministro.",
  "01 900000000006 251117 000000270 0",
  "$270",
  "(DOSCIENTOS SETENTA PESOS M.N.)"
]

