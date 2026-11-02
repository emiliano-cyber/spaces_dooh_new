# ADR 0048: La moneda es de la instancia, se elige al crearla y no se puede cambiar

- **Fecha:** 2026-11-02
- **Estado:** Aceptada. La decisión es del dueño (Emiliano), 2026-11-02, como tarea de zona
  ROJA (dinero, R4; y migración, R3).
- **Sustituye a:** la decisión del 2026-09-30 «el sistema se rige 100 % en pesos mexicanos por
  ahora, después lo moveremos» (`vault/03-Frontend/idiomas-es-en.md` §7). El «después» es esto.
- **Relacionado:** [ADR 0011](0011-config-negocio-por-tenant.md) (una fila de `config_negocio`
  por organización), [ADR 0022](0022-instancia-dedicada-por-owner.md) (una instancia por owner),
  F5.2 (`POST /api/bootstrap`, la puerta de un solo uso).

## Contexto

Hasta hoy la moneda era una constante del código: `MONEDA = 'MXN'` en `lib/i18n/dinero.ts`, y
`formatMonto` escribía `$` a mano. Para vender el producto fuera de México hace falta que una
instancia trabaje en dólares.

El dato que manda en esta decisión: **los importes guardados no llevan moneda propia.** Un
contrato, una propuesta o una cobranza guardan `10000`, no «10,000 MXN». La moneda con la que se
leen es la de la instancia. Por eso la moneda no es un ajuste más de la configuración: cambiarla
volvería «$10,000 MXN» en «$10,000 USD» sin convertir nada — el mismo número, unas veinte veces
más caro, y sin un solo error. Hoy `PATCH /api/config` aceptaba `moneda` como texto libre.

Había además dos columnas: `tenants.moneda` (la que los repositorios ya usan para estampar
campañas, facturas y contratos) y `config_negocio.moneda` (que nadie leía para pintar nada, y que
`obtenerConfigRow()` crea perezosamente con su DEFAULT `'MXN'`).

## Decisión

1. **Dos monedas posibles, MXN y USD.** Ni una más; otra exige otro ADR.
2. **Es de la INSTANCIA, no de la organización.** Todas las organizaciones de una instancia
   trabajan en la misma. Es lo que permite guardarla en un valor de módulo
   (`lib/i18n/dinero.ts`) sin que las ~250 llamadas a `formatMonto(n)` tengan que enterarse.
3. **Se elige al crear la PRIMERA organización**, por el cuerpo de `POST /api/bootstrap`
   (`moneda: 'MXN' | 'USD'`), que el operador pasa con `provision-instancia.sh --moneda`. Sin
   valor, MXN. Las organizaciones posteriores (`/api/tenants`, `/api/signup`) **heredan** la de la
   instancia; pedir otra es un 400, no se ignora.
4. **No entra por variable de entorno.** El `.env` de una instancia se relee en cada arranque y se
   puede editar; una moneda que pareciera editable allí y no lo fuera en la base sería una
   trampa, y una que sí lo fuera sería exactamente el cambio que este ADR prohíbe. El parámetro
   del bootstrap es de un solo uso, como la decisión.
5. **Inmutable, en dos capas:**
   - **La base** (`20261102_moneda_inmutable_por_instancia.sql`): `CHECK (moneda in ('MXN','USD'))`
     en `tenants` y `config_negocio`; un trigger que impide el `UPDATE` de `moneda` cuando el valor
     cambia (reescribir el mismo pasa); un trigger que impide que una organización nazca en otra
     moneda que las existentes; y `config_negocio.moneda` pasa a ser un espejo de `tenants.moneda`
     que se copia al insertar. Para a todos los roles, incluido el superusuario.
   - **La API**: `PATCH /api/config` rechaza el campo `moneda` con un 400 que explica por qué,
     antes de guardar nada. El alta y la edición de contratos rechazan una moneda distinta de la
     de la instancia, y la pantalla de cambios de contrato deja de ofrecer el campo.
6. **Formato.** El `$` a secas es la moneda local del lector: en español MXN → `$1,234.50` (igual
   que antes, medido importe por importe), USD → `US$1,234.50`; en inglés MXN → `MX$1,234.50`,
   USD → `$1,234.50`. `formatMonto` conserva su estilo (`$ 1,234.50`, negativos entre
   paréntesis) y cambia solo el símbolo.
7. **Las instancias que ya existen se quedan en MXN.** La migración no elige moneda por nadie: si
   encuentra una organización fuera de MXN/USD, o dos monedas en la misma base, **se para** y
   pide una corrección en `docs/datos/`.

## Consecuencias

- Una instancia en dólares es posible desde el primer día, y nadie puede convertirla en otra
  cosa desde una pantalla, desde la API ni desde un `UPDATE` descuidado.
- **Cambiar la moneda de una instancia existente deja de ser un ajuste y pasa a ser una
  migración de datos**: convertir importes con un tipo de cambio decidido por alguien, en una
  corrección de `docs/datos/` con su rollback, deshabilitando el trigger a propósito. Es el camino
  que debe tener algo así.
- **Una por proceso, en `globalThis`.** El build empaqueta `lib/i18n/dinero.ts` varias veces (una
  copia para las rutas de `app/api`, otra para el layout y las páginas). Con un valor de módulo,
  fijarla en el layout no la fijaba para una ruta (lo midió el validador el 02/11). Por eso vive en
  `globalThis`: todas las copias leen la misma.
- **Dónde se lee.** `monedaDeLaInstancia()` (`lib/server/moneda-instancia.ts`) la lee de la base y
  la **cachea por proceso** en cuanto existe una organización. El punto común es `tenantActual()`:
  casi toda petición con sesión pasa por ahí, y no hay una envoltura de handlers en el repo (ruta por
  ruta eran ~60, medido con un grafo de imports). La piden además el layout raíz (también las
  páginas públicas), el documento imprimible de la propuesta y las rutas que escriben importes. Sin
  organizaciones no se cachea; el alta la recuerda en cuanto crea la primera. **Tras una corrección
  de datos que cambie la moneda hay que reiniciar la aplicación.**
- **Fail-closed** (confirmado por el dueño el 02/11). Si la base no contesta al pintar una página,
  la página falla en vez de caer a MXN, y `app/global-error.tsx` enseña una página propia en
  español («El sistema no está disponible en este momento») en vez de la 500 genérica de Next.
- **Solo el bootstrap elige.** `/api/signup` (anónimo, con `AUTOREGISTRO=1`) rechaza `moneda` con
  400 aunque la instancia esté vacía; sin ella hereda la de la instancia o, si no hay, MXN.
  `/api/tenants` hereda y rechaza otra. En `provision-instancia.sh`, `--moneda` sin `--bootstrap`
  para con salida 64 en vez de ignorarse.
- `formatMonto(n, idioma?)` acepta el idioma opcional, pero **en esta rama ninguna pantalla lo
  pasa**: `MX$` en las pantallas en inglés lo decidió el dueño para otra tarea (02/11), para no
  chocar con la traducción. Hoy todas escriben el símbolo español.

## Compatibilidad: los contratos ya firmados

Hasta el 02/11 la cantidad con letra decía «PESOS … M.N.» fuera cual fuera la moneda del
contrato. Desde este ADR dice «DÓLARES … /100 USD» en un contrato en USD. Pero el texto de un
contrato **congelado** está sellado con SHA-256, y `firmasDeContrato` (`firmas-repo.ts`) lo
vuelve a generar para compararlo: un contrato en USD congelado antes (de cuando existía el
selector, antes del 30/09) habría aparecido con sus firmas **alteradas** sin que nadie tocara nada.

**Decisión: lo congelado se regenera byte a byte como se firmó.** `generarContrato` acepta
`letra: 'en-su-moneda' | 'pesos-siempre'`, y `hashParaCotejar` (`lib/contrato-documento.ts`)
coteja así: genera con la regla de hoy; si no coincide con el hash guardado, genera con la regla
anterior; y solo si **esa** coincide devuelve su hash.

- **Por contenido y no por fecha de corte**, porque el código no puede saber cuándo llegó esta
  versión a cada instancia.
- **No ciega la detección:** si cambia un dato, cambian los dos textos y ninguno coincide (lo prueba
  `contrato-documento.test.ts` y la e2e «FIRMAS» de `moneda-instancia.e2e.test.ts`).
- **No perdona lo nuevo:** un contrato congelado con la regla de hoy nunca coincide con la anterior,
  porque difieren justo en la letra.
- En MXN las dos reglas dan el mismo texto: nada cambia para los contratos en pesos.
- Lo que se congele (o se reenvíe a firma) desde hoy usa la letra en su moneda.

Antes de desplegar, medir en cada base cuántos contratos están en este caso:
`select count(*) from contratos_arrendamiento where moneda='USD' and congelado_en is not null`.

## Lo que NO decide

- Tipo de cambio ni conversión de importes: fuera de alcance.
- Las columnas `moneda` de campañas, facturas y contratos (default heredado `'PEN'`, luego `'MXN'`)
  siguen como almacén histórico; no se tocan.
- Los recibos de luz de CFE son, por naturaleza, mexicanos: en una instancia USD su importe se
  pintaría con el símbolo de dólar. **El dueño decidió no tocarlos por ahora (02/11)**: dará más
  tipos de recibo después. No aplica a ninguna instancia hoy.
- `MX$` en las pantallas en inglés: otra tarea (decisión del dueño, 02/11).

## Revisión independiente

El validador dio ÁMBAR el 02/11 (`docs/Supervision/moneda-por-instancia.md`). Las correcciones que
pidió —la compatibilidad de las firmas, la moneda en las rutas, el documento de la propuesta, las
pruebas que faltaban, el signup, `--moneda` sin `--bootstrap` y `app/global-error.tsx`— están en la
segunda vuelta de la rama.
