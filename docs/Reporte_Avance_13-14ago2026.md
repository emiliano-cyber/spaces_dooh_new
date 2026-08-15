# Avance · 13 y 14 de agosto de 2026

Rama: `feat/servidor-padre-instancias` · Plan: `docs/Plan_Instancias_Soberanas_v3.md`
Alcance: **ejecución local**. Nada de esto se ha aplicado al servidor todavía.

**11 cambios de producto** en dos días, todos con prueba y auditoría. La suite pasó de
789 a **805 pruebas unitarias** (73 archivos) y de 12 a **14 archivos de integración**
(147 pruebas + 1 saltada).

---

## Dónde está cada fase

| Fase | Estado | Qué falta |
|---|---|---|
| **0** · Cerrar el autoregistro | Lo que se podía hacer en local, hecho | Dos comprobaciones en el servidor |
| **1** · Limpieza de los `DEFAULT` de organización | Cerrada en local | Aplicar la migración al servidor |
| **2** · Release versionado | Parcial | El **nombre del registro de imágenes**, que es decisión pendiente |
| **3** · Actualizaciones automáticas | Arrancada | El resto de la fase |
| **4 a 8** | Sin empezar | — |

---

## Fase 0 · El registro de cuentas nuevas

**La plantilla de configuración ya nace con el registro cerrado, y una prueba lo
sostiene.** Antes bastaba con que alguien cambiara un `1` por un `0` en un archivo de
ejemplo para que un despliegue nuevo abriera el registro sin que nadie se enterara;
ahora ese cambio pone la suite en rojo.

Se retiró además una variable de configuración que proponía **compartir la sesión
entre subdominios** (`COOKIE_DOMAIN`). Venía del modelo de despliegue anterior, ya
descartado. No hacía daño hoy —el programa no la lee— pero seguía en la plantilla que
se copia para montar un servidor real, y mandaba a quien lo montara a pedir
certificados y DNS para un diseño que ya no existe.

**Queda pendiente en el servidor:** confirmar si el registro está abierto ahora mismo
en el droplet. Es una comprobación de lectura, y según el plan **bloquea toda la
Fase 4**.

---

## Fase 1 · Las filas que nacían con la organización equivocada

El problema de fondo: veintitrés tablas tenían un valor por omisión que etiquetaba
cualquier fila nueva con una organización concreta cuando el programa olvidaba
indicarla. No daba error: escribía mal y seguía.

**Lo hecho:**

- **La migración que retira ese valor por omisión**, escrita y probada. A partir de
  ella, un alta sin organización **truena** en vez de mentir. Recorre el catálogo de
  la base en vez de una lista escrita a mano, porque el servidor tiene tablas que el
  repositorio no trae.
- **El cupo de clientes por pantalla** ya no depende solo del aislamiento de la base:
  la consulta filtra por organización de forma explícita.
- **Entrar por la dirección IP del servidor** ya no se confunde con un subdominio.

**Y dos arreglos que no estaban en el plan**, descubiertos al comprobarlo: el guion
que crea el primer usuario de una instalación **llevaba tiempo roto** y fallaba
siempre, por dos motivos distintos; y además, si no se le decía a qué base escribir,
**escribía en la base con datos reales**. Ahora exige que se le diga, y aborta con un
mensaje claro si falta.

**Queda pendiente en el servidor:** aplicar la migración. Hasta que se haga, el
problema sigue vivo en producción.

---

## Fase 2 · La imagen que va a correr en cada instalación

**Existe una imagen de la aplicación**, autocontenida, que lleva dentro el esquema de
la base y sus migraciones. Es lo que permite que montar una instalación nueva no
exija clonar el repositorio en el servidor.

También se resolvió una contradicción que bloqueaba la fase: la bandera del registro
de cuentas **se decidía al compilar**, así que hacía falta una imagen distinta por
cada configuración. Ahora se decide al arrancar, y **una sola imagen sirve para todas
las instalaciones**.

De paso apareció y se corrigió un defecto que nadie había visto: la pantalla de acceso
**mostraba el botón «Crear cuenta» aunque el registro estuviera cerrado**. Quien lo
pulsara recibía un error. El botón venía fijado al compilar y ningún ajuste de
configuración lo quitaba.

**Bloqueado:** publicar la imagen y promoverla a versión estable. Falta decidir **el
nombre del registro de imágenes**. Es lo único que separa a esta fase del cierre.

---

## Fase 3 · Que cada instalación sepa qué lleva aplicado

Arrancada. **Cada instalación lleva ya un registro de qué migraciones ha corrido.**
Antes no existía: el despliegue reaplicaba todas en cada vuelta y confiaba en que
fueran inofensivas. Funcionaba, pero era imposible saber en qué versión de base estaba
un servidor.

El registro nace con **65 migraciones históricas** dadas por aplicadas. Se dejaron
fuera a propósito la migración de la Fase 1 —que está escrita pero **no aplicada** en
producción, y darla por hecha habría impedido que se aplicara nunca— y una corrección
de datos de julio de la que no consta que se ejecutara.

---

## Las imágenes generadas

| Imagen | Tamaño | Contenido |
|---|---|---|
| `space-os:dev` | **240 MB** | Aplicación autocontenida + `schema.sql` + las 67 migraciones, con el número de versión sellado dentro |

Arranca en **68 milisegundos** y sirve la pantalla de acceso **con sus estilos**, que
era el riesgo real: los archivos estáticos no viajan solos en este tipo de artefacto y
hay que copiarlos a mano.

Se comprobó, con la misma imagen y sin recompilar, que **cambiar la configuración
cambia el comportamiento**: con el registro apagado el alta responde «deshabilitado» y
el botón no aparece; con el registro encendido, aparece y funciona.

Y se verificó que **no contiene credenciales**. La comprobación no fue «buscamos y no
encontramos nada»: primero se confirmó que el método detecta las credenciales cuando
sí están, y solo entonces se afirmó que dentro de la imagen no hay ninguna.

Durante las comprobaciones se construyeron y destruyeron otras seis imágenes de
prueba. Queda solo la de arriba.

---

## Entregables

- **Expediente de evidencias en PDF** — 49 páginas, con portada, índice, un resumen de
  las nueve fases del plan y un capítulo por cada fase documentada. Entregado como
  archivo.
- **Tres expedientes de texto**, en `docs/evidencias/`, de donde el PDF se vuelve a
  generar cuando haga falta.

---

## Decisiones tomadas

| Fecha | Decisión |
|---|---|
| 13/08 | La bandera del registro de cuentas **sale del compilado**: una sola imagen para toda la flota |
| 14/08 | El registro de cuentas nuevas va **cerrado en todas partes**, DEMO incluida. Revierte la decisión del 10/08 |

---

## Lo que espera a una persona

Ninguna de estas se puede hacer desde el repositorio. Cinco comprobaciones, todas de
lectura salvo donde se indica:

| | Qué | Por qué importa |
|---|---|---|
| 1 | ¿Está abierto el registro de cuentas en el droplet? | **Bloquea toda la Fase 4** |
| 2 | Censo de las filas mal etiquetadas en producción | Sin él, la migración de la Fase 1 no se puede aplicar |
| 3 | Comprobar la configuración del cupo de clientes | Cierra el visto bueno de uno de los cambios |
| 4 | Aplicar las dos migraciones al servidor, **en orden** | Primero el registro de migraciones, después la limpieza. Al revés queda mal registrado |
| 5 | Revisar si la variable de sesión retirada sigue en los archivos ya desplegados | Higiene; nada bloqueado |

**Siete cambios están marcados para revisión humana antes de integrarse**, por tocar
sesión, organización, credenciales o migraciones. Ninguno está en la rama principal.

---

## Lo que NO está probado

Conviene decirlo con la misma claridad que lo anterior:

- **Nada se ha aplicado a producción.** El servidor sigue corriendo la versión
  anterior, y los problemas que las migraciones corrigen **siguen vivos allí**.
- **La imagen no puede levantar una base desde cero por sí sola.** Falta quien cree el
  usuario de base de datos de la aplicación; sin él, la cadena de migraciones se corta.
  Es trabajo de la Fase 3 y del aprovisionamiento.
- **Las comprobaciones locales no prueban producción.** La base de desarrollo tiene
  datos de ejemplo: 33 filas en total, y las organizaciones donde se detectó el
  problema original **no existen ahí**. Un cero en una consulta local no significa que
  esté limpio, significa que no hay nada que mirar.
- **Sin dominio, sin certificado y sin registro de imágenes**, así que nada de lo
  relativo a sesiones sobre HTTPS o a descargar la imagen en un servidor queda
  demostrado.

---

*Preparado el 2026-08-14.*
