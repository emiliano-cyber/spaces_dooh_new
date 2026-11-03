---
tipo: tablero
estado: en-curso
actualizado: 2026-11-03
tags: [frontend, i18n, ingles, olas, agentes, dinero]
archivos:
  - apps/web/lib/i18n/diccionario.ts
  - apps/web/lib/i18n/textos/
  - apps/web/lib/i18n/textos/costura.test.ts
  - scripts/i18n-inventario.mjs
  - docs/i18n/
---

# La versión en inglés, ola por ola

Esta nota es **el tablero del trabajo**: qué se tradujo, en qué rama, quién lo
validó y qué falta. **Cómo funciona** el inglés —la regla del idioma, las claves,
el dinero, los errores del servidor y el glosario de cada lote— está en
[[idiomas-es-en]], que es la fuente técnica. Aquí no se repite.

> [!important] Nada de esto está en `main`
> Lo pidió el dueño el 2026-11-02: **todo vive en ramas separadas de `main`**.
>
> - Lo aprobado se junta en **`integra/ingles`**.
> - Cada lote en curso tiene su propia rama `feat/…`, que sale de `integra/ingles`.
> - No se ha empujado nada al remoto ni se ha abierto ningún PR.
> - El PR hacia `main` se abre **solo cuando el dueño lo pida**.

> [!warning] El inglés sigue APAGADO
> `IDIOMA_INGLES` no está en `1` en ninguna instancia. Ningún usuario ve un
> cambio hasta que se encienda, y no se enciende hasta cerrar la ola 5 (§4).
> Encenderlo con media aplicación traducida reproduce la mezcla que obligó a
> apagarlo el 30/09 (ver [[idiomas-es-en]], el primer recuadro).

## 1 · Cómo se trabaja cada lote

El dueño lo pidió así el 2026-11-02: **dos agentes por lote, uno que traduce y
otro que valida el sentido de cada frase completa en su contexto**.

```
traductor  ──►  validador  ──►  ¿VERDE?  ──sí──►  se junta en integra/ingles
                    │
                    └── ÁMBAR/ROJO ──► el traductor corrige ──► 2.ª pasada del validador
```

- **El validador es una sesión distinta** y no recibe el razonamiento del
  traductor: recibe el código. Lee cada frase en el HTML inglés que se rinde, no
  palabra por palabra.
- **Siempre se comprueba de forma mecánica:** el HTML español de cada estado se
  vuelca antes y después y se compara (`diff -rq`); `DICCIONARIOS.es` debe quedar
  con **0 valores cambiados**; y se aplican mutantes para ver que las pruebas
  muerden.
- **Cada lote deja dos documentos:** su tabla de revisión
  (`docs/i18n/revision-<lote>.md`) y el informe del validador
  (`docs/i18n/validacion-<lote>.md`).
- **El encargo común** de la tercera ola fija las reglas para todos los lotes:
  español idéntico, claves por ámbito en `lib/i18n/textos/`, `MX$` en inglés,
  qué no se traduce nunca y el glosario completo.

## 2 · Las olas

### Ola 1 · Piloto

| Lote | Rama | Veredicto | Notas |
|---|---|---|---|
| Propuestas | `feat/ingles-propuestas` | **VERDE** (2.ª pasada) | Fijó el método. 440 claves |

### Ola 2 · Los módulos de venta

| Lote | Rama | Veredicto | Notas |
|---|---|---|---|
| Compartidos (`lib/`: periodos, calculadora, mapa, `ui/`) | `feat/ingles-compartidos` | **VERDE** (2.ª) | 72 claves; fijó millar, catorcena, periodicidades |
| Campañas y finanzas | `feat/ingles-campanas-finanzas` | **VERDE** (2.ª) | 571 claves; CFDI UUID, Payment terms, Submitted for publishing |
| Comercial y códigos | `feat/ingles-comercial` | **VERDE** (2.ª) | 559 claves; Lease negotiation, Poster panel, Spec sheet |
| Costura (une los lotes) | `feat/ingles-costura` | **VERDE** (2.ª) | Un solo selector de periodo; `costura.test.ts` (mismo español → mismo inglés) |

### Moneda (zona ROJA, va con el inglés)

| Tarea | Rama | Veredicto | Notas |
|---|---|---|---|
| Moneda fija por instancia | `feat/moneda-por-instancia` | **VERDE** (2.ª) | ADR 0048: MXN o USD al crear la instancia, inmutable después |
| `MX$` en las pantallas en inglés | `feat/moneda-simbolo-ingles` | **VERDE** | 20/20 mutantes; el español no cambia |

### Ola 3 · El resto de la interfaz (cerrada: todo integrado)

| Lote | Rama | Estado |
|---|---|---|
| Catálogos de precio (paquetes, franjas y temporadas, volumen) | `feat/ingles-operaciones` | **VERDE** (2.ª). Integrado en `integra/ingles` (85a8ee67). Incluye el aviso de `CampoCifra` en inglés para toda la app |
| Space Eyes | `feat/ingles-space-eyes` | **VERDE** (2.ª). **Integrado** por la costura 2 (`feat/ingles-costura-2`), que le añadió `spaceeyes.comun.sin-hablar`. «Vincular» se queda igual en los dos idiomas: la app Android solo está en español (dueño, 02/11) |
| Inventario y arrendadores | `feat/ingles-inventario-arrendadores` | **VERDE** (2.ª). **Integrado** por la costura 2. `/razones-sociales` usa las claves de admin. El texto legal del contrato NO se traduce (hash de las firmas); la constancia de firmas va en el idioma configurado (dueño, 02/11) |
| Administración, cuenta y shell | `feat/ingles-administracion` | **VERDE** (2.ª). Integrado (bb365fa3). 705 claves |
| Clientes, comisiones, captación, disponibilidad, almacén, imprenta | `feat/ingles-operaciones-clientes` | **VERDE** (2.ª). **Integrado** por la costura 2. 397 claves |
| Costura 2 (une los tres de arriba) | `feat/ingles-costura-2` | **VERDE**. Integrada (a2fd2cfb). Un solo ayudante de huellas de formato español (`lib/i18n/guardias-ingles.ts`) para las pruebas de pantallas de todos los lotes |
| OT, creativos, Dashboard y energía | `feat/ingles-operaciones-2` | **VERDE** (2.ª). Integrado (939efe93). 471 claves. El Dashboard: solo textos, y una instantánea con sus clases lo protege |
| Reportes de rentabilidad | `feat/ingles-reportes` | **VERDE** (2.ª). Integrado (7059fdce). 148 claves; las notas del motor viajan en español y la pantalla las rearma en inglés |

### Ola 4 · Lo que sale del servidor (cerrada para el encendido en beta)

| Lote | Rama | Estado |
|---|---|---|
| Plantillas de error con huecos y motivos compartidos con el servidor | `feat/ingles-servidor` | **VERDE**. Integrado. 45 plantillas por patrón, 31 claves `servidor.*`; la calculadora dice lo mismo en servidor y pantalla. Pendiente para otra ola: ~108 frases de dominio y 7 rutas que responden `e.message` (las más visibles: los `confirm` de aprobar en $0 y descuento sobre el tope) |
| Las confirmaciones de aprobar una propuesta (en $0 y descuento sobre el tope) | `feat/ingles-confirmaciones` | **VERDE**. Integrado (15022a6a). Siguen en español, para otra ola: el tope al EDITAR el descuento y el 400 de la negociación con la agencia sin validar |
| «pesos» en redacción neutra (español **e** inglés) | `feat/pesos-neutral` | **VERDE** (2.ª). Integrado (00815aa3). Hecho (02/11): cuatro claves de Paquetes, «cantidad entera / sin centavos / exacto». El resto del español, idéntico (medido). Y los tres menores del validador de catálogos. Ver [[idiomas-es-en]] §7 |

### Ola 5 · Cierre (cerrada: integrada el 2026-11-03)

Al 2026-11-02 por la noche **toda la interfaz está traducida e integrada** en `integra/ingles` (7059fdce): `npm test` 6645 de 6645 en verde, typecheck limpio, y el inventario baja a **211** textos en 91 archivos (de unos 2200), casi todos tablas españolas que se quedan a propósito como la verdad, datos y falsos positivos de clases CSS. Quedan los menores preventivos de la guardia de formato y de estilo que dejaron los validadores.

Recorrido completo de la aplicación con `IDIOMA_INGLES=1` en un navegador real,
pantalla por pantalla. El inventario (`node scripts/i18n-inventario.mjs`) debe
quedar solo con falsos positivos. Con eso, el dueño decide si se enciende.

| Lote | Rama | Estado |
|---|---|---|
| Recorrido en navegador y menores de los validadores | `feat/ingles-ola5` | **VERDE**. Integrado (b13de665). Informe en `docs/i18n/validacion-ola5.md`: español idéntico en 550 estados, 14 de 15 mutantes; el que sobrevivía (espera de dos cifras en el login) lo mata una prueba añadida al integrar |

Detalle del lote:

- **Recorrido.** Todas las pantallas del menú, las fichas, los diálogos de alta y
  las páginas públicas, en el 3420 con la base propia `spaces_ola5`.
- **Siete hallazgos corregidos:** el galón de las tarjetas plegables, los fallos
  de `/login`, el menú móvil, la periodicidad de la renta, las fechas del
  pipeline, «fijo» y el tipo de medio en la liga pública.
- **Los ocho menores de los validadores, cerrados:** la guardia M1, M2 y M3,
  *legal entity*, las contracciones, «this is missing», el mutante `total<=2` y
  «Check them».
- **Cifras.** 6697 unitarias en verde y typecheck limpio. Español idéntico: 550
  estados, 0 valores de `DICCIONARIOS.es` cambiados.
- **Lo que el inventario no ve.** `scripts/i18n-inventario.mjs` siguió en 211 con los siete hallazgos dentro: no mira `login` ni `Sidebar`, no lee literales en plantillas ni datos pintados crudos. **El contador no basta para declarar terminado el inglés; el recorrido sí.**
- **Menores del validador, sin bloquear:** dos 400 de las rutas de acceso que la interfaz no provoca siguen en español (`Cuerpo inválido`, `Falta el enlace de restablecimiento.`), y un defecto previo en los dos idiomas: una fecha de inicio sin hora se pinta un día antes en el pipeline.
- **Pendiente.** Tres decisiones nuevas para el dueño: notificaciones, papeles y
  la lista de comprobación de una OT. Ver `docs/i18n/revision-ola5.md` §7.

### Ola 6 · Lo que se guarda en español (2026-11-03)

Lo que la ola 5 dejó a decisión del dueño, más los menores A y C de su
validador. **Nada de lo que se guarda cambia**: todo se traduce al pintarlo.

| Lote | Rama | Estado |
|---|---|---|
| Notificaciones, papeles, checklist de OT, los dos mensajes de venta y menores A y C | `feat/ingles-ola6` | **VERDE**. Integrado (bc591b7a). Validación en `docs/i18n/validacion-ola6.md`: 14 de 15 mutantes propios (el vivo es equivalente). Menores sin bloquear: el arreglo de fecha solo cubre fechas sin hora en el cliente (la API manda `Date` a medianoche del servidor; con `TZ` de México ya salía bien), «due in 0 days» en vez de «due today», doble espacio con agencia sin nombre (igual en español), y la prueba de fuentes de notificaciones solo ve archivos rastreados. Revisión en `docs/i18n/revision-ola6.md`: español idéntico en los 555 estados (0 diferencias, 4 estados nuevos), 0 valores de `DICCIONARIOS.es` cambiados, 28 de 28 mutantes, 6854 unitarias en verde |

Detalle del lote:

- **Notificaciones** (`lib/i18n/notificaciones.ts`, 38 claves). El español de cada
  clave es la plantilla del servidor; la pantalla reconoce el aviso guardado y lo
  rearma en inglés con sus datos. El saldo sale con `MX$`. Cubre las 11 fuentes del
  servidor, y una prueba exige plantilla para cualquier fuente nueva.
- **Papeles** (`lib/i18n/papeles.ts`). La etiqueta se traduce solo si es la de la
  migración; el código lleva un nombre inglés (ASSETS…). Se ven en Razones
  sociales, Administración, la bienvenida y el reporte por razón social.
- **Checklist de una OT nueva** (`lib/i18n/checklist-ot.ts`): solo el texto exacto
  de los tres puntos por omisión.
- **Los dos mensajes de venta.** Cinco patrones en `PATRONES_ERROR` (de 56 a 61) y
  `traducirError` en dos respuestas a mano de `PATCH /api/propuestas/[id]`.
- **Menor A**: los dos 400 de acceso, en `errores-acceso.ts`. **Menor C, arreglado**:
  la fecha sin hora del pipeline, la única excepción al español idéntico, porque
  ahora dice el día correcto.
- **Queda:** `PaqueteImposible` al quitar un paquete, que envuelve la frase del tope
  y no tiene patrón.

## 3 · Decisiones del dueño (2026-11-02)

- **El español se queda tal cual.** La única excepción autorizada es la
  redacción neutra de «pesos» (ola 4).
- **Glosario:** negotiation code, Internal ref., loops/h. El glosario completo,
  con lo que fijó cada lote, está en [[idiomas-es-en]] §11.
- **Fechas:** en inglés llevan el formato inglés («Dec 1, 2026»).
- **Moneda:**
  - Todo en MXN salvo que se elija otra moneda al crear la instancia.
  - Inmutable «por seguridad».
  - Corregirla solo con una corrección de datos con tipo de cambio.
  - Fail-closed si la base no responde.
  - En inglés, `MX$`.
- **Contratos firmados:** en g500 todo se firmó en pesos y DEMO son pruebas.
  Aun así se blindó el cotejo de firmas (ADR 0048, «Compatibilidad»).
- **Recibos de CFE:** sin cambios; el dueño dará más tipos de recibo.

## 4 · Lo que falta, y quién lo decide

| Pendiente | Lo decide / lo hace |
|---|---|
| El CSV del estado de cuenta: ¿en el idioma de la pantalla o siempre en español? | el dueño |
| «MX$ 1,160.00 MXN» en el comprobante: el validador recomienda dejarlo | el dueño |
| ~~Notificaciones de la campanita, papeles, checklist de una OT y los dos mensajes del flujo de venta~~ | hechos en la ola 6, traducidos al pintarlos; integrados (bc591b7a) |
| `PaqueteImposible` al quitar un paquete (envuelve la frase del tope) | otra ola |
| Encender `IDIOMA_INGLES=1` en DEMO y luego en las instancias | el dueño: la ola 5 ya está cerrada |
| Entrada en `docs/Registro_Cambios.md` | al encender, porque antes no se nota |
| PR de `integra/ingles` hacia `main` | el dueño |

## 5 · Cifras de `integra/ingles` (medidas, no copiadas)

Al 2026-11-03, con la ola 5 integrada:

- `npm run typecheck`: limpio. `npm run build`: limpio (el 03/11 paraba en el lint de una prueba; arreglado en 008bb1b9).
- `npx vitest run --testTimeout=60000`: **6699 en verde** en 366 archivos.
- e2e completa (antes de la ola 5, con f4eaa365): **1186 en verde**; solo `grants-rol-app`, por Docker. Ya no caen diez cada tarde: la base de pruebas habla en UTC (ver [[entorno-y-despliegue]]).
- Inventario: **211** textos, clasificados en `docs/i18n/revision-ola5.md`.

Anteriores:

Al 2026-11-02 (`2e622add`):

- `npm run typecheck`: limpio.
- `npm test`: **5038 en verde**.
- e2e completa sobre la integración de inglés y moneda: **1186 en verde**. Falla
  solo `grants-rol-app`, porque en la máquina de desarrollo no hay Docker.
- Inventario: unos **1634** textos por traducir al cerrar la ola 2. La ola 3 los
  está bajando.

En `feat/ingles-costura-2` (2026-11-02, los tres lotes de la ola 3 juntos):

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **6376 en verde** en 355 archivos.
- Inventario: **357** textos en 95 archivos (1270 en 112 en `integra/ingles`).

Son cifras con fecha: se vuelven a medir al juntar cada lote.

## Enlaces

- [[idiomas-es-en]]: cómo funciona el inglés, el glosario completo (§11) y el dinero (§7)
- [[decisiones]]: el ADR 0048 de la moneda por instancia
- [[AGENTES]]: el contrato de trabajo en paralelo
- [[zonas-de-riesgo]]: por qué la moneda fue ROJA
