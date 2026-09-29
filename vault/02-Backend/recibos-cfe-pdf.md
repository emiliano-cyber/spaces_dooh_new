---
tipo: modulo
estado: verificado
actualizado: 2026-09-29
tags: [backend, energia, luz, cfe, pdf, captura, operaciones, dinero]
archivos:
  - apps/web/lib/server/recibos-cfe/interprete.ts
  - apps/web/lib/server/recibos-cfe/lector-pdf.ts
  - apps/web/lib/server/recibos-cfe/propuesta.ts
  - apps/web/lib/server/recibos-cfe/cifras.ts
  - apps/web/lib/server/recibos-cfe/controller.ts
  - apps/web/lib/server/recibos-cfe/casos.ts
  - apps/web/app/api/energia/recibos/route.ts
  - apps/web/components/demo/energia/recibos.ts
  - apps/web/components/demo/energia/SubirRecibos.tsx
  - apps/web/lib/server/energia-repo.ts
  - apps/web/lib/server/energia-controller.ts
  - apps/web/next.config.mjs
  - apps/web/lib/test/energia-recibos-pdf.e2e.test.ts
---

# Subir el PDF del recibo de CFE

Nació el **2026-09-29**. Complementa a [[02-Backend/energia-consumos]], que es
donde vive la tabla y la captura a mano: aquí solo se explica **cómo se lee un
PDF de CFE y qué se propone con lo leído**. Nada de este módulo escribe en la
base.

Se escribió contra **72 recibos reales** de un cliente
(`C:\Users\Server\Downloads\CFE WEST 72 recibos`, fuera del repositorio), con
**29 números de servicio distintos** y tres tarifas.

---

## 1 · La regla que manda: PROPONER, NO GUARDAR

La subida devuelve **propuestas**. El alta sigue siendo
`POST /api/energia/consumos`, renglón a renglón, con una persona confirmando.

No es prudencia genérica. Un recibo mal leído que se guarda solo mete un costo
falso en el reporte de rentabilidad, y **ahí ya no se distingue de uno bueno**:
no hay marca, no hay error, y el margen sale peor o mejor de lo que es sin que
nadie pueda saber por qué. Reusar el endpoint de alta que ya existe —con su
validación, su índice único y su `registrarAccion`— cuesta una petición por
renglón y no abre un segundo camino de escritura que auditar aparte.

Por eso la pantalla enseña **lo leído al lado de lo propuesto**: número de
servicio, aparato, tarifa, periodo real, la facturación, el alumbrado y el
`Total` impreso.

---

## 2 · La trampa del PDF: DOS codificaciones en la misma página

Los recibos son **PDF de texto** —72 objetos de fuente, 8 fuentes incrustadas,
ningún escaneo—, así que **no hace falta OCR**. La dificultad es otra:

| | |
|---|---|
| Parte del texto | fuentes Type1 con `WinAnsiEncoding`. Los bytes SON el texto |
| Y parte | fuentes Type0 con `Identity-H`, **desplazadas −29**. `NO DE SERVICIO` sale crudo como `` 1 2   ' (  6 ( 5 9 , & , 2 `` |

> [!danger] Una extracción ingenua no falla: MIENTE
> Devuelve una de las dos codificaciones y la otra sale cifrada — y el resultado
> **parece texto válido**. Tampoco se arregla restando 29 a todo: eso rompe la
> mitad WinAnsi.

Lo que resuelve el cruce son los mapas **`ToUnicode`** que el propio PDF trae
(3 mapas para 8 fuentes; las otras 5 son WinAnsi y no lo necesitan). `pdfjs-dist`
los aplica **por fuente**, que es exactamente lo que hace falta.

**Medido el 2026-09-29: los 72 recibos se leen enteros y correctos.**

### La dependencia

`pdfjs-dist@4.10.38`, sólo en el servidor. **3.1 MB dentro del artefacto**
(`pdf.mjs` 784 KB + `pdf.worker.mjs` 2.3 MB), medido sobre
`.next/standalone`. En disco el paquete ocupa 37 MB, pero la mitad son
sourcemaps y `cmaps`/`standard_fonts` que el trazado no copia.

> [!danger] Y esto SOLO falla en el artefacto: el worker no viajaba
> `pdf.js` carga su worker con un `import('./pdf.worker.mjs')` que lleva un
> `webpackIgnore` dentro. Webpack empaquetaba `pdf.mjs` en un chunk del servidor
> y **no arrastraba el worker**, así que la subida moría con
>
> ```
> Setting up fake worker failed: Cannot find module
> '.../.next/server/chunks/pdf.worker.mjs'
> ```
>
> **En desarrollo y en `vitest` funcionaba**, porque ahí la librería se carga de
> `node_modules` y el hermano existe. El fallo aparecía por primera vez en la
> instancia de un cliente, la primera vez que alguien subiera un recibo.
>
> Hacen falta **las dos** correcciones, y ninguna basta sola:
>
> 1. `serverComponentsExternalPackages: ['pdfjs-dist']` en `next.config.mjs`, para
>    que la librería no se empaquete y quede como paquete de node — así
>    `./pdf.worker.mjs` resuelve a su hermano, que es la ruta correcta.
> 2. Un `await import('pdfjs-dist/legacy/build/pdf.worker.mjs')` **a mano** en
>    `lector-pdf.ts`. Es literal, el trazado sí lo sigue, y el módulo queda en
>    caché para cuando pdf.js lo pida.
>
> Lo caza `lib/test/energia-recibos-pdf.e2e.test.ts`, que corre contra el
> servidor **construido**. Una unitaria no puede verlo.

---

## 3 · Qué se lee, y de dónde

Las tres plantillas que aparecen en los 72:

| Tarifa | Cuántos | Dónde están los kWh |
|---|---|---|
| **PDBT** | 57 | `Energía (kWh) 74,978 72,230 2,748` → la **tercera** cifra. Las dos primeras son las lecturas del medidor; quedarse con la primera da un costo por kWh 27 veces menor y sigue pareciendo normal |
| **GDMTO** | 12 | `kWh B000BB 48,285 41,176 7,109 7,109` → la **última** |
| **GDMTH** | 3 | **No hay total.** Hay `kWh base`, `kWh intermedia` y `kWh punta`, y se **suman**. Quedarse con una declara menos de un cuarto del consumo |

### El desglose, sin mirar coordenadas

El PDF pinta dos columnas y una línea de texto trae las dos pegadas
(`Transmisión 0.00 0.00 497.11 497.11 Subtotal 7,257.97`). El par de la derecha
se saca leyendo **de derecha a izquierda**: el último componente es el monto y la
etiqueta son las palabras que lo preceden **hasta topar con otra cifra**.

Se hace así y no por la `x` de cada trozo a propósito: la `x` de la columna
cambia entre las tres plantillas, y la forma «palabras, luego número, y antes
otro número» es la misma en las tres.

---

## 4 · Qué importe se propone, y por qué NO el `Total`

**El `Total` del recibo no es el costo de la luz del periodo.** Lleva dentro el
adeudo anterior, los pagos hechos y —en **8 de los 72**— un `Deposito` en
garantía.

> En `437250907744 (GDL CAMICHINES)` la luz del periodo son **994.64** y el
> `Total` son **4,309.64**. Capturar el `Total` multiplicaría por **4.3** el
> costo de ese predio, con un número perfectamente creíble.

Se propone `Facturacion del Periodo` **+ el alumbrado público** (`DSAP` o
`DAP((2))`, que son la misma cosa con dos etiquetas). Lo demás queda visible en
`conceptos` para que quien confirma lo vea.

### La comprobación que hace esto fiable

El recibo se comprueba a sí mismo: `Facturacion del Periodo` **más todos los
conceptos posteriores** tiene que dar exactamente el `Total` impreso. Si no
cierra, alguna cifra se leyó mal **y se dice**, en vez de devolver números
creíbles y falsos.

**Medido: cierra en los 72, al centavo.** Las etiquetas que aparecen después de
la facturación son cinco: `Adeudo Anterior` (38), `Su Pago` (38), `DSAP` (9),
`Deposito` (8) y `DAP((2))` (5).

---

## 5 · El periodo: un recibo de CFE NO es mensual

Es el hallazgo que más manda sobre el diseño.

`consumos_energia.periodo` es el **día 1 de un mes** y lo exige un CHECK. Pero de
los 72 recibos medidos, **solo UNO cabe dentro de un mes de calendario**:

| Meses que toca | Recibos |
|---|---|
| 1 | **1** |
| 2 | 19 |
| 3 | **49** |
| 4 | 3 |

Hay periodos de `23 JUN 25 – 21 AGO 25`, de `09 MAY 25 – 22 AGO 25` (tres meses y
medio) y de `12 NOV 25 – 21 NOV 25` (nueve días).

Meter un recibo bimestral entero en un mes hace **dos daños a la vez, y ninguno
da error**: ese mes queda con el doble del costo que tuvo, y el mes de al lado
queda vacío — que el reporte declara como «falta recibo» **para siempre**, porque
nunca va a llegar uno.

Por eso `repartirEnMeses()` propone **un renglón por mes de calendario**, con los
kWh y el importe repartidos por los días que caen en cada uno. Es la misma regla
que ya aplica el motor del reporte a un recibo mensual cuando el bucket lo corta
a la mitad (`lib/data/reportes.ts`, «COSTO DE LA ENERGÍA»): aquí se aplica un
nivel antes, al recibo entero.

**El último renglón absorbe el redondeo** y por eso se calcula restando: sin eso,
repartir 100 entre 1/28/1 días deja 99.99 y el centavo no lo busca nadie.

> [!warning] Esto es una PROPUESTA y está abierto a decisión del dueño
> La alternativa es meterlo todo en el mes dominante. Está en las preguntas
> abiertas del informe del 29/09.

---

## 6 · A qué predio va cada recibo — SIN tocar el esquema

Nada en la base guardaba el número de servicio de un predio. **No hizo falta
añadirlo.**

`consumos_energia.medidor` ya existe y su migración dice para qué: para que un
predio con **dos medidores** pueda tener sus dos recibos del mismo mes sin chocar
con el índice único. El **número de servicio** hace ese trabajo —en estos 72,
`PLAN DE SAN LUIS` tiene el `370220602321` y el `370220602330`— y además es
**estable**.

| Dato del recibo | Qué es | Dónde va |
|---|---|---|
| `NO. DE SERVICIO` (12 dígitos) | el contrato de suministro. **No cambia** | `consumos_energia.medidor` |
| `NO. MEDIDOR` (`G591TJ`) | el **aparato**. CFE lo sustituye sin que el servicio cambie | `notas`, junto con la tarifa y el periodo real |

El aparato como clave sería un defecto: el día que CFE cambie el medidor, la
clave única cambiaría con él y el recibo de ese mes entraría **duplicado sin dar
error**.

### El emparejamiento se APRENDE del historial

`consumosPorServicios()` busca recibos ya capturados con ese mismo número de
servicio y hereda su predio — el del recibo **más reciente**, por si la pantalla
cambió de manos. La primera vez de cada servicio la elige una persona; de ahí en
adelante sale solo.

Con los 72 del cliente eso son **29 elecciones manuales** (los 29 servicios) y
**43 automáticas**.

> La alternativa era una tabla nueva de servicios por predio. Cuesta una
> migración y su mantenimiento —alta, baja, quién lo teclea— para dar
> exactamente lo mismo que ya da la primera captura.

---

## 7 · El mismo recibo subido dos veces

Una sola consulta trae el historial del servicio, y sirve para dos cosas: heredar
el predio y **marcar el mes que ya está capturado, con las cifras que tiene la
base**, mientras la persona todavía mira el recibo.

**No se bloquea**: un recibo puede recapturarse porque el primero se tecleó mal.
Se enseña y decide quien mira. Y si se guarda igual, el índice único
`consumos_energia_predio_uq` lo corta con un **409** — la última defensa, y la
que no depende de que nadie lea la pantalla.

---

## 8 · La regla del CERO — decisión del dueño, 2026-09-29

> **Ni los kWh ni el importe se aceptan en cero ni en negativo.** Vengan de donde
> vengan.

Endurece la regla anterior, que solo exigía que «lo ilegible fuera vacío». Son
dos cosas distintas y las dos aplican:

1. Lo que no se pudo leer sale **vacío**. Nunca cero.
2. **Y un cero o un negativo LEÍDO del PDF se rechaza igual que un ilegible.** No
   es un dato: es una lectura fallida.

El motivo: **un cero no dice «no sé», dice «no consumió luz»**, y dentro del
reporte de rentabilidad esos dos hechos son exactamente el mismo número. Una vez
guardado no hay forma de separarlos.

Está escrita en **tres capas**, y ninguna sobra:

| Capa | Archivo | Qué hace |
|---|---|---|
| Lectura | `recibos-cfe/interprete.ts` (`aceptable`) | deja el campo vacío y **dice por qué** |
| Puerta | `recibos-cfe/cifras.ts` (`cifraDeRecibo`), usada por `energia-controller.ts` | **400** si llega un 0 o un negativo, venga de la pantalla o de la ruta directa |
| Comodidad | `components/demo/energia/recibos.ts` y `captura.ts` | el botón no deja confirmar, para no descubrirlo con un 400 |

> [!warning] Tiene un coste MEDIDO, y hay que saberlo
> **10 de los 72 recibos traen `kWh` impreso en CERO** con un importe que no lo
> es —el cargo fijo se cobra igual—, en **5 números de servicio**:
> `001250404243` (TJN VIA RAPIDA ORIENTE, 3), `504210702332` (GDL PLAZA
> GALERIAS, 2), `976190501334` (CDMX CUCHILLA, 3), `976250500201` (CDMX VDQ
> 2008, 1) y `988251100182` (CDMX RIO CONSULADO 2334, 1).
>
> Esos 10 salen con el campo vacío y marcado, **a propósito**: el dueño prefiere
> teclearlos a que un cero automático entre al reporte sin que nadie lo mire.
> Ninguno de los 72 tiene el importe en cero o negativo.

> [!note] La base sigue admitiendo el cero
> `consumo_energia_cifras_ck` es `kwh >= 0`. Apretarlo a `> 0` pide una
> migración nueva, y una migración es decisión del dueño. Hoy corta la
> aplicación. Está en las preguntas abiertas.

---

## 9 · Lo que se probó, y lo que no

**130 pruebas unitarias** en seis archivos (`recibos-cfe/` y
`components/demo/energia/`) y **16 e2e** contra el servidor construido. Los
recuentos globales se miden corriendo las suites, no se copian de aquí.

Los PDF de los recibos **no se versionan**: llevan razón social, domicilio, RFC
del receptor, número de cuenta, RMU y los sellos del CFDI de un cliente real. Lo
que sí está en el repositorio es el **texto de la página 1 anonimizado** de seis
de ellos (`recibos-cfe/casos.ts`), uno por cada forma distinta que aparece en los
72; los identificadores se sustituyeron por ficticios.

Los PDF de las pruebas del lector se construyen byte a byte en el propio archivo
de prueba, con las dos codificaciones dentro.

### Lo que NO se verificó

- **Nadie ha abierto la pantalla en un navegador.** `vitest.config.ts` no monta
  jsdom, así que `SubirRecibos.tsx` no lo prueba nadie: lo que está probado es la
  lógica de `components/demo/energia/recibos.ts`.
- **No se ha subido ninguno de los 72 PDF reales por la ruta HTTP.** El
  interpretador se midió contra los 72 fuera del repositorio; la ruta se midió
  con PDF sintéticos.
- **El tiempo y la memoria de una tanda de 40 archivos.** Los PDF se leen en
  serie por eso, pero no se midió.
