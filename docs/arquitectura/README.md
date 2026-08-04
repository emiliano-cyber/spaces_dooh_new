# Documentación de arquitectura — SPACE OS

Dos entregables sobre el mismo modelo de datos: uno para personas y otro para agentes.

| Archivo | Para quién | Cómo se usa |
|---|---|---|
| `arquitectura.html` | Personas | Ábrelo con doble clic. Es autocontenido: no pide red, ni CDN, ni servidor. |
| `arquitectura.json` | Agentes de IA, auditorías, scripts | Pásalo como contexto. Contiene el grafo completo y los flujos paso a paso. |

---

## 1 · `arquitectura.html` — explorador interactivo

Un solo archivo (~312 KB) con el grafo del sistema, sus flujos y el catálogo técnico.

**Grafo**
- 142 nodos organizados automáticamente en 12 capas, de los actores a las integraciones externas.
- 313 conexiones tipadas: HTTP, import, SQL, subproceso, evento, cron.
- Rueda del ratón para acercar, arrastrar el fondo para desplazar, arrastrar un nodo para moverlo.
- **Reacomodar** recalcula las posiciones (ordenación por baricentro, ocho pasadas, para reducir cruces).
- **Ajustar** encaja todo el grafo en pantalla.
- Clic en una capa de la leyenda para ocultarla o mostrarla.

**Panel de flujos (derecha)**
- 26 flujos reales del sistema agrupados por categoría, con su número de pasos, componentes y APIs.
- Al elegir uno: se resalta su camino, se atenúa el resto, se numeran los nodos en orden de ejecución
  y aparece abajo la secuencia detallada. El clic en el número de un paso centra el nodo.
- Pestaña **Grupos**: los 9 módulos funcionales y las 12 capas técnicas, cada uno con su balance de
  relaciones (ver abajo).
- Pestaña **Catálogo**: los 64 endpoints, las 41 tablas y objetos de base de datos, los 6 jobs,
  los 16 eventos, los 6 servicios y los 9 módulos. Todo enlazado al grafo.

**Iluminar lo relacionado (clic en cualquier nodo)**
- El nodo elegido queda en ámbar; **naranja** lo que él usa (*depende de*) y **azul** lo que lo usa
  a él (*dependen de él*). Son dos preguntas distintas y con un solo color se confunden: en un grafo
  con aristas en ambos sentidos, «quién me rompe si lo cambio» y «qué rompo yo» no son lo mismo.
- Un nodo que aparece por los dos lados (por ejemplo `db.ts` ↔ `tenant.ts`, que se importan en
  ciclo) se pinta en un tercer tono.
- El control **Relación 1 · 2 · Todo** de la cabecera fija cuántos saltos se iluminan. A 1 salto
  ves el vecindario inmediato; con **Todo** ves el subgrafo alcanzable completo (lo que a `db.ts` lo
  vuelve el nodo más crítico del sistema: casi todo cuelga de él).
- **Encajar en pantalla** ajusta el zoom a esa vecindad.
- Solo pasando el cursor por encima ya se levantan las aristas del nodo, sin atenuar nada.
- Si hay un flujo iluminado, abrir una ficha **no** lo pierde; para cambiar a la vecindad está el
  botón *Iluminar lo relacionado*.

**Ver las relaciones de un módulo o de una capa entera**

El mismo resaltado funciona con un conjunto de nodos, no solo con uno. Se llega desde tres sitios:

- La pestaña **Grupos**, con una tarjeta por cada uno de los 9 módulos funcionales y las 12 capas
  técnicas. Volver a pulsarla lo apaga; el desplegable lista sus nodos sin perder el resaltado.
- El **rótulo de la capa** dentro del propio grafo (`REPOS / MODELOS`, `API BFF`, …).
- La sección *Grupos a los que pertenece* de la ficha de cualquier nodo.

Con un grupo iluminado, las aristas se separan en tres:

| | Qué es |
|---|---|
| **Punteada gris** | Relación **interna**: se queda dentro del grupo. Es su cohesión. |
| **Naranja** | **Sale** del grupo: de qué depende hacia fuera. |
| **Azul** | **Entra** al grupo: quién depende de él. |

Cada tarjeta trae ese balance en números (`11 nodos · 11 internas · 14 salen · 15 entran`), que es
la forma rápida de ver si un módulo está bien delimitado o si tiene más frontera que interior.
Un ejemplo real: la capa **Repos / Modelos** tiene 11 relaciones internas contra 89 que cruzan —
normal en una capa, porque su trabajo es precisamente ser atravesada; en un *módulo* la misma
proporción sería una señal de que no está bien recortado.

**Ficha del nodo**
Nombre, tipo, capa, descripción, responsabilidad, archivos, tecnologías, APIs que usa, tablas que
toca, dependencias, dependientes, flujos que lo atraviesan y etiquetas. Las dependencias son
navegables: un clic salta al nodo y vuelve a iluminar desde ahí.

**Otros**
- Tooltip al pasar el cursor, con el resumen y el grado de conexión.
- Buscador (`/` para enfocarlo) sobre nodos, archivos, endpoints, tablas, jobs, eventos y flujos.
- Modo oscuro por defecto, claro con el botón `◐`. La preferencia se recuerda.
- `Esc` limpia el resaltado y cierra la ficha; **Limpiar** hace lo mismo desde la cabecera.
- Responsive: en pantallas angostas el panel pasa debajo del grafo.

---

## 2 · `arquitectura.json` — contexto para agentes

```
{ $schema, generado, project, nodes, edges, flows,
  modules, services, apis, database, events, jobs, files }
```

**`nodes[]`** — `id`, `nombre`, `tipo`, `capa`, `descripcion`, `responsabilidad`, `archivos[]`,
`tecnologias[]`, `apis[]`, `basedatos[]`, `etiquetas[]`, y tres campos derivados de las aristas:
`dependencias[]`, `dependientes[]` y `flujos[]`.

**`flows[]`** — `nombre`, `descripcion`, `objetivo`, `resultado`, `componentes[]`, `archivos[]`,
`apis[]`, `consultas[]` (el SQL real), `validaciones[]` (las reglas que se aplican y por qué) y
`pasos[]` con `{ n, nodo, titulo, detalle, archivo }`.

Los 144 pasos están escritos para que un agente recorra el flujo completo **sin volver a leer el
código**: cada uno dice qué archivo lo implementa, qué nodo del grafo es y qué hace exactamente.
Algunos flujos añaden `riesgos[]` o `notas[]` con lo que conviene saber antes de tocarlos.

---

## Regenerar

El modelo se mantiene en piezas dentro de `_src/`; el script las ensambla, valida la integridad
referencial (aristas y pasos que apunten a nodos existentes, capas conocidas, ids únicos) y produce
los dos archivos:

```bash
node docs/arquitectura/_src/build.mjs
```

| Pieza | Contenido |
|---|---|
| `_src/01-project.json` | Metadatos del proyecto y definición de las 12 capas |
| `_src/02-nodes-a…d.json` | Los 142 nodos, agrupados por capa |
| `_src/03-edges.json` | Las 313 conexiones |
| `_src/04-flows-a,b.json` | Los 26 flujos con sus 144 pasos |
| `_src/05-catalogos.json` | `modules`, `services`, `apis`, `database`, `events`, `jobs`, `files` |
| `_src/template.html` | La aplicación (CSS + JS en vanilla, sin dependencias) |

El script falla con código 1 si algo no cuadra, así que sirve como comprobación en CI.

---

## Qué NO está en el grafo, a propósito

`_archive/api` (Fastify + Prisma) y `_archive/web-frontend-2` **no están desplegados**: son código
retirado. Aparecen como un solo nodo (`devops-archivo`) precisamente para que nadie los confunda con
el camino vivo. Lo mismo vale para `apps/web/lib/data/adapters/http.ts` y `lib/api-client.ts`, que
apuntaban a ese backend y hoy lanzan «no implementado».

El producto vivo es **apps/web** y solo apps/web.
