# Validación · Lote L5 del italiano (armazón, cuenta, administración, compartidos y servidor)

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l5-armazon` (`e6f9446d`), sobre
`integra/idiomas` (`6fea374a`) · **Revisión del traductor:**
`docs/i18n/revision-italiano-l5.md` · Validador independiente: no recibió el
razonamiento del traductor; lo que sigue está medido en este árbol.

## Veredicto: ÁMBAR (leve)

La maquinaria y el español/inglés están **limpios**: 0 bytes distintos en el
HTML es/en de todas las pruebas, `DICCIONARIOS.es` y `.en` sin un solo valor
tocado, typecheck, 385 archivos / 7104 pruebas y build en verde. El cambio de
`idiomasPorOmision()` no mueve la conducta es/en. Lo que impide el VERDE son
**tres frases italianas mal construidas** (§2.1, una se ve en el HTML: «1
disattivate»), **cuatro mutantes que sobreviven** (huecos de prueba, §5) y
**tres choques de glosario con otros lotes** que hay que resolver en esos
lotes antes de integrar (§3).

## 1 · Mediciones

| Medición | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `npx vitest run --testTimeout=60000` | rama **385 archivos, 7104 pruebas**; base `6fea374a` 383 / 6988; las dos en verde |
| `I18N_VOLCAR_TODO` en base y rama (la base con `git switch --detach 6fea374a` en el mismo worktree y vuelta a la rama; `git status` limpio al acabar) | base **3027** HTML, rama **3121**. `diff -rq`: **1 distinto, 0 desaparecidos, 94 nuevos** (todos de las pruebas nuevas del lote). El distinto es `pantallas.test.ts › encendido SOLO el italiano`, con `lang="it"`: el diff línea a línea solo cambia inglés de caída → italiano («Sign in» → «Accedi», «you@email.com» → «tu@email.it») |
| `DICCIONARIOS.es` / `.en` | el diff de `diccionario.ts`, `textos/{admin,compartidos,cuenta,shell,notificaciones,servidor}.ts` y `errores-servidor.ts` solo toca los bloques `IT_*` (todos los hunks empiezan en el comentario del bloque italiano); 0 líneas retiradas fuera de ellos |
| Espejo `I18N_VOLCAR_IT` sobre `pantallas-admin`, `-cuenta-shell`, `-compartidos` y `pantallas` | 333 HTML, **0 huellas** (`_guardias.jsonl` no se crea) |
| `npm run build` | verde. 12 avisos de `exhaustive-deps`, ninguno en un archivo del lote |
| Catálogo de errores | 201/201 con italiano; **ninguno igual al inglés ni al español**. Campos 30/30, firma 12/12 |
| Patrones | **62/62** con italiano, `patronesItSinPatron()` = `[]` (ninguna clave sin pareja). Los `$n` del italiano son **los mismos** que los del inglés en los 62; los plurales `{n|…}` también, salvo «You’re asking for $1 loop {1|slot|slots}…», donde el italiano no lo necesita («slot» invariable): correcto. Todo patrón con `huecos` tiene su `huecosIt` |

## 2 · Sentido en italiano

Leído en los `IT_*` y en el HTML italiano volcado (shell, admin, cuenta,
compartidos, campanita, propuesta pública, 404/500).

### 2.1 · A corregir

| # | Dónde | Frase | Problema | Propuesta |
|---|---|---|---|---|
| 1 | `textos/admin.ts:1936` `admin.razones.de-baja` | «{n} disattivate» | Sin plural: el HTML de `razones sociales · lista con avisos` dice **«1 disattivate»** (`GestionEntidadesFiscales.tsx:343`). En español «de baja» es invariable; en italiano no | «Disattivate: {n}» |
| 2 | `textos/admin.ts:1693-1694` `admin.act.modo.*` | «Modalità cambiata in con approvazione» | Calco de «cambiado a con aprobación»; no se dice | «Modalità cambiata: con approvazione» y «Modalità cambiata: automatica» |
| 3 | `admin.password.no-se-ve` | «…e il sistema le chiederà di cambiarla appena accede.» | «le» presupone que {nombre} es mujer | «…e al primo accesso il sistema chiederà di cambiarla.» |

### 2.2 · Retoques menores (no bloquean)

| Dónde | Frase | Propuesta |
|---|---|---|
| `compartidos.unidad.cpm` | «CPM · costo per migliaio di impression» | En el sector italiano CPM es «costo per mille»: «CPM · costo per mille impression». Los contadores *migliaio/migliaia* pueden quedarse |
| `compartidos.doohmain.las-que-quepan` | «Quanti ne entrano» | «Quanti ne stanno» (más natural) |
| `shell.fotos.alt` | «prova» | Ambiguo («prova» = test): «foto di verifica» |
| `cuenta.cuestionario.p1.ayuda` | «Quasi tutte le aziende media…» | «Quasi tutte le aziende del settore media…» |
| `cuenta.recuperar.bienvenida` | «Benvenuto» | Neutro: «Ti diamo il benvenuto» |
| catálogo, `PATCH /api/sitios/:id/modalidades` | «…si salvano nella loro rotta» | «…nel loro endpoint» |
| `app/not-found.tsx:47` (no es diccionario) | «Error 404» fijo en el código | En italiano «Errore 404»; hoy sale igual en los tres idiomas |

### 2.3 · Frases revisadas y correctas (muestra de 42)

Concordancia, artículos, apóstrofo y registro «tu» bien en todas:

1. «Accettando confermi i 2 impianti e il totale di MX$ 5.800,00.» (HTML)
2. «Accettando confermi 1 impianto e il totale di {total}.»
3. «F001-0007 · Cliente Uno — scaduto da 4 giorni · saldo MX$ 247.080» (HTML; *incasso* masculino)
4. «Il contratto scade tra 2 giorni: Predio Norte · Juan Ruiz» (HTML)
5. «{cobranza} — scade oggi · saldo {saldo}» (`.cero`)
6. «Chiedi {espacios} slot del loop e lo schermo ne ha liberi solo {libres}.»
7. «Gli slot del loop vanno da 1 a {total}.»
8. «La maggiorazione Roadblock si applica solo a una riga contrassegnata come Roadblock.»
9. «Questo mese · Mese scorso · Questo trimestre · Trimestre scorso · Quest’anno · Intervallo personalizzato»
10. «Non assegnata» / «{nombre} (disattivata)» (ragione sociale, femenino)
11. «{n} impianti senza posizione inserita» / «1 impianto senza posizione inserita»
12. «La tua organizzazione richiede la password per confermare le modifiche sensibili.»
13. «Questa pagina non esiste» · «L’indirizzo è sbagliato o il record che cerchi non è più disponibile.» (HTML)
14. «Il sistema non è disponibile in questo momento»
15. «Modifiche sbloccate per altri {min} min · clicca per bloccare»
16. «La tua licenza di SPACE OS è scaduta il {vence}. Il sistema smetterà di funzionare il {finGracia}.»
17. «Novità della versione {version}» · «Ho capito»
18. «Caricamento di {n} foto…»
19. «Liberi: {libres} su {total}»
20. «Ordine d’acquisto registrato»
21. «{campana} è stata approvata ed è in onda»
22. «Mancano il locatore, l’importo dell’affitto, la periodicità o la data di fine.»
23. «Il minimo del budget non può essere maggiore del massimo»
24. «Il punto (0, 0) è in mare: non è una posizione»
25. «Venduta come {vendida} ({pantallas}) e programmata in «{programada}».»
26. «I codici che hai salvato smetteranno di funzionare appena verranno generati quelli nuovi.» (con el hueco armado)
27. «Verranno create {n} ragioni sociali:» / «Verrà creata 1 ragione sociale:»
28. «L’operatività è nella stessa ragione sociale che vende o fattura?»
29. «Accettata da {quien} il {fecha}. Il team commerciale è stato avvisato.»
30. «Troppi tentativi. Attendi 30s e riprova.»
31. «Email o password non validi»
32. «{nombre}: ruolo cambiato in {rol}»
33. «Da ora in poi TUTTI, te compreso, dovranno digitare di nuovo la propria password…»
34. «Tetto di sconto: {v}%» (sin espacio antes de %)
35. «Quanti inserzionisti diversi possono condividere un impianto contemporaneamente, oltre al limite di slot.»
36. «Porta {n} migrazioni in sospeso» / «Porta 1 migrazione in sospeso»
37. «Hai approvato {version}: verrà installata nei prossimi minuti, o di notte ({hora}) al più tardi.»
38. «Hai {n} ticket in attesa di risposta.» («ticket» invariable)
39. «Non si può inviare alla firma: {1|manca ancora $1 dato|mancano ancora $1 dati} ($2).»
40. «Non si può eliminare: il cliente ha 2 campagne e 1 fattura…» (`bloqueoClienteIt`)
41. «Lo sconto per volume ($1%) supera già il tetto ($2%): lascia lo sconto commerciale allo 0%…»
42. «Questa proposta è scaduta il $1. Chiedine una aggiornata a chi te l’ha inviata.»

Formato: comillas *caporali* en todo el lote, apóstrofo tipográfico, fechas
«1 dic 2026», «MX$ 5.800,00», «Volume discount (2,5%)» ya con coma decimal en
la liga pública (lo demás de esa pantalla es de otro lote y sigue en inglés).

## 3 · Glosario, y choques con otros lotes

Los términos que propone el lote son los que usaría un italiano del sector:
*periodo di due settimane / Ogni due settimane* (evita la ambigüedad de
*quindicinale*), *Due volte al mese*, *Ogni due mesi*, *Ogni sei mesi*,
*T1 2026*, *slot del loop*, *maggiorazione*, *impianto / schermo*,
*immobile*, *password*, *email*, *Team*, *Passa a*, *Responsabile vendite*,
*Acquisizione siti*, *Provvigioni*, *tetto di sconto*, *Assistenza*,
*Tipografia* (rol) frente a *Stampa* (módulo) y los papeles AFFITTI · BENI ·
LICENZE · OPERATIVITÀ · VENDITE. Únicos reparos: CPM (§2.2) y que
*Impostazioni dell’attività* sea «del negocio» y no «de la empresa» (es
correcto; *Impostazioni aziendali* también lo sería, pero hay que elegir uno).

**Choques medidos contra las ramas de los otros lotes** (`git diff 6fea374a...<rama>`):

| Término | L5 | Otro lote | Qué hacer |
|---|---|---|---|
| predio | *immobile* (L3 y L4 igual) | **L1** *proprietà* (energía: «Proprietà o impianto», «senza proprietà») · **L2** *terreno* («Indirizzo del terreno», «Terreno di destinazione») | Alinear L1 y L2 a *immobile* |
| catorcena | *periodo di due settimane* / *Ogni due settimane* | **L3** `operaciones.disponibilidad.catorcena` = «Quindicina» y «per quindicina o mese» | Alinear L3; *quindicina* es la quincena |
| Configuración del negocio › Soporte | *Impostazioni dell’attività* · *Assistenza* | **L1** cita 4 veces «Impostazioni › Impostazioni aziendali › Supporto» (`spaceeyes.demo.listo*`, `spaceeyes.sin-respuesta.soporte`) | L1 debe citar el menú tal como lo pinta L5: «Impostazioni › Impostazioni dell’attività › Assistenza» |
| quincenal | *Due volte al mese* | L4 «{n} rate quindicinali» | Compatible (quindicinale = quincenal); no requiere cambio |
| Imprenta | módulo *Stampa*, rol *Tipografia* | L4 «In tipografia», «Tipografia» (ficha) | Compatible |

## 4 · Cambios de comportamiento (no traducción)

- **`idiomasPorOmision()`** (`lib/i18n/idiomas.ts`): todo `IDIOMAS` salvo `it`
  si `IDIOMA_ITALIANO !== '1'`; es el valor por omisión de `normalizarIdioma`,
  `idiomaDeCabecera` y `resolverIdioma`. Con el italiano apagado, es/en se
  aceptan igual que antes. Todos los llamadores de producción
  (`servidor.ts:85`, `pages/_error.tsx:30`) pasan `permitidos` explícito, así
  que la omisión solo afecta a quien la olvide. Cierra V5/V6 de la ola 0.
- **`app/global-error.tsx`** pasa `IDIOMAS` a mano: correcto, en el navegador
  no hay `IDIOMA_ITALIANO` y el `lang` ya lo decidió el servidor.
- **`contexto.tsx`**: el rechazo de `cambiarIdioma` fuera de `disponibles` ya
  estaba en la base (`83ff4a26`); el lote solo añade su prueba
  (`contexto-cambiar.test.ts`), con control positivo.
- **Con `IDIOMA_ITALIANO` apagado** el HTML es/en (cookie, Accept-Language,
  404/500, `_error`) es idéntico byte a byte (§1).
- **Fuera de lista, justificados:** `p/[id]/page.tsx` (porcentaje con formato
  solo en `it`), `formatNumero(…, 0, idioma)` en administración, integraciones,
  network y actividad (es-MX y en-US escriben igual: el volcado lo confirma),
  `cobertura-italiano.ts` (`.cero` sin `{n}`; la prueba exige que no se pierda
  otro hueco). Las pruebas reescritas sustituyen la afirmación «italiano vacío»
  por la del italiano real, sin perder lo que medían; no encontré ninguna
  debilitada (`idiomas.test.ts` solo pasa `permitidos: IDIOMAS` en el viaje de
  ida y vuelta de la cookie, que mira el formato).

### Choques con `feat/idioma-por-usuario` al integrar

`git merge-tree` contra `feat/idioma-por-usuario` (`85d838fc`):

1. **`lib/i18n/diccionario.ts` — CONFLICTO** en `IT_BASE`, junto a
   `idioma.cambiar`: aquella rama añade 5 claves `idioma.cuenta.*` con su
   italiano marcado «sin validar». Resolver conservando las dos; sus 5 frases
   están bien («Usa la lingua del browser», «Impossibile salvare la lingua»).
2. **`lib/i18n/cobertura-italiano.test.ts` — CONFLICTO**: aquella fija
   `traducidas` a `11`; este lote lo hizo relativo (`traducidasAntes − …`).
   Quedarse con la de L5.
3. **`lib/i18n/errores-servidor.ts` — se mezcla sin conflicto pero queda en
   ROJO**: aquella añade al catálogo «Ese idioma no está disponible en este
   servidor.» sin italiano, y la fila «errores · catálogo» de L5 exige 0
   pendientes. Añadir: «Questa lingua non è disponibile su questo server.»
4. **`lib/i18n/idiomas.ts` — se mezcla sin conflicto y la semántica casa**:
   `resolverIdioma` gana `cuenta` antes de la cookie y usa `permitidos ??
   idiomasPorOmision()`; `cambiaIdiomaAlEntrar` (cliente) pasa `disponibles`
   explícito, así que no depende de la omisión. `servidor.ts` también mezcla
   limpio.

Contra L1–L4 solo chocan `vault/03-Frontend/italiano-olas.md`, el diario del
03/11 y, con L3, `catalogos-italiano.test.ts`.

## 5 · Mutantes propios

Distintos de los 19 del traductor; aplicados de uno en uno con
`scratchpad/val-l5/mutar.mjs`, corriendo `lib/i18n` y `lib/test`, restaurados
(`git status` limpio).

| # | Mutante | Resultado |
|---|---|---|
| V1 | `idiomasPorOmision` acepta el italiano con `IDIOMA_ITALIANO` definido a cualquier valor (`'0'` lo encendería) | **SOBREVIVE** — ninguna prueba usa `IDIOMA_ITALIANO='0'` |
| V2 | hueco de periodicidad `catorcenal` → «quindicinale» | muere |
| V3 | `ETAPA_IT` con la clave `negociación` mal escrita (el hueco cae al español «negociación» dentro de la frase italiana) | **SOBREVIVE** |
| V4 | falta «Domicilio del arrendador» en `FALTA_FIRMA_IT` | muere |
| V5 | plural de «che lo ha/hanno come agenzia» al revés | muere |
| V6 | `referenciaPredioIt` deja «el predio "X"» sin traducir | **SOBREVIVE** |
| V7 | apóstrofo recto en `shell.404.otra-seccion` | muere |
| V8 | `CAMPO_IT['Spots por día']` igual al español | **SOBREVIVE** |
| V9 | espacio antes de `%` en un mensaje del tope | muere |

Los cuatro supervivientes son la misma clase de hueco: las tablas de huecos
del servidor (`ETAPA_IT`, `FALTA_REVISION_IT`, `PERIODICIDAD_IT`, `CAMPO_IT`,
el armado del predio) caen **al español** si les falta una entrada
(`deTabla`: `tabla[v] ?? v`), y nada lo vigila clave por clave. Propuesta:
una prueba que exija las mismas claves que su tabla `*_EN` y valores distintos
del español salvo cognados declarados (*RFC, Cliente, Documento, Logo,
Periodo*), un caso del predio «el predio "X"» en italiano, y una de
`idiomasPorOmision` con `IDIOMA_ITALIANO='0'`.

## 6 · Lo que no comprobé

- Las e2e (encargo: sin servidores).
- La lectura frase por frase de los 201 mensajes del catálogo: los leí todos
  de corrido; las 542 de `admin` y el resto de `IT_*`, enteras.
- El recorrido en el navegador.
- El resultado de mezclar de verdad con `feat/idioma-por-usuario` y los otros
  lotes: solo `git merge-tree`, sin correr las suites sobre la mezcla.
