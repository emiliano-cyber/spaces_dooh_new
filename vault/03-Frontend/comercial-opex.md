---
tipo: modulo
estado: en-curso
actualizado: 2026-09-30
tags: [frontend, comercial, prospeccion, arrendadores, maqueta]
archivos:
  - apps/web/app/(app)/(shell)/comercial-opex/page.tsx
  - apps/web/components/demo/comercial-opex/ComercialOpex.tsx
  - apps/web/lib/comercial-opex.ts
  - apps/web/lib/comercial-opex.test.ts
  - apps/web/components/demo/shell/nav.ts
  - apps/web/lib/modulos.ts
---

# Comercial OPEX · prospección de arrendadores

> [!warning] Esto es una MAQUETA, y el `estado: en-curso` de arriba es literal
> **No tiene base, no tiene API y no guarda nada.** Los cinco espacios que pinta
> están escritos en `lib/comercial-opex.ts`. Se pidió así el **2026-09-30**:
> *«por ahora solo será html sin funciones»* y *«el mapa ese no lo añadas»*.
>
> Sirve para **acordar la forma antes de construirla**, y la pantalla lo dice
> arriba en un aviso ámbar para que nadie la confunda con algo que funciona.

> [!note] 2026-09-30, tarde · acomodada en dos columnas, y Captación se oculta
> Pedido del dueño: *«acomoda de mejor manera el comercial opex y elimina
> captación por ahora u ocúltalo»*.
>
> - **Antes:** una sola columna; el detalle era SOLO del primer espacio y no se
>   podía elegir otro, con ocho secciones apiladas.
> - **Ahora** (`components/demo/comercial-opex/ComercialOpex.tsx`): las cuatro
>   cifras arriba; a la izquierda la lista de espacios —estado, negociante,
>   días sin contacto—, y al pulsar uno, su detalle a la derecha: la búsqueda
>   del responsable como **barra de pasos**, el último contacto destacado, y
>   bloques lado a lado (ficha y contactos; ofertas a lo ancho; historial como
>   línea de tiempo; competencia, multimedia y documentos). Colores del tema,
>   no grises sueltos.
> - **Sigue siendo maqueta:** elegir qué espacio mirar no guarda nada ni llama a
>   la API. `espacioElegido()` (`lib/comercial-opex.ts`, con prueba) cae al
>   primero si el id no existe: nunca una pantalla de detalle vacía.
> - La página se queda como Server Component para fijar la fecha de hoy UNA vez
>   y pasársela al componente: así «hace N días» sale igual en el HTML y al
>   hidratar.
>
> **Captación (CAP-01) se oculta del menú** a favor de esta pantalla. Solo se
> quitó la entrada de `nav.ts`: las tablas, la API y el módulo `captacion` de
> permisos siguen. Ver [[02-Backend/captacion]]. Cuando esto se construya hay
> que decidir si va ENCIMA de `prospectos` (lo que ya existe) o aparte —aparte
> duplicaría la bitácora—.

## Qué contesta

**Quién manda en un espacio que todavía no es nuestro, y cómo va su renta.**

El producto empieza cuando el espacio **ya es tuyo**: [[inventario-y-sitios]] →
[[arrendadores-y-contratos]]. Esto es lo de antes: un muro, una azotea o un
terreno que estás persiguiendo, al que le estás **buscando el dueño**.

Por eso no puede vivir en `sitios`: un prospecto **no es un sitio todavía**, y
meterlo ahí lo sacaría en inventario, en el mapa de pantallas y en los reportes
de rentabilidad como si lo tuvieras.

## Las cinco etapas, que son la columna vertebral

`ETAPAS_RESPONSABLE` — y no son etapas de venta, son etapas de **averiguar a
quién hay que convencer**:

1. Sin contacto
2. Vecinos o intermediarios
3. Dueño identificado
4. En contacto con el dueño
5. **Responsable legal confirmado** ← la que cierra: quien firma

Una prueba lo ata: un espacio en la última etapa **tiene que tener un contacto
marcado `legal`**. Si no, la etapa está mintiendo.

## Lo único que aquí se CALCULA

Dos cosas, y viven en `lib/comercial-opex.ts` **con pruebas**, no dentro del
`.tsx`:

- **`diasSinContacto()`** — y devuelve **`null`, no `0`**, cuando nunca se ha
  hablado con nadie. «No se sabe» y «se habló hoy» son cosas distintas; pintar
  un cero donde no hay dato es el mismo error del `?? 0` del mapa y de los kWh
  de los recibos de CFE.
- **`enfriados()`** — los que hay que retomar: **en negociación** y con más de
  30 días sin contacto. El estado importa: un `activo` lleva meses sin llamada
  porque ya está contratado y va bien, y un `inactivo` no se persigue.
  Contarlos llenaría el aviso de ruido, **y un aviso que salta siempre deja de
  mirarse**.

> **Por qué fuera del `.tsx`:** porque dentro no lo comprueba nada — el arnés no
> monta DOM. En la semana del 28/09 tres mutantes que borraban avisos del
> reporte **sobrevivieron** por exactamente eso. Ver [[reportes-dimensiones]].

## ⚠ Se solapa con Captación, y hay una decisión abierta

**[[02-Backend/captacion]] ya existe y SÍ tiene base**: `prospectos` y
`prospecto_avances` (`db/migrations/20260930_captacion.sql`), con etapa,
siguiente paso, vendedor, bitácora y aprobación. Su pantalla está en
`/captacion`, justo encima de ésta en el menú.

Lo que esta maqueta trae y aquello **no** tiene:

| | Captación (real) | Comercial OPEX (maqueta) |
|---|---|---|
| Contactos | **uno**, en un `jsonb` | **varios**: dueño, apoderada, vecina, portero |
| Competencia | no | sí: quién más ofrece y cuánto |
| Ofertas de renta | no | historial v1/v2/v3 con importe, plazo y estado |
| Multimedia | no | fotos y video del espacio |
| Etapas | 8, de embudo de venta | 5, de **encontrar al responsable** |

> [!danger] La decisión que hay que tomar antes de construir esto de verdad
> **¿Se construye ENCIMA de `prospectos`, o aparte?** Aparte duplicaría la
> bitácora, que es justo lo que no conviene tener dos veces. No está decidido, y
> está anotado en el código para que no se pase por alto.

## Y una trampa de nombres que conviene no repetir

Las **«ofertas de renta»** de esta pantalla NO son las [[comercial-propuestas-campanas|propuestas]]
del producto. Aquéllas son **propuestas a un cliente que compra publicidad**;
éstas son **ofertas al dueño del espacio**. Sentido contrario y dinero
contrario. Meterlas en la misma tabla por llamarse parecido sería el error caro.

## Permisos

Módulo **`comercial`**, con `apiPropia: false` porque hoy no tiene API. La ven
Dueño, Administrador y los tres roles de venta — el mismo reparto que Captación.

El día que tenga API, `apiPropia` pasa a `true` y hay que decidir si su módulo
sigue siendo `comercial` o se va con `captacion`. Ver [[02-Backend/roles-de-venta]].

## Lo que NO se hizo

- **El mapa del prototipo.** Pedido explícitamente fuera.
- **Elegir otro espacio.** Se detalla el primero; sin interactividad no hay
  forma de cambiar, y añadirla sería la «función» que se pidió dejar fuera.
- **Nadie la ha abierto en un navegador.** Compila y entra en el build; la
  lógica tiene 10 pruebas. El `.tsx` no lo ha visto nadie.
