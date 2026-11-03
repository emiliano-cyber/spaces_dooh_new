# Validación · Italiano, lote L3 · Inventario, arrendadores y operaciones

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l3-inventario` (`0298c2c3`), sobre
`integra/idiomas` (`6fea374a`) · **Revisión del traductor:**
`docs/i18n/revision-italiano-l3.md` · **Validador:** sesión independiente (solo
código y HTML rendido; sin el razonamiento del traductor).

## Veredicto: **ÁMBAR** (sin bloqueantes) → **VERDE** en la 2.ª pasada (§11)

Español e inglés idénticos, medido. El italiano se lee bien y con el registro
correcto; la cobertura es completa (salvo la constancia, excluida a propósito y
bien tipada). Queda ámbar por **una regla de estilo que el propio lote se dio y
no aplicó en todas partes** (el artículo ante la fecha, H1), tres frases
mejorables (H2–H4) y **un hueco de pruebas** (H7): 203 de las 1173 claves del
lote no se rinden en ningún estado italiano, así que una clave en inglés o en
español en un toast no la caza nada. Ninguno rompe la pantalla.

## 1 · Español e inglés idénticos — medido aquí

| Medición | Resultado |
|---|---|
| `I18N_VOLCAR_TODO`, suite entera, base (`6fea374a`, worktree desechable) y rama | 3027 / 3293 archivos; `diff -rq`: **0 distintos, 0 desaparecidos**; 266 nuevos, todos de los `describe` italianos nuevos de las tres pruebas del lote |
| `DICCIONARIOS.es` / `.en` (volcados a JSON en base y rama) | 5590 valores cada uno: **0 cambiados, 0 quitados, 0 nuevos** |
| `DICCIONARIOS.it` | 1163 valores cambian (los que caían al inglés) |
| CSV y servidor | Sin cambios en el diff (`git diff --stat`): solo diccionarios, dos componentes, pruebas y docs |
| `NuevaPantallaForm.tsx` | `numeroEnIdioma(n,'es')` = `toLocaleString('es-MX')` (es) y en pasa de `'es-MX'` a `'en-US'`: comprobado que escriben igual (4500, 45000, 1234.5678, 0.5, 1e6) |
| `OTVista.tsx` | es y en tienen `posicionSimbolo: 'intl'` → sin espacio, mismo texto. El mutante V1 (espacio siempre) lo cazan las pruebas es/en |

## 2 · Cobertura y tipo

- `operaciones` 177/177, `operaciones2` 205/205, `inventario` 360/360,
  `arrendadores` 431/444. Los 13 que faltan son exactamente
  `arrendadores.constancia.*` y en `it` valen el **inglés** (comprobado en
  `DICCIONARIOS.it`).
- El tipo `Record<Exclude<ClaveArrendadores, \`arrendadores.constancia.${string}\`>, string>`
  hace las dos cosas: V7 (meter una clave de la constancia en `IT_*`) da
  `TS2353`, y V10 (quitar una clave normal) da `TS2741`. Son 431.
- La tabla clave por clave de la revisión coincide **1173/1173** con el código
  (comparada por script), así que leerla es leer el diccionario.
- Copias exactas en el lote: 10 iguales al inglés y 26 iguales al español, todas
  cognados válidos en italiano (`Email`, `File`, `Checklist`, `Regime:`,
  `Browser`, `· server`, `in {periodo}`, `In {donde}:`, `{campo}: {valor}`;
  `Tipo`, `Marca`, `Vista`, `Motivo`, `Muro`, `Vandalismo`, `Domicilio`,
  `Inventario`, `Alta`, `Urgente`, `Equivale a`, `congela`, `uno solo`, `RFC`,
  `RUC`, `IA/Vision`, `.xlsx o .csv`, `ID del dispositivo AdMobilize`, `«{…}»`).

## 3 · Huellas de formato

Espejo de la ola 0 (`I18N_VOLCAR_IT`) sobre las tres pruebas del lote, en la base
y en la rama: **24 y 24**, las mismas cinco firmas: «Mozilla/5.0» (12, el
navegador del firmante, un dato) y el documento del contrato en español (12:
«2 de noviembre de 2026», «20 de octubre de 2026», «a.m.»). **Ninguna es del
lote.** En la suite entera la rama deja 95 renglones en `_guardias.jsonl`; los
demás son de Dashboard, Space Eyes, Comercial y Propuestas (otros lotes).

## 4 · Hallazgos

| # | Gravedad | Dónde | Frase | Corrección propuesta |
|---|---|---|---|---|
| H1 | Menor (estilo, repetido) | `operaciones2.ficha.cerrada-el`, `arrendadores.pago.pagado-el`, `.versiones.archivada`, `.versiones.firmo-el`, `.licencias.vence`, `.firmas.congelado`, `.firmas.envia`, `inventario.wizard.arrendado-hasta`, `.wizard.historial`, `.wizard.pantalla-historial` | «Chiuso il {fecha}», «scade il {fecha}», «fino al {fin}», «deve iniziare il {desde}» → con día 8 u 11 sale «il 8 ott», «fino al 11 nov» (en italiano: «l’8», «all’11») | El lote ya cambió «dal…al» por un guion **por esta misma razón** (revisión §1); falta aplicarlo aquí. Sin artículo: «Chiuso in data {fecha}», «Pagato in data {fecha}», «scade in data {fecha}», «Documento congelato in data {fecha}», «firmato da {nombre} in data {fecha}», «archiviata in data {fecha}»; «in locazione fino al giorno {fin}», «deve iniziare in data {desde} o successiva», «spostala al giorno {desde} o dopo» |
| H2 | Menor (ambigua) | `arrendadores.completar.varias` (`textos/arrendadores.ts`) | «Quale fattura questo contratto si sceglie nella sua scheda.» — «fattura» se lee como sustantivo («qué factura») | «Ha {n} ragioni sociali; si mostra la prima. Quella che fattura questo contratto si sceglie nella sua scheda.» |
| H3 | Menor (calco) | `arrendadores.pagadora.sub` | «Cambia solo a nome di chi esce questo canone.» (calco de «a nombre de quién sale esta renta») | «Cambia solo la società a nome della quale si paga questo canone. Non tocca l’importo.» |
| H4 | Menor (término) | `arrendadores.alta.rfc-malo` | «… 3 caratteri di omoclave» — «omoclave» no existe; es el término del SAT | «… 3 caratteri di homoclave» (como RFC, no se traduce) |
| H5 | Sugerencia | `arrendadores.comun.en-dias`, `.licencias.vencio`, `.licencias.vence-en` | «tra 29 g», «Scaduta da 32 g» | La abreviatura italiana de giorni es «gg»: «tra 29 gg» |
| H6 | Sugerencia (decisión del dueño) | glosario del lote | «lucchetto della fatturazione» es calco del español/inglés; un italiano de empresa dice «blocco (della) fatturazione» | «Blocco fatturazione»; «tengono bloccata la fatturazione»; «Fatturazione sbloccata» para el «aperto». Si se cambia, va en todo el lote y en la costura |
| H7 | **Hueco de pruebas** | `lib/test/italiano-l3.ts` y las tres pruebas | El barrido solo ve claves **rendidas**: 203 de 1173 claves del lote (toasts, errores, diálogos de contraseña, rama de `.uno`) no aparecen en ningún estado italiano (inventario 85, arrendadores 82, operaciones2 23, operaciones 13). Sobreviven V3, V4 y V6 | Una prueba estática por ámbito: `IT[k] !== EN[k]` e `IT[k] !== ES[k]` salvo una lista declarada de cognados (las 36 de §2). La leí entera a mano esta vez: ninguna de las 203 es copia ni está mal |
| H8 | Menor (prueba) | `pantallas-inventario-arrendadores.test.ts`, estado «alta manual · el visor de la detección» | El arreglo de la renta solo está protegido en `it`: V2 (forzar `'it'` en `NuevaPantallaForm`) pinta «Actualmente: 45.000.» en español y no falla nada | Añadir «Actualmente: 45,000.» / «Currently: 45,000.» a las listas es/en de ese estado |
| H9 | Sugerencia | `inventario.carga.nombra` | «Dai a ogni file il nome del codice fornitore: …» (se lee «el nombre del código») | «Rinomina ogni file con il {codigo}: {a} (principale) o {b}, {c}… se ce n’è più di una per impianto.» |

Nota menor sin hallazgo: «vigencia» sale como «Durata» (`comun.vigencia`),
«validità» (`wizard.inicio-vigencia`) e «in vigore» según el sitio; el español
también varía y cada una se entiende en su contexto.

## 5 · Frases revisadas en el HTML italiano (muestra de 48)

Leídas en el volcado `I18N_VOLCAR_TODO` de los estados italianos y contra su
componente (las que llevan `{…}` no salen en ningún estado y se leyeron en el
diccionario). ✔ = correcta y natural; ~ = vale, con matiz; ✘ = hallazgo.

| Frase | Veredicto |
|---|---|
| Attività delle squadre · monitoraggio sul campo | ✔ |
| 1 OdL in ritardo · 1 in scadenza | ✔ (OdL masculino, coherente) |
| — un OdL aperto oltre la data di scadenza tiene chiuso il lucchetto della fatturazione. | ~ (H6) |
| Aperti · aperti senza responsabile · in scadenza entro 2 giorni | ✔ |
| Gli altri restano in «Tutti». | ✔ |
| Crea il primo con «Nuovo OdL»: si collega a una campagna e al suo impianto. | ✔ |
| OdL chiuso · L’OdL è chiuso e non si può più modificare. | ✔ |
| Costo registrato: MX$ 2.300,00. | ✔ (D1, con espacio) |
| Chiuso il 5 ott 2026, 10:30 | ✘ con 8/11 (H1) |
| Lucchetto della fatturazione aperto | ~ (H6; coherente con «Billing lock open») |
| Errore durante il salvataggio: {error}. Le voci spuntate si vedono qui ma NON sono ancora salvate. | ✔ |
| Sola lettura: il tuo ruolo può vedere questo ordine di lavoro, ma non spuntarne la checklist. | ✔ |
| Questo OdL non ha un costo inserito. Se lo chiudi, non potrai più registrarlo… | ✔ |
| Da approvare · bloccano la pubblicazione · Approvate · pronte da assegnare | ✔ (creatività femenino) |
| su 1 spot prenotato · 1/1 spot con creatività | ✔ (spot invariable) |
| 1 creatività · 3 creatività a rotazione | ✔ |
| Hai 1 campagna, su mezzi statici: la sua grafica si gestisce in Stampa. | ✔ |
| La creatività è già stata approvata — sostituiscila o eliminala per cambiarla | ✔ |
| Vuoi davvero ritirare {nombre}? … perché tu la rimuova dal suo pannello. | ✔ |
| {recordatorio} poi entra nel pannello di DOOHmain ed {elimina}. | ✔ («ed» eufónico ante «elimina») |
| Occupazione futura per quindicina o mese: incrocia le prenotazioni confermate con l’inventario… | ✔ (quindicina, glosario) |
| impianti richiesti da 1 proposta aperta · non bloccano | ✔ |
| In proposta (libero, ma una proposta aperta lo richiede) | ✔ |
| Restano {libres} di {total} slot | ✔ |
| Veicoli, attrezzi, schermi, telecamere e altri articoli, e i loro trasferimenti. | ✔ |
| 1 dismesso · nessuno dismesso | ✔ |
| Prova colore in sospeso · non approvata | ✔ |
| Ordini di stampa · dalla grafica al montaggio | ✔ |
| Consulta l’inventario completo, o aggiungi impianti con caricamento massivo o inserimento manuale. | ✔ |
| 1 digitali · 4 fissi | ~ (el contador con plural fijo es igual en es/en) |
| su 5 · 1 con slot venduti | ✔ |
| tutti hanno un contratto o sono di proprietà | ✔ |
| Questo immobile ha già un contratto in vigore di … Non se ne firma un altro: l’impianto si aggiunge all’immobile e condivide quel canone con gli altri. | ✔ |
| Questo spazio è stato in locazione fino al 30 giu 2026. Il nuovo contratto inizia il 1 lug 2026 o dopo. | ✘ con 8/11 (H1) |
| Da chi prendi in locazione questo spazio? | ✔ (la empresa es la conduttrice) |
| Il costo di questo impianto è il canone al locatore, che si inserisce nella scheda Base. Attualmente: 45.000. | ✔ |
| 1 codice esiste già · 3 righe lette · 1 riga letta | ✔ (mejor que el «código(s)» del español) |
| Un immobile è un solo stabile e il suo canone si ripartisce tra i suoi impianti… | ✔ |
| L’altro lato della rete · contratti, canoni e scadenze | ✔ |
| Il canone mensile non include 1 contratto incompleto (da inserire: locatore, durata, importo e periodicità), quindi il costo reale è maggiore. | ✔ |
| 1 rata scaduta (MX$ 10.000,00) · MX$ 30.000,00 da pagare | ✔ |
| Riconciliazione dei canoni per locatore · Locatore / postazione · 1 postazione | ✔ («quadratura» también valdría) |
| Margine mensile = ricavi delle prenotazioni in vigore − canone del locatore. | ✔ |
| Attivi: 1 su 1. Solo quelli attivi impediscono la disattivazione. | ✔ |
| Senza ragione sociale, i contratti di questi locatori non potranno indicare a chi si fattura. | ✔ |
| Gli manca: ragione sociale, RFC, regime fiscale. | ✔ |
| Pagato il 2 ott 2026 · bonifico. Qui si allegano solo i documenti… | ✘ con 8/11 (H1) |
| Ho letto il contratto nella sua interezza e manifesto la mia volontà di obbligarmi secondo i suoi termini. | ✔ (registro legal correcto) |

Además leí las 1173 claves en la tabla (idéntica al código): concordancias de
género y número con los huecos correctas en todos los plurales (`{n} nuovo/nuovi`,
`{n} selezionato/selezionati`, `{n} rata scaduta/rate scadute`, `{n} impianto
senza contratto verrà escluso`), apóstrofo tipográfico en todas, comillas « »,
ningún `%` con espacio delante de una cifra («del {pct}%»; «Adegua %» es el
rótulo del botón), registro «tu» y verbos de botón coherentes (Salva, Annulla,
Elimina, Applica, Conferma e…).

## 6 · Los términos propuestos

| Término | ¿Lo usaría un italiano del OOH? |
|---|---|
| impianto | **Sí**, es el término del sector («impianti pubblicitari») |
| schermo (digital / artículo) | Sí; la excepción de la costura «Pantalla → Impianto/Schermo» tiene sentido |
| canone (di locazione) | Sí |
| immobile | Sí (también «area» o «proprietà»; «immobile» es el más claro) |
| conduttrice | Sí, término legal exacto frente a «locatore» |
| OdL | Sí, habitual en manutenzione; masculino bien aplicado |
| lucchetto della fatturazione | **Calco**: se entiende, pero se diría «blocco fatturazione» (H6) |
| creatività | Sí, uso del sector, femenino invariable bien aplicado |
| postazione | Sí («postazioni pubblicitarie») |
| riconciliazione | Sí (contable); «quadratura» sería igual de natural |
| problema (incidencia) | Vale; en campo también «anomalia» o «segnalazione» |
| conto economico | Sí, es el P&L |
| dismettere / disattivare | Sí |
| in ritardo / in scadenza | Sí |
| rangos con guion «1 mar 2026 – 14 mar 2026» | Sí, y evita el «dal 1/dall’8» |

## 7 · Fuera de lista

| Archivo | Juicio |
|---|---|
| `components/demo/inventario/NuevaPantallaForm.tsx` | Justificado y correcto; es/en idénticos (§1). Sin prueba es/en que lo proteja (H8) |
| `components/operaciones/OTVista.tsx` | Justificado; lo protegen las pruebas es/en (V1 muere). Junta dos nodos de texto en uno: sin efecto visible |
| `textos/costura.test.ts` | Excepción «Pantalla» bien razonada (espectacular vs aparato) |
| `catalogos-italiano.test.ts` | Correcto: la lista por omisión de OT deja de caer al inglés y lo escrito por una persona sale tal cual |
| `lib/test/italiano-l3.ts` | Útil; su límite es el de H7 (solo lo rendido) |
| `forzar` en italiano en la prueba de inventario | Solo añade la rama `it`; las cadenas es/en no cambian (diff de volcados = 0) |

No pisa a otros lotes: solo toca `IT_*` de sus cuatro ámbitos.

## 8 · Mutantes propios (10), todos restaurados

| # | Mutante | Resultado |
|---|---|---|
| V1 | `OTVista`: espacio tras el símbolo en TODOS los idiomas | **muere** (2 pruebas es/en de operaciones2) |
| V2 | `NuevaPantallaForm`: renta con `'it'` fijo | **sobrevive** (H8) |
| V3 | `arrendadores.vence.hace.uno` = «{n} giorni fa» | **sobrevive** (no se rinde; H7) |
| V4 | `arrendadores.firmas.copiar` en español | **sobrevive** (no se rinde; H7) |
| V5 | Apóstrofo recto en `inventario.toast.pantalla-agregada` | muere (costura) |
| V6 | `operaciones.imprenta.no-avanzar` en inglés | **sobrevive** (no se rinde; H7) |
| V7 | Una clave `arrendadores.constancia.*` en `IT_ARRENDADORES` | muere (`tsc` TS2353) |
| V8 | Concordancia «contratti attive» | muere (estado «arrendadores · vacía») |
| V9 | Apóstrofo recto en una clave rendida (`inventario.sin-permiso`) | muere (pantalla y costura) |
| V10 | Quitar una clave del `IT_ARRENDADORES` | muere (`tsc` TS2741) |

## 9 · Comprobaciones

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: base **383 archivos / 6988**; rama
  **383 / 7137**, todo en verde (cifras de la revisión confirmadas).
- `npm run build` en una copia (`git archive HEAD`, `0298c2c3`): **limpio** (exit 0).
- `git status` limpio tras los mutantes.

## 10 · Lo que no pude comprobar

- El recorrido en el navegador (no se levantan servidores en paralelo).
- Las 203 claves no rendidas se juzgaron leyendo el texto, no en pantalla.
- Que «quindicina», «poster» y «Titolare» sean lo que quiere el dueño: vienen
  del glosario común, no se reabren aquí.

## 11 · 2.ª pasada (sobre `f35fc668` + `f5f81aa6`) — **VERDE**

| Hallazgo | Comprobado en el código |
|---|---|
| H1 | Las 10 claves sin artículo ante la fecha: «Chiuso in data {fecha}», «Pagato in data…», «archiviata in data…», «firmato da {nombre} in data…», «scade in data…», «Documento congelato in data…», «Scade in data…», «fino al giorno {fin}», «in data {desde} o successiva», «spostala al giorno {desde}». Barrido por regex de los cuatro ámbitos: 0 restos de «il/al/dal {fecha…}» |
| H2, H3, H4, H9 | Corregidos con la frase propuesta («Quella che fattura…», «la società a nome della quale si paga…», «homoclave», «Rinomina ogni file con il {codigo}…») |
| H5 | «gg» en las tres claves |
| H6 | «tengono bloccata la fatturazione», «tiene bloccata la fatturazione», «Fatturazione sbloccata»; 0 «lucchetto» en el lote |
| incidencia | «Segnala anomalia», «Anomalia segnalata», «Descrivi l’anomalia…»; «Incidente» queda solo como tipo «Accidente». 0 «problema» |
| H7 | `lib/i18n/textos/italiano-l3.test.ts`: italiano ≠ inglés ≠ español salvo los 36 cognados (los mismos que listé en §2), `.uno` ≠ `.otros` salvo 2 invariables justificados, y la lista declarada se vigila a sí misma |
| H8 | «Actualmente: 45,000.» / «Currently: 45,000.» en las listas es/en del visor |

**Mutantes repetidos:** V2 muere (2 pruebas es/en del visor), V3 muere (singular
= plural), V4 y V6 mueren (copia del español / del inglés). Mutante nuevo V11
(«archiviata il {fecha}», clave no rendida): **sobrevive** — la regla «sin
artículo ante la fecha» solo la vigilan las claves rendidas. Sugerencia, no
bloqueante: una expresión regular en `italiano-l3.test.ts`
(`/\b(il|al|dal|del) \{(fecha|fin|desde|inicio|hasta)\}/`). Queda también la
cabecera de columna «Pagato il» (`arrendadores.pagos.col.pagado-el`), que no
interpola fecha; se puede dejar o poner «Data di pagamento».

**Medido otra vez:** `npm run typecheck` limpio; `npx vitest run` **384
archivos / 7146 pruebas** en verde; HTML de toda la suite contra la base
`6fea374a`: 3293 archivos, **0 distintos, 0 desaparecidos**; `DICCIONARIOS.es` y
`.en`: 5590, **0 cambiados**, 0 quitados, 0 nuevos. `git status` limpio tras los
mutantes.
