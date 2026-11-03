# Revisión · Lote L5 del italiano (armazón, cuenta, administración, compartidos y servidor)

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l5-armazon`, sobre
`integra/idiomas` (`6fea374a`) · **Tablero:** `vault/03-Frontend/italiano-olas.md`
· **Encargo:** traductor del lote L5; lo revisa un validador independiente.

## 1 · Qué se tradujo

| Ámbito | Archivo | Claves | Antes | Después |
|---|---|---:|---:|---:|
| base | `lib/i18n/diccionario.ts` (`IT_BASE`) | 113 | 5 | 113 |
| compartidos | `textos/compartidos.ts` | 109 | 0 | 109 |
| shell | `textos/shell.ts` | 58 | 0 | 58 |
| cuenta | `textos/cuenta.ts` | 115 | 0 | 115 |
| admin | `textos/admin.ts` | 542 | 0 | 542 |
| notificaciones | `textos/notificaciones.ts` | 40 | 0 | 40 |
| servidor | `textos/servidor.ts` | 32 | 0 | 32 |
| errores · catálogo | `errores-servidor.ts` (`CATALOGO_ERRORES_IT`) | 201 | 0 | 201 |
| errores · campos | `CAMPO_IT` | 30 | 0 | 30 |
| errores · firma | `FALTA_FIRMA_IT` | 12 | 0 | 12 |
| errores · patrones | `PATRONES_IT` → `p.it` / `p.huecosIt` | 62 | 0 | 62 |
| **Total** | | **1314** | **5** | **1314** (1309 nuevas) |

Cada `IT_<ÁMBITO>` de `textos/` pasa de `Partial<Record<…>>` a `Record<…>`:
una clave nueva sin italiano ya no compila. La base sigue `Partial` (su tipo
es `ClaveTexto`, que incluye todos los ámbitos); la exige la fila «base» de la
cobertura. `errores-acceso.ts`, `papeles.ts` y `notificaciones.ts` no tienen
tabla propia: leen el diccionario, y su italiano es el de la base, `admin.papel.*`
y `notificaciones.*`.

## 2 · Glosario: los términos que decidió este lote

Además del glosario obligatorio del encargo:

| Español | Italiano | Por qué |
|---|---|---|
| catorcena (unidad) | periodo di due settimane | «quindicina» se confunde con la quincena (dos veces al mes); son 14 días, como el «two-week period» inglés |
| Catorcenal | Ogni due settimane | |
| Diaria / Semanal / Mensual (unidad y periodicidad) | Giornaliera / Settimanale / Mensile | la tarifa es femenina |
| Trimestral / Anual | Trimestrale / Annuale | |
| prima (Roadblock) | maggiorazione | |
| espacios del loop | slot del loop (invariable) | el sector dice «slot», y el español de la app también |
| CPS · costo por salida | CPS · costo per passaggio | glosario: salidas = passaggi |
| millar / millares | migliaio / migliaia | CPM se queda |
| etiqueta del trimestre | T{n} {anio} | la letra de `FORMATO_IDIOMA.it` (P2, provisional) |
| rango de fechas | {desde} – {hasta} | «dal … al» pediría «dall’8», «dall’11» |
| Desde / Hasta / a (selector) | Dal / Al / al | |
| Sin asignar (razón social) | Non assegnata | la ragione sociale es femenina |
| dada de baja | disattivata | |
| pantalla, en el mapa, la propuesta pública, Network y el cupo | impianto | inventario genérico |
| pantalla, en calculadora, loop, DOOHmain, franja | schermo | pantalla digital |
| predio | immobile | |
| Contraseña | password | como lo dice una interfaz italiana |
| Correo | email | |
| Configuración (cuenta) / (negocio) | Impostazioni dell’account / Impostazioni dell’attività | la excepción «Configuración» de la costura |
| Imprenta (rol de una persona) | Tipografia | el módulo es «Stampa»; excepción «Imprenta» de la costura |
| Equipo (de personas) | Team | |
| Entrar (a otra organización) | Passa a | |
| Gerente de ventas / Director comercial | Responsabile vendite / Direttore commerciale | |
| Vendedor (rol) | Commerciale | glosario |
| Captación (menú) | Acquisizione siti | buscar espacios que arrendar, no clientes |
| Consumo de luz | Consumo elettrico | |
| Comisiones | Provvigioni | |
| tope de descuento | tetto di sconto | |
| Soporte | Assistenza | |
| papeles (códigos) | AFFITTI · BENI · LICENZE · OPERATIVITÀ · VENDITE | |
| Guardando… / Creando… | Salvataggio… / Creazione… | |
| Ver (capacidad y botón) | Vedi | la costura exige el mismo italiano para «Ver» |
| comillas | « » (caporali) | cierra el P3 del tablero |

## 3 · Lo que el espejo encontró y era código (no traducción)

| Sitio | Qué salía en italiano | Arreglo |
|---|---|---|
| `app/(app)/p/[id]/page.tsx` (liga pública) | «Volume discount (2.5%)» con punto | `pct()` formatea con `numero` **solo en italiano**; es/en pasan la cifra cruda de siempre |
| `administracion/page.tsx` | «atto pubblico 12,345», conteos sin idioma | `formatNumero(…, 0, idioma)`; `DatosFiscales` pasa de `useTexto` a `useIdioma` |
| `integraciones/page.tsx` | «Veicoli 1,200» | `formatNumero(…, 0, idioma)` |
| `network/page.tsx`, `actividad/page.tsx` | conteos sin idioma | ídem |

`es-MX` y `en-US` escriben las cifras igual (medido por la ola 0), así que
nada de esto mueve el español ni el inglés: el volcado completo lo confirma (§5).

## 4 · Los tres huecos del validador de la ola 0, y el valor por omisión

| | Qué | Prueba nueva | Mutante |
|---|---|---|---|
| V5 | `_error` sin `permitidos` | `pantallas-cuenta-shell`: con el italiano encendido y el inglés apagado, una cookie `en` sale en español; y al revés con `it` | muere |
| V6 | `cambiarIdioma` acepta un idioma fuera de `disponibles` | `contexto-cambiar.test.ts`: con `['es','en']`, pedir `it` no escribe cookie ni refresca (con control positivo) | muere |
| V9 | «Campo: motivo» con el motivo en italiano y el campo sin él | `errores-servidor-italiano`: sale entero en inglés | muere |
| omisión | `normalizarIdioma`, `idiomaDeCabecera`, `resolverIdioma` aceptaban `it` apagado si nadie pasaba la lista | `idiomas-italiano`: apagado no, encendido sí, es/en como antes | muere |

**Cambio en `lib/i18n/idiomas.ts` (para la integración con `feat/idioma-por-usuario`):**
una función nueva, `idiomasPorOmision()` —todo `IDIOMAS` salvo `it` si
`IDIOMA_ITALIANO` no es `1`—, y los tres valores por omisión (`= IDIOMAS`,
`?? IDIOMAS`) pasan a llamarla. Nada más: ni la precedencia ni las firmas
cambian. El español y el inglés se aceptan por omisión igual que antes (filtrar
el inglés por omisión movería la conducta de hoy; quien decide ya pasa la lista).
Como en el navegador no existe `IDIOMA_ITALIANO`, `app/global-error.tsx` pasa
`IDIOMAS` a mano (su `lang` ya lo decidió el servidor); una prueba lo fija.
Una prueba de `idiomas.test.ts` (el viaje de ida y vuelta de la cookie) pasa
ahora `permitidos: IDIOMAS`, porque mira el formato, no el interruptor.

## 5 · Español e inglés idénticos — medido

| Medición | Resultado |
|---|---|
| HTML de todas las pruebas (`I18N_VOLCAR_TODO`), antes (`6fea374a`) y después (`9619ba20`) | 3027 archivos antes; `diff -rq`: **0 distintos** de español o inglés, 0 desaparecidos. 1 distinto: un estado de `pantallas.test.ts` con `lang="it"` (el italiano encendido), que es italiano por diseño. Los nuevos son de las pruebas nuevas |
| `DICCIONARIOS.es` y `.en` (5589 claves) | byte a byte iguales (JSON antes/después) |
| `traducirError` y `mensajeDeAcceso` es/en sobre catálogo, `lib` y 30 campos × 3 motivos; papeles | iguales |

## 6 · Pruebas

- **Rojas antes de traducir:** las 8 piezas de `pantallas-compartidos` en
  italiano; 36 de `pantallas-cuenta-shell`; 29 de `pantallas-admin` (medido con
  el `admin.ts` de `HEAD` puesto a mano); las filas de cobertura del lote; 10 de
  `errores-servidor-italiano`; 6 del italiano de `compartidos.test.ts`.
- **Barrido común:** `lib/test/barrido-italiano.ts` (`culpablesEnItaliano`)
  busca en el HTML italiano cada trozo español **e inglés** de los diccionarios
  del lote; un trozo inglés es una clave que cae al inglés. Tiene su prueba.
- **Pruebas que se reescribieron** (porque afirmaban el italiano VACÍO de la
  ola 0, sin perder lo que miden): dos de `cobertura-italiano.test.ts` y
  `errores-servidor-italiano.test.ts` entero (la caída se ve ahora quitando a
  mano la pieza). En `catalogos-italiano.test.ts` se cambiaron solo las de este
  lote (acceso, papeles, campanita); la checklist de OT, Space Eyes y el CSV son
  de otros lotes y siguen igual.
- `problemasItaliano()` admite que una variante `.cero` no lleve `{n}`
  («scade oggi», como el «due today» del inglés); cualquier otro hueco perdido
  sigue contando.
- **Mutantes:** ver §7.

## 7 · Mutantes

19 mutantes, aplicados de uno en uno y restaurados (corriendo las pruebas
del archivo afectado). **19 mueren.** Tres sobrevivieron en la primera medición
y obligaron a añadir pruebas, no a debilitar nada:

| # | Mutante | Resultado |
|---|---|---|
| 1 | `_error` sin `permitidos` (V5) | muere |
| 2 | `cambiarIdioma` sin mirar `disponibles` (V6) | muere |
| 3 | omisión de `permitidos` vuelve a todo `IDIOMAS` | muere |
| 4 | omisión = solo los encendidos (movería el inglés) | muere |
| 5 | `global-error` sin `IDIOMAS` | muere |
| 6 | «Campo: motivo» con el campo en inglés (V9) | muere |
| 7 | se ignora la marca `SIN_ITALIANO` (tope envuelto) | muere |
| 8 | `cifraIt` no convierte | muere |
| 9 | el bloqueo del cliente sin plural | muere |
| 10 | el plural de la firma al revés | muere |
| 11 | una clave de admin igual al inglés | **sobrevivía**: el barrido descuenta lo que ya dice el italiano. Ahora muere con «el italiano que coincide con otro idioma, solo el declarado» (`cobertura-italiano.test.ts`) |
| 12 | una clave de shell igual al español | **sobrevivía**, igual que la 11; ahora muere |
| 13 | un hueco perdido en cuenta | muere |
| 14 | el porcentaje de la liga pública sin formato | muere |
| 15 | la escritura de ejemplo sin idioma | muere |
| 16 | la variante `.cero` de la campanita | muere |
| 17 | una periodicidad con cifra | muere |
| 18 | compartidos y servidor dicen distinto lo mismo | muere (costura) |
| 19 | una `.cero` que pierde un hueco que no es `{n}` | **sobrevivía**; ahora muere en «y la comprobación MUERDE» |

No se mutó contra las e2e (no se corrieron: ver §8).

## 8 · Lo que no se hizo, y por qué

- **El documento del contrato y la constancia**: tarea roja aparte (idioma de la instancia).
- **Bitácora/Actividad (el texto de cada acción), notas de versión y lo que se guarda como dato**: no se traducen.
- **`CampoCifra` lee las cifras a la mexicana** (coma de miles, punto decimal)
  en todos los idiomas. Sus mensajes en italiano lo dicen tal cual. Un italiano
  que teclee «1.160,50» recibe el aviso «europeo» que ya existía. Si el dueño
  quiere que el italiano teclee a la italiana, es un cambio de `lib/captura-cifra.ts`, fuera de este lote.
- **El dólar en italiano (P1)** sigue provisional: no lo toca este lote.
- Las fechas `dd/mm/aaaa` que el servidor mete en dos mensajes (propuesta
  vencida) se dejan tal cual: son legibles en italiano.
- **Las e2e** no se corrieron (encargo: poca memoria, otros agentes). El lote
  no toca sesión, tenant, dinero en base ni migraciones; el cambio de
  `idiomas.ts` es de la omisión de una función pura.
- `formatNumero` sin idioma en pantallas de OTROS lotes (propuestas, etc.) no
  se tocó: es de sus ámbitos.

## 9 · Suites y recuentos (medidos en este árbol)

- `npx tsc --noEmit`: limpio.
- `npx vitest run --testTimeout=60000`: **385 archivos, 7104 pruebas, en verde**
  (la base daba 383 y 6988).
- Espejo italiano (`I18N_VOLCAR_IT`) sobre `pantallas-admin`,
  `pantallas-cuenta-shell`, `pantallas-compartidos` y `pantallas`: **0 huellas**
  de formato (las pruebas italianas nuevas ya aplican `huellasEnItaliano` por
  pantalla).
- Cobertura (`cobertura-italiano.test.ts`): las 11 filas del lote, **0
  pendientes**.
