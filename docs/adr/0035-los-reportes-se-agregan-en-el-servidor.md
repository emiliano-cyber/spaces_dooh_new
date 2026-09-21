# ADR 0035: Los reportes se agregan en el servidor, no en el navegador

- **Fecha:** 2026-09-18
- **Estado:** Aceptada — construida y fusionada en `main` con el PR #91 (`ac4f71c`)

## Contexto

El jefe de Jochelo pidió el 2026-09-17 poder medir la rentabilidad por sitio, por
trimestre, por metro cuadrado, por consumo de luz y **por operación** — este
último, sus palabras: *«analizar las visitas a sitio vs la facturación que tiene
un punto»*, con el ejemplo de dos espectaculares con las mismas campañas y muy
distinta rentabilidad.

La mitad del cálculo ya existía y estaba bien hecha: `rentaAtribuidaPorSitio()`
reparte la renta de un contrato de predio entre las caras de sus pantallas, con
pruebas encima. Lo que no existía era **dónde** se calcula.

Toda la analítica se derivaba **en el navegador**. `GET /api/estado` devuelve
rebanadas de tablas completas, el front las mete en un store y saca los márgenes
ahí. Y ese camino ya se descontroló una vez, con la medición escrita en el propio
código:

> «llegó a 6.12 MB (contratos 3.95 · sitios 1.0 · sitiosRed 1.0) y el síntoma fue
> una pantalla en blanco de 6–12 s, **no un error**.»

Un reporte trimestral mira **años** de historia.

## Decisión

Los reportes viven detrás de un límite: **`GET /api/reportes/rentabilidad`**, que
recibe qué periodo se quiere y devuelve el reporte **ya sumado**. Las pantallas
hablan con ese endpoint y **nunca con el store**.

El motor se ejecuta en el servidor. La atribución **se mueve, no se copia**: dos
implementaciones divergen, y este repositorio ya tiene esa lección pagada con los
dos catálogos de permisos que discrepaban sin dar error.

`dimension` es un **`Record` exhaustivo**: declarar una dimensión sin motor **no
compila**. No hay 501 — se eliminó por inalcanzable, y no debe volver.

## Alternativas consideradas

**A · Seguir calculando en el cliente y solo añadir pantallas.** Lo más rápido
para el 14/10, reusando lo que ya había sin portar nada. **Se descarta por el
techo ya medido de 6.12 MB:** funcionaría en la demostración con datos chicos y
reventaría con el primer cliente con historia. Es la opción que se ve bien en el
Summit y se cae en la implementación real — exactamente el riesgo que el propio
jefe anticipó (*«hay algo que nos va a pasar en la implementación real»*).

**B · Vistas materializadas o una tabla de hechos.** Lo correcto a escala grande.
**Se descarta por ahora:** añade refresco, invalidación y una migración pesada
para un problema de volumen que nadie ha medido. Es el paso siguiente natural en
cuanto un reporte se ponga lento, y entonces será una decisión con datos.

**C · Una herramienta externa de BI sobre una réplica.** Cero código de reportes.
**Se descarta por el modelo de negocio:** cada owner corre su propia instancia
soberana, así que serían N instalaciones que mantener — y una conexión de BI **no
aplica la RLS** por `app.tenant_id`. El aislamiento se evaporaría justo en la
herramienta que lo ve todo.

## Consecuencias

**Positivas.** La analítica deja de pesar en la carga del shell. Los reportes
pueden ver historia, que es todo el punto. Y agregar en el servidor es la única
forma de que la RLS siga siendo honesta cuando la consulta toca todas las filas.

**Medido:** `/reportes` pesa **112 kB** de primera carga contra **533 kB** de
`/inicio`, con nueve columnas, el desglose por meses y los avisos dentro. El
límite aguantó.

**Negativas.** El motor lee acotado por rango y suma en Node: **todavía no hay
agregación en SQL**. El límite existe para que ese porte, cuando llegue, no toque
ni una pantalla. Y el endpoint **no limita cuántos meses se pueden pedir** — la
matriz es una celda por pantalla y por periodo. El caso realista es trivial; un
rango absurdo no. Riesgo del primer cliente grande, no del 14/10, y el tope es una
decisión de producto pendiente.

## Implicaciones de seguridad

> **Un endpoint de reportes es el blanco más atractivo del sistema para una fuga
> cruzada de tenant, precisamente porque agrega.** Un fallo que en una lista
> devuelve una fila ajena, en un reporte la promedia con las tuyas y nadie lo nota.

- `exigir('finanzas')`, no `dashboard`: un reporte de rentabilidad es dinero.
- `q` y **nunca** `qRaw`, con `and tenant_id = $n` explícito sobre la RLS.
- `dimension`, `granularidad` y el rango **validados como enum cerrado con Zod**,
  jamás interpolados: un agrupador que entra como texto libre es inyección por la
  puerta de servicio.
- Un guard lee el código fuente del repo y se pone rojo si una consulta pierde su
  filtro o aparece un `qRaw`. **Y ese guard enseñó su propia lección:** estuvo
  verde solo en el árbol donde se escribió, porque git convierte los finales de
  línea al hacer checkout y el `.` de JavaScript no cruza `\r`. Un guard que solo
  funciona con un final de línea no es un guard.
- **Auditoría:** leer un reporte no se registra; exportarlo debería, porque un P&L
  exportado sale del sistema.
- Dependencias nuevas: ninguna.

## Lo que esta decisión destapó, y no estaba previsto

El reporte calculaba el costo con **el contrato vigente hoy**, así que un
trimestre cerrado no veía el contrato que se pagaba entonces. En el caso de
prueba escondía **48 000 de renta realmente pagada, sin un solo síntoma**. La
atribución es ahora consciente del periodo: cuenta el contrato que solapa el
rango aunque haya vencido, y parte el bucket por las fronteras de vigencia.

No lo vio el typecheck, ni 1430 pruebas unitarias, ni 390 de integración. Lo vio
una prueba escrita a propósito para preguntárselo.

## Cómo revertir

Trivial: los endpoints son aditivos. Lo que **no** conviene revertir es el límite:
volver a calcular en el navegador significaría rehacer las cinco pantallas, y
entonces ya no se haría.
