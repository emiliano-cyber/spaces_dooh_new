# Validación · ola 6 de la versión en inglés

- **Rama:** `feat/ingles-ola6` (`198d8b38`), contra la base `integra/ingles` `65f76cb6`.
- **Fecha:** 2026-11-03. Validador independiente: no recibió el razonamiento del traductor. Todo lo de abajo se midió de nuevo; lo que dice `revision-ola6.md` se usó como lista de afirmaciones por comprobar.
- **Veredicto: VERDE**, con cuatro menores que no bloquean (§7).

## 1 · Español idéntico (medido)

- **HTML.** Se volcó el español de las 15 pruebas de pantallas (`I18N_VOLCAR` / `VOLCAR_HTML`), cada una en su carpeta. La base salió del worktree `integra-ingles` (en `65f76cb6`, sin tocar su árbol) y la rama de `ingles-ola6`.
  - `diff -rq`: **0 diferencias en los 555 estados de la base.**
  - Hay 4 archivos nuevos, los estados que añade la ola: `pantallas-admin/razones_sociales_los_cinco_papeles_del_catalogo_ola_6_.html` y `pantallas-cuenta-shell/33-es.html`, `34-es.html` y `35-es.html`.
  - Las 15 pruebas pasan en las dos corridas.
- **`DICCIONARIOS.es`.** Volcado con `tsx` en la base y en la rama.
  - De 5521 a 5574 claves: **0 valores cambiados**, 0 quitados y 53 nuevos.
  - Los nuevos: 38 `notificaciones.*`, 10 `admin.papel.*`, 3 `operaciones2.checklist.omision.*` y 2 `login.error.*`.
- **`PATCH /api/propuestas/[id]`.** Solo cambian dos respuestas de error (`route.ts:91-98` y `:192-197`):
  - el mensaje pasa por `traducirError(…, idiomaDeLaPeticion())`, que en español devuelve la entrada tal cual;
  - el status no cambia: 409/400 en la edición y 400 en aprobar;
  - el cuerpo sigue siendo `{ error }`.
  - Lo comprueban los casos de la ruta en `mensajes-venta.test.ts`. Los mutantes V07 (idioma fijo `'en'`) y V08 (409 → 400) mueren.
- **Nada prohibido.** El diff no toca `middleware.ts`, `nav.ts`, `lib/server/*`, las rutas de acceso, `db/`, `dinero.ts`, `aislamiento.e2e.test.ts` ni `servidor-e2e.ts`. Tampoco hay un `desktop.ini`.

## 2 · Datos guardados intactos

- **Checklist de OT.** `OTVista.tsx` solo cambia lo que se pinta (`etiquetaDePuntoOT(c.label, idioma)`). Al marcar se sigue mandando `alternarPunto(i, c.label)` → `cola.marcar({ indice, label, hecho })`, con el texto guardado.
- **Papeles.** En `GestionEntidadesFiscales.tsx`, `etiquetaDe` solo se usa en JSX: avisos de huérfanos y compartidos, y los chips. Los botones del editor siguen enviando `c.rol`. La bienvenida y el cuestionario solo cambian el `<span>` de la etiqueta y la lista del plan. `porCampo` y lo que se envía no cambian.
- **Notificaciones.** `traducirNotificacion` devuelve una copia, y solo la usan `ItemNotificacion` y `SondeoNotificaciones` para pintar. El borrado y la apertura siguen usando `n.id` y `n.link`. En el servidor no cambia ninguna escritura.

## 3 · Sentido del inglés (probado con datos)

Se probó con un script contra las funciones reales:

| Entrada guardada | Inglés |
|---|---|
| `F-12 · Coca Cola — vencida hace 1 día(s) · saldo $1,234` | `F-12 · Coca Cola — 1 day overdue · balance MX$1,234` |
| `F-9 · ACME — vence en 3 día(s) · saldo $12,000` | `… — due in 3 days · balance MX$12,000` |
| `Contrato vencido: un espacio · P2` + detalle de 1 día | `Contract expired: a space · P2` / `It expired 1 day ago and nobody has renewed it. …` |
| `Contrato vence en 1 día: un espacio` | `Contract expires in 1 day: a space` |
| `Camp X fue rechazada: fue rechazada: arte borroso` | `Camp X was rejected: fue rechazada: arte borroso` (el motivo es dato) |
| `PR-7 · Verano — aceptada por Lucía — aceptada por Ana` | `PR-7 · Verano — accepted by Lucía — aceptada por Ana` (corte en la primera aparición) |
| `No se pudo generar la campaña` / `Propuesta no encontrada` | `Could not generate the campaign` / `Proposal not found` |
| Tope sin volumen, 20/30/20 | `The maximum discount your organization allows is 20%, and 30% was requested. The commercial discount can go up to 20%. …` |
| Volumen 10 % sobre tope 8 % | `The volume discount (10%) is already over the cap (8%): …` |
| Agencia `Publicis $1` | `The negotiation with the agency Publicis $1 is not validated; …` (el `$1` del dato no se reinterpreta) |

- Glosario respetado: `MX$` con formato inglés; el plural sale de la cifra; PO, collection, balance, on air.
- Papeles: `Operacion y nomina` → `Operations and payroll`. `Operación y nómina` (con tildes, renombrado) se queda, `OTRO` se queda y en español sale el código.
- Checklist: solo el texto exacto. `montaje / ejecución` se queda.

## 4 · Robustez del reconocimiento por patrón

- **Lo que no casa se pinta igual.**
  - Un título desconocido devuelve el aviso intacto.
  - `Propuesta aprobada ` (con espacio al final) no casa.
  - Un detalle libre bajo un título conocido se queda en español (`OT vencida` + texto libre).
  - Un saldo con decimales (`$1,234.50`) no casa y el detalle se pinta entero en español: no se mezcla. El servidor redondea (`Math.round`), así que no ocurre.
- **Huecos.** Los libres son perezosos (`[\s\S]+?`), anclados con `^…$`. La cifra y el saldo están acotados (`(\d+)`, `((?:US)?\$-?[\d,]+)`). En el caso de motivo o nombre repetido, el corte queda en la primera aparición y el resto se pinta como dato. Los patrones de venta usan `(\d+(?:\.\d+)?)` y `(.*)` anclados.
- **ReDoS.** No hay cuantificadores anidados. Con entradas de 80 000 y 100 000 caracteres que no casan, las cinco funciones tardan 2 ms en total.
- **Prueba de fuentes** (`notificaciones.test.ts:299-300`, `git grep -l -E "notificar\(\{|insert into notificaciones \("`).
  - Mutante V14: se añadió `notificar({` a `lib/server/clientes-repo.ts`, que está rastreado. **Muere.**
  - Con el mismo texto en un archivo **nuevo sin `git add`** (`lib/server/zz-fantasma.ts`), la prueba **pasa**: `git grep` solo ve archivos rastreados. Ver menor 2.

## 5 · El arreglo de fecha (`lib/data/client.ts:407-408`)

- `isoDePaso` solo toca `^\d{4}-\d{2}-\d{2}$` y le añade `T00:00:00` (hora local, sin `Z`).
- `2026-11-03` sale `3` en `America/Mexico_City` y en `UTC`, en las dos formas: `formatFechaLocal` y `Intl` `en-US` «Nov 3».
- Las marcas con hora (`…T05:30:00Z`, `…000Z`, `…-06:00`) vuelven sin tocar.
- Las pruebas nuevas, corridas con `TZ=UTC`, pasan: 168 de 168 en los 7 archivos nuevos.
- `pipeline-fecha.test.ts` fija `America/Mexico_City` en el `beforeAll`, así que muerde también en CI (UTC). El mutante con `Z` muere tanto con `TZ` de México como con `TZ=UTC` (V11 y V12).
- **Alcance (menor 1):** ver §7.

## 6 · Pruebas y mutantes

- `npm run typecheck`: **limpio**.
- `npx vitest run --testTimeout=60000`: **6854 de 6854 en 372 archivos.** Coincide con lo que declara la revisión.
- `npm run build`: **exit 0, «Compiled successfully».**
  - Se compiló en una copia de la rama (`git archive feat/ingles-ola6` en el scratchpad, con `node_modules` enlazado), para no reescribir el `.next` del worktree.
  - El motivo: el puerto 3500 tiene un servidor vivo cuyo origen no se pudo confirmar.
  - Salen 12 avisos `react-hooks/exhaustive-deps`, de archivos que no toca la ola salvo `bienvenida/page.tsx`. El diff de esa página no cambia ningún hook de efecto. No se volvió a comparar con la base.
  - Sale también un `EPERM` al copiar `standalone/node_modules`. Lo causa el enlace de la copia, no el código.

Mutantes propios, distintos de los 28 del traductor. Cada uno se aplicó, se corrió y se restauró; `git status` quedó limpio al final:

| # | Mutante | Resultado |
|---|---|---|
| V01 | patrón de notificación sin ancla final `$` | muere (14) |
| V02 | «un espacio» solo exacto, sin el caso `un espacio · X` | muere (1) |
| V03 | detalle reconocido pero devuelto sin traducir | muere (25) |
| V04 | el saldo deja de admitir negativo (`-?` fuera) | **sobrevive**. Equivalente en la práctica: el servidor solo avisa con saldo > 0 (`finanzas-repo.ts`, `monto_pagado < monto` y `saldo <= 0 → return`) |
| V05 | tope con volumen: `$3` y `$4` cruzados en el inglés | muere (1) |
| V06 | agencia al aprobar con la frase de crear | muere (3) |
| V07 | `PATCH` edición con idioma fijo `'en'` | muere (1) |
| V08 | `PATCH` edición: 409 → 400 en `PropuestaError` | muere (1) |
| V09 | chips de papel de cada razón social sin traducir | muere (2) |
| V10 | checklist por omisión en otro orden | muere (3) |
| V11 | `isoDePaso` con medianoche UTC (`Z`), TZ México | muere (2) |
| V12 | ídem con `TZ=UTC` | muere (2): la prueba fija su zona |
| V13 | «Falta el enlace de restablecimiento.» sin entrada | muere (1) |
| V14 | fuente nueva de `notificar({` en un archivo rastreado | muere (1) |
| V15 | código de papel: VENTAS se pinta como OPERATIONS | muere (3) |

**14 de 15 mueren.** El que sobrevive es equivalente.

## 7 · Menores (no bloquean)

1. **El arreglo de fecha solo cubre la fecha sin hora, y la API no la entrega así.**
   - `/api/estado` lee `select * from campanas`, y `rowToCampana` pasa `fecha_inicio` por `iso()` (`lib/server/campanas-repo.ts:23`, `:78`). `pg` (pg-types 2.2.0) convierte una `date` en un `Date` a la medianoche **del servidor**.
   - Medido: `2026-11-03T06:00:00.000Z` con el servidor en México y `2026-11-03T00:00:00.000Z` en UTC.
   - Con `TZ=America/Mexico_City` en el servidor (`infra/env/app.env.example:186`) el pipeline ya pintaba bien. Una instancia sin `TZ` seguiría pintando un día antes, y `isoDePaso` no lo ve.
   - El arreglo es correcto donde aplica: un estado con la fecha sola, como las pruebas y los datos sembrados. No rompe nada. Pero «arreglado» es más de lo que hace.
   - El remedio de fondo sería servir la fecha con `to_char(…, 'YYYY-MM-DD')`, como ya hacen otros repos. Eso es servidor y queda fuera de esta ola.
2. **La guardia de fuentes no ve archivos nuevos sin rastrear.** `git grep` solo mira lo rastreado: en local, un archivo nuevo pasa hasta que se le hace `git add`. En CI, donde todo está commiteado, sí lo caza (V14).
   - Tampoco caza `notificar(` con el objeto en otra línea o en una variable.
   - Hoy no hay ninguno: el `git grep` de `notificar(` en `app` y `lib` da exactamente los 11 archivos declarados.
3. **Agencia sin nombre.** Con `bloq.nombre ?? ''` la frase inglesa sale con doble espacio: «with the agency  is not validated». El español tiene el mismo defecto. Cosmético.
4. **«due in 0 days».** El barrido avisa también el día del vencimiento (`dias = 0`). Se entiende, pero «due today» sería más natural. El español dice igual «vence en 0 día(s)».

## 8 · Lo que no se pudo comprobar

- No se arrancó la aplicación ni se miró en un navegador: el aviso emergente (`sonner`) y la campanita se validaron por pruebas de pantalla y de fuente.
- Las e2e no se corrieron: no hacen falta para esta ola, que no toca sesión, tenant, migración ni dinero.
- El origen del servidor del puerto 3500 no se pudo confirmar, y por eso el build se hizo en una copia de la rama.
