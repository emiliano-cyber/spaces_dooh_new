---
tipo: tablero
estado: en-curso
actualizado: 2026-11-02
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

### Ola 3 · El resto de la interfaz (en curso)

| Lote | Rama | Estado |
|---|---|---|
| Catálogos de precio (paquetes, franjas y temporadas, volumen) | `feat/ingles-operaciones` | **VERDE** (2.ª). Integrado en `integra/ingles` (85a8ee67). Incluye el aviso de `CampoCifra` en inglés para toda la app |
| Space Eyes | `feat/ingles-space-eyes` | Traduciendo |
| Inventario y arrendadores | `feat/ingles-inventario-arrendadores` | Traduciendo. El texto legal del contrato NO se traduce: va ligado al hash de las firmas |
| Administración, cuenta y shell | `feat/ingles-administracion` | Traducido (698 claves). En validación |
| Operaciones y clientes (incluido el Dashboard) | `feat/ingles-operaciones-clientes` | Traduciendo. El primer intento se cortó por el límite de uso; este parte de sus borradores |

### Ola 4 · Lo que sale del servidor (en curso)

| Lote | Rama | Estado |
|---|---|---|
| Plantillas de error con huecos y motivos compartidos con el servidor | `feat/ingles-servidor` | Traduciendo |
| «pesos» en redacción neutra (español **e** inglés) | `feat/pesos-neutral` | En curso. Es el único cambio autorizado del español |

### Ola 5 · Cierre (por lanzar)

Recorrido completo de la aplicación con `IDIOMA_INGLES=1` en un navegador real,
pantalla por pantalla. El inventario (`node scripts/i18n-inventario.mjs`) debe
quedar solo con falsos positivos. Con eso, el dueño decide si se enciende.

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
| Encender `IDIOMA_INGLES=1` en DEMO y luego en las instancias | el dueño, tras la ola 5 |
| Entrada en `docs/Registro_Cambios.md` | al encender, porque antes no se nota |
| PR de `integra/ingles` hacia `main` | el dueño |

## 5 · Cifras de `integra/ingles` (medidas, no copiadas)

Al 2026-11-02 (`2e622add`):

- `npm run typecheck`: limpio.
- `npm test`: **5038 en verde**.
- e2e completa sobre la integración de inglés y moneda: **1186 en verde**. Falla
  solo `grants-rol-app`, porque en la máquina de desarrollo no hay Docker.
- Inventario: unos **1634** textos por traducir al cerrar la ola 2. La ola 3 los
  está bajando.

Son cifras con fecha: se vuelven a medir al juntar cada lote.

## Enlaces

- [[idiomas-es-en]]: cómo funciona el inglés, el glosario completo (§11) y el dinero (§7)
- [[decisiones]]: el ADR 0048 de la moneda por instancia
- [[AGENTES]]: el contrato de trabajo en paralelo
- [[zonas-de-riesgo]]: por qué la moneda fue ROJA
