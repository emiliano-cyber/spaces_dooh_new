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
- La app lee la moneda de la base en cada página (layout raíz) y en cada ruta que escribe
  importes. No se cachea: una instancia sin organización todavía no tiene moneda, y una caché
  puesta antes del bootstrap pintaría pesos en una instancia USD hasta reiniciar.
- Si la base no contesta al pintar una página, la página falla en vez de caer a MXN.
- `formatMonto(n, idioma?)` acepta el idioma opcional; las pantallas que no lo pasan siguen
  escribiendo el símbolo español. Una pantalla traducida que quiera `MX$`/`$` en inglés le pasa el
  idioma.

## Lo que NO decide

- Tipo de cambio ni conversión de importes: fuera de alcance.
- Las columnas `moneda` de campañas, facturas y contratos (default heredado `'PEN'`, luego `'MXN'`)
  siguen como almacén histórico; no se tocan.
- Los recibos de luz de CFE son, por naturaleza, mexicanos: en una instancia USD su importe se
  pintaría con el símbolo de dólar. No aplica a ninguna instancia hoy; queda anotado.
