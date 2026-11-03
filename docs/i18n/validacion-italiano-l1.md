# Validación · lote L1 del italiano «Space Eyes y luz»

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l1-spaceeyes` (`995d938d`, sale
de `integra/idiomas` `6fea374a`) · **Revisión del traductor:**
`docs/i18n/revision-italiano-l1.md` · **Validador independiente.**

## Veredicto: ÁMBAR

El español y el inglés quedan intactos (medido), la cobertura es completa y los
cambios de formato fuera de `textos/` son equivalentes en es/en. Pero hay **un
error visible en italiano** que ninguna prueba caza («l’ultima 5 min fa **fa**»,
§3.1), un problema de **elisión con las fechas** (§3.2) y cuatro huecos de las
pruebas (mutantes que sobreviven, §6). Con §3.1 corregido el lote puede fusionarse;
lo demás puede ir en el mismo arreglo o anotarse.

## 1 · Español e inglés idénticos — medido

| Medición | Resultado |
|---|---|
| HTML de toda la suite (`I18N_VOLCAR_TODO`), base `6fea374a` (3027 archivos) frente a la rama (3391), cada una en su copia `git archive` | `diff -rq`: **0 distintos, 0 desaparecidos**; lo nuevo (364 archivos) es solo de `pantallas-spaceeyes` y `pantallas-energia` en italiano |
| `DICCIONARIOS.es` / `.en` (volcados a JSON en base y rama) | 5590 / 5590 claves, **0 cambiadas, 0 quitadas, 0 nuevas** |
| `DICCIONARIOS.it` fuera de `spaceeyes.*` / `energia.*` | **0 cambiadas** |
| `fijo()` / `cifra()` / `gigas()` en es y en frente a `toFixed` / `String` / la `gigas` de antes | Idénticos con 0, −0, ±1, 0,5, 1,005, 2,345, −2,5, 999,95, 1000, 1234,5678, −1234,5, 1e21, 1e−7, NaN, ±Infinity, 0,812, 63,3, 1440 y decimales 0–3; `gigas` con null, 0, 1 MiB−1, 1 MiB, 1 GiB−1, 1 GiB, 5e12, −5 y NaN |
| `formatNumero(x, 0, idioma)` frente a `formatNumero(x)` | Por omisión ya era `0` decimales y `'es'`; `es-MX` y `en-US` dan lo mismo en 29 valores × 4 decimales (incluye negativos, NaN, ±Infinity, 1e21): **0 diferencias**. En es/en no cambia nada |
| `pesos()` con `minimumFractionDigits: 2` | MXN y USD son las únicas monedas (`dinero.ts:MONEDAS`) y las dos tienen 2 decimales por omisión en el estilo `currency`: con 0, 50, 3400,5, −12,345, 1e6, 0,005 y NaN, en `es-MX` y `en-US`, **0 diferencias** |

Las dos copias fallan los mismos 12 archivos (aprovisionamiento, nginx, licencia…):
leen `infra/` y `.github/`, que el `git archive` no incluye. Son del entorno de la
copia, iguales en base y rama, y en el worktree pasan.

## 2 · Cobertura, guardias y pruebas

- `IT_SPACEEYES` 1001/1001 y `IT_ENERGIA` 121/121 (el tipo es `Record`, `tsc` lo
  exige). `donde-falla.ts` no se toca: traduce por clave y sus ocho nombres y tres
  formas salen en italiano (`donde-falla.test.ts`).
- Iguales al inglés: 17; al español: 22. Todos justificados (Online, PC, Raspberry,
  No, Password, «38 °C», «312 MB», `{n}%`, «Vincular» de la app Android, «Temperatura»,
  «Periodo», «Zona», «Centro», «Foto», «Dispositivo», «n/d», «kWh del periodo»,
  «file»…).
- Espejo (`I18N_VOLCAR_IT`, `lib` + `components`): **0 huellas** de Space Eyes y de
  energía en `_guardias.jsonl`.
- `npm run typecheck` limpio · `npx vitest run --testTimeout=60000` en el worktree:
  **383 archivos, 7259 pruebas, todo en verde** · `npm run build` (copia
  `git archive`) **compila** (solo los avisos de hooks de siempre).
- La tolerancia `/^0,\d{3}$/` es **segura**: se compara con el trozo entero que caza
  «cifra con coma de millar», y un millar inglés nunca empieza por «0,» («10,812»
  no la cumple). No esconde huellas. **Pero** el SSIM en inglés («0.812») tampoco
  lo caza nadie: «cifra con punto decimal» solo mira 1–2 decimales. Ver V1.

## 3 · El italiano

### 3.1 · ERROR — «fa» repetido (corregir antes de fusionar)

`apps/web/lib/i18n/textos/spaceeyes.ts:2561-2562`

```
'spaceeyes.creativo.visto.uno': 'Vista {n} volta · l’ultima {hace} fa',
'spaceeyes.creativo.visto.otros': 'Vista {n} volte · l’ultima {hace} fa',
```

`{hace}` recibe `hace()` (`CreativosConfig.tsx:436`, `PantallaYCreativos.tsx:278`),
que ya devuelve «5 min fa». Se rinde, y está en el volcado de la rama:
**«Vista 42 volte · l’ultima 5 min fa fa»**. El español es «último {hace}» con el
«hace» dentro del hueco. Corrección:

```
'spaceeyes.creativo.visto.uno': 'Vista {n} volta · l’ultima {hace}',
'spaceeyes.creativo.visto.otros': 'Vista {n} volte · l’ultima {hace}',
```

Ninguna prueba lo ve: el barrido busca trozos español/inglés y la lista
`ITALIANO` no incluye esta línea. Conviene añadir «l’ultima 5 min fa» a lo
esperado y/o una guardia contra `\bfa fa\b`.

### 3.2 · Elisión del artículo con las fechas

«Inizia il 1 dic 2026» se acepta en interfaz (la nota del traductor lo dice), pero
el mismo patrón da **«il 8 dic»**, **«al 11 ott»**, **«del 8 dic»**, que un italiano
lee como error (lo correcto: «l’8», «all’11», «dell’8»). Claves:
`spaceeyes.prog.estado.empieza` (`:3167`), `prog.estado.vencio` (`:3168`),
`prog.proxima.espera` (`:3169`), `alta.lote.vigente` (`:3438`),
`alta.vigente-hasta` (`:3444`), `ficha.captura-del` (`:2506`, aria-label).
Propuesta, sin artículo: «Inizio: {fecha}», «Scaduta: {fecha}», «Non scatta prima
di: {fecha}», « · valida fino a: {fecha}», «Valido fino a: {fecha}», «Scatto:
{fecha}». (La prueba fija hoy «Inizia il 1 dic 2026»: habría que actualizarla.)
Lo mismo valdrá para los demás lotes: conviene decidirlo una vez en
`italiano-olas.md`.

### 3.3 · Frases que un nativo no diría así (menores)

| Archivo:línea | Hoy | Propuesta |
|---|---|---|
| `spaceeyes.ts:2787` `admin.coordenadas` | «…a che ora la foto viene pulita e a che ora viene con le righe» («viene pulita» se lee «la limpian») | «…a che ora la foto esce nitida e a che ora esce con le righe» |
| `spaceeyes.ts:2792` `admin.actualizar.pc` | «Verifica l’impronta del file prima di sostituirlo…» (se lee como orden al usuario) | «L’agente verifica l’impronta del file prima di sostituirlo e, se il nuovo programma non si avvia, torna da solo al precedente.» |
| `spaceeyes.ts:2631` `creativos.envio.ayuda` | «Raggruppate ne arriva una per creatività…» (calco de «Juntas llega una») | «In modalità raggruppata ne arriva una per creatività, la più nitida; …» |
| `energia.ts:440` `borrado.confirmacion` | «Si elimina la bolletta del contatore…» | «Verrà eliminata la bolletta del contatore…» (como `prog.eliminar.pregunta`) |
| `spaceeyes.ts:2642` `creativos.reaprender.texto` | «Si cancella tutto ciò che…» | «Verrà cancellato tutto ciò che…» |
| `energia.ts:391-392` `subir.opcion.2/3` | «il normale per una bolletta MENSILE» | «il caso normale per una bolletta MENSILE» |
| `spaceeyes.ts:2327` `hace.d` | «{n} g fa» (abreviatura rara) | «{n} gg fa» |
| `spaceeyes.ts:3004` `galeria.album.ninguna` | «Impossibile scaricare qualsiasi foto dell’album» | «Non è stato possibile scaricare nessuna foto dell’album» |
| `spaceeyes.ts:3413` `alta.pi.1` | «scrivi la microSD con {imager}» | «prepara la microSD con {imager}» |

### 3.4 · Cuarenta frases leídas en contexto (volcado italiano o, si la prueba no rinde ese estado, la plantilla con sus huecos rellenados a mano)

| # | Frase | Veredicto |
|---|---|---|
| 1 | I dispositivi che sorvegliano i tuoi impianti: cosa stanno vedendo e come stanno. | Bien |
| 2 | di 4 dispositivi / di 1 dispositivo | Bien, plural correcto |
| 3 | oltre 10 min · sotto il 20% | Bien, sin espacio antes de % |
| 4 | Da controllare · 3 / Si aggiornano manualmente · 2 | Bien |
| 5 | Per aggiornarlo serve una conferma sul telefono | Bien (sin «tocca») |
| 6 | 2 min fa · 5 h fa · 4 settimane fa · mai | Bien |
| 7 | Vista 42 volte · l’ultima 5 min fa fa | **Error** (§3.1) |
| 8 | Ciò che ogni dispositivo ha rilevato da solo controllando il suo schermo. Si aggiorna ogni minuto. | Bien |
| 9 | Aperti · Risolti · Non erano guasti | Bien, concuerda con «guasto» |
| 10 | Cabinet 4, 9 (2 di 15) · Cabinet 8 (riga 2, colonna 3) | Bien |
| 11 | Possibile cabinet spento · Diversi cabinet bloccati o coperti | Bien |
| 12 | Fotocamera (bisogna segnare di nuovo lo schermo) | Bien |
| 13 | Le foto si scattano da sole, a un’ora imprevedibile all’interno delle fasce orarie che definisci. | Bien |
| 14 | Ogni 2 h · Ogni 45 min | Bien (`cada-h` con cifra, no es periodicidad en letra) |
| 15 | Inizia il 1 dic 2026 / Non scatta fino al 1 dic 2026 | Aceptable con 1; mal con 8 y 11 (§3.2) |
| 16 | 08:00-10:00 (casuale) | Bien |
| 17 | Prossima: … (tra 30 min) · (3 questa settimana) | Bien |
| 18 | Metti in pausa · Attiva · Elimina programmazione | Bien, imperativos coherentes |
| 19 | Verrà eliminata «Prova giornaliera…». | Bien, comillas « » |
| 20 | Una foto per fascia oraria, in un minuto estratto a sorte ogni giorno. L’ora non si ripete, quindi la prova non si può preparare in anticipo. | Bien |
| 21 | Campagne di verifica · La creatività di riferimento è l’immagine con cui le fotocamere confrontano ciò che appare sullo schermo. | Bien |
| 22 | 3 selezionati / 1 selezionato | Bien |
| 23 | Arriva da Operazioni: si modifica lì (creatività, impianti e date delle sue prenotazioni) e qui si aggiorna da sola. | Bien |
| 24 | Galleria foto · Tutte le origini · All’accensione | Bien |
| 25 | Album scaricato; non è stato possibile includere 2 foto | Bien |
| 26 | Eliminare questa fotografia di Reforma 222? · Non si può annullare. | Bien |
| 27 | Scatta una fotografia di prova e sistema come apparirà nome · data · ora. | Bien |
| 28 | Dimensione 1,2 · Interlinea 1,3 · Spaziatura tra le lettere 0,00 | Bien, coma decimal |
| 29 | Ogni nuovo dispositivo entra con un codice monouso generato qui. | Bien |
| 30 | Sul telefono, apri l’app, conferma con Vincular e scansiona il QR. | Bien («Vincular» es el botón de la app, en español a propósito) |
| 31 | Codici di abbinamento · Quelli degli ultimi 30 giorni. Se uno ancora valido non ti serve più, annullalo. | Bien |
| 32 | Stai guardando una demo con dati di esempio. La tua azienda non ha ancora Space Eyes attivato; nessuno di questi dispositivi è tuo. | Bien |
| 33 | I tuoi impianti, visti dal sito, senza andare sul sito | Bien |
| 34 | Campagne programmatic verificate appena vanno in onda. | Bien (anglicismo del sector) |
| 35 | Prova di affissione | Aceptable; «Prova di messa in onda» encaja mejor con pantallas digitales |
| 36 | Il servizio delle fotocamere non risponde in questo momento | Bien |
| 37 | Se continua così per più di un’ora, avvisa il supporto da Impostazioni › Impostazioni aziendali › Supporto. | Bien (L5 fija el nombre) |
| 38 | Una bolletta per proprietà e per mese. Si ripartisce tra i suoi impianti come l’affitto. | Bien salvo «proprietà» (§4) |
| 39 | MX$ 3.600,50 · 1.300 kWh · US$ 900,00 | Bien, formato del dueño |
| 40 | Si contano i mesi di calendario che il periodo tocca, non quanto dura. Una bolletta mensile inizia a metà mese, quindi quasi sempre ne tocca due… | Bien |
| 41 | 2 mesi di calendario — il normale per una bolletta MENSILE | Mejorable (§3.3) |
| 42 | Bollette mancanti nel periodo: 2 su 6. | Bien, concuerda con cualquier cifra |
| 43 | È stato letto 1 file e contiene 2 righe. … non si salva nulla finché non clicchi salva. | Bien |
| 44 | Il PDF indica 0 kWh · Totale della bolletta MX$ … (include arretrati e pagamenti) | Bien |

## 4 · Glosario del lote

| Término | Juicio |
|---|---|
| guasto (aperto / risolto / scartato) | Correcto y natural; «Non era un guasto» muy bien |
| vista in diretta | Correcto |
| verifica | Correcto |
| flotta | Se entiende, pero para aparatos un italiano diría antes **«parco dispositivi»** («di tutto il parco dispositivi»). Aceptable; decisión del dueño |
| cabinet | Correcto: es el término del sector LED en Italia |
| creatività (f., invariable) | Correcto en publicidad italiana |
| inquadratura · monitoraggio · scatto · obiettivo / fotocamera / telecamera IP | Correctos |
| codice di abbinamento | Correcto |
| etichetta (marca de la foto) | Aceptable; «sovrimpressione» es más preciso para un texto grabado en la imagen |
| schermo vs impianto | Coherente con el glosario común y con su uso en el lote |
| server padre | Aceptable (término interno) |
| bolletta · contatore · riga · lotto · arretrati · illuminazione pubblica | Correctos |
| punto di misura | Aceptable; el sector eléctrico italiano habla de «punto di prelievo / di fornitura (POD)», pero en la UI se entiende |
| impianto isolato | Aceptable |
| **proprietà** (predio) | **Choque para la costura**: L3 y L4 usan «immobile». Recomiendo **«immobile»**: «proprietà» también significa «propiedad/titularidad» y choca con «proprietario» (el locatore); «Proprietà o impianto» se lee como «propiedades» de un ajuste. Afecta a 9 apariciones en `energia.ts` (p. ej. `:331`, `:366`) |
| **Titolare** (rol Dueño, `spaceeyes.ts:2673`, `:2871`, `:2957`) | No es del glosario: `admin.rol.dueno` aún no tiene italiano (L5). **Otro punto para la costura**: que L5 adopte «Titolare» o que aquí se cambie a lo que fije L5 |

## 5 · Fuera de ámbito

Justificado y sin efecto en es/en (§1): `fijo()`/`cifra()`/`gigas()` en
`piezas.tsx`, `fmtBytes` en `Graficas.tsx`, `formatNumero` con idioma en 12
componentes de Space Eyes y 4 de energía, `pesos()` con los dos límites en
`captura.ts`, `energia/page.tsx`, y `catalogos-italiano.test.ts` (la igualdad
`it = en` de las fallas se rompe a propósito y se sustituye por el italiano
esperado). No toca `dinero.ts` ni la guardia. El hallazgo sobre
`formatearDinero` con solo `maximumFractionDigits` en italiano es correcto y es
para quien lleve `dinero.ts`.

## 6 · Mutantes propios (8, restaurados con `git checkout`)

Corridos contra las pruebas del lote (`pantallas-spaceeyes`, `pantallas-energia`,
`textos/spaceeyes`, `textos/energia`, `donde-falla`, `costura`,
`catalogos-italiano`, `components/demo/energia`, `components/demo/space-eyes`).

| # | Mutante | Resultado |
|---|---|---|
| V1 | `Verificacion.tsx`: el SSIM vuelve a `ssim.toFixed(3)` («0.812» en italiano) | **SOBREVIVE** — la guardia no caza 3 decimales con punto y nadie espera «0,812» |
| V2 | `cifra()` ignora el idioma («2.5 foto al giorno») | **SOBREVIVE** — ninguna prueba rinde fotos/día con decimales en italiano |
| V3 | `fijo()` en español pasa por `Intl` (cambia el español ≥ 1000) | **SOBREVIVE** — no hay prueba unitaria de `fijo`/`cifra` en es/en (lo medí aparte, §1) |
| V4 | `prog.estado.empieza` italiano = «Empieza el {fecha}» | Muere (3) |
| V5 | `energia.kpi.sin-pantalla.uno` con «bollette» | Muere (2) |
| V6 | `Galeria.tsx`: el total sin idioma | **SOBREVIVE** — el total de la prueba es < 1000 |
| V7 | `Graficas.tsx`: `fmtBytes` móvil sin idioma | Muere (1) |
| V8 | `recibos.ts`: kWh leídos aceptados (`else`) sin idioma | **SOBREVIVE** — el M3 del traductor cubre solo la rama `pdf-dice` |

Recomendado: una prueba unitaria de `fijo`/`cifra`/`gigas` (es/en = `toFixed`/`String`
con los bordes de §1; it con coma y punto de millar), «SSIM 0,812» en lo esperado
de Verificación, un total ≥ 1000 en la galería y la rama de kWh aceptados en
italiano.

## 7 · Lo que no se comprobó

- Sin servidor ni e2e (encargo): no se miró la app viva ni el CSV ni las
  respuestas del servidor; los dos lados quedan cubiertos solo por el volcado de
  las pruebas unitarias.
- Solo se leyeron los estados que las pruebas rinden; el resto de claves se leyó
  en el diccionario (las 1122).
