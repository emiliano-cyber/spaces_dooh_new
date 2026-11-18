# Validación independiente · COSTURA 2 (inglés)

- **Rama:** `feat/ingles-costura-2`, HEAD `1ed216c7`, 8 commits sobre `integra/ingles` `00815aa3`
  (3 merges `108d9638`, `3de23d14`, `8f0870a7` + `980bc419`, `d0f8b6aa`, `36de5e34`, `c29626ac`, `1ed216c7`).
- **Fecha:** 2026-11-02.
- **Validador:** independiente; no corrigió nada. Este informe es lo único que escribió, y no está commiteado.
- **Límites declarados:** no se levantó `next start` ni se corrieron las e2e (poca memoria). Vitest se corrió con `--testTimeout=60000`.

## Veredicto: **VERDE** (con 6 menores, ninguno bloqueante)

Las tres fusiones no perdieron nada de ningún lado. El español queda intacto, medido en HTML (397 estados) y en
`DICCIONARIOS.es`. El ayudante unificado funciona y lo usan los once grupos de pantallas. Los nueve mutantes que
probé murieron todos. Los menores son huecos preventivos del ayudante y dos cosas de estilo en el inglés.

---

## 1 · Las fusiones

**Método.** Primero miré cada merge con `git show --remerge-diff`, que enseña el conflicto y cómo se resolvió.
Después hice una comprobación mecánica: cada línea que añadía una rama (contra su merge-base) tenía que estar en
HEAD, y cada línea perdida tenía que tener explicación.

- **`diccionario.ts`.** Los tres conflictos son la unión de imports y spreads, y no se perdió nada. El orden es
  `…SERVIDOR, CLIENTES, OPERACIONES, SPACEEYES, INVENTARIO, ARRENDADORES`. No hay claves duplicadas entre los
  lotes nuevos: cada lote tiene su prefijo (`clientes.` 220, `operaciones.` 177, `spaceeyes.` 993,
  `inventario.` 360, `arrendadores.` 444), y un `uniq -d` sobre todas las claves `ES` no encontró ninguna repetida.
- **`costura.test.ts`.**
  - `LOTES` tiene los 21 grupos. `baseDelDiccionario` descuenta los 16 ámbitos, incluidos los cinco nuevos.
  - `DISTINTOS_A_PROPOSITO` conserva Aprobada, RFC, Validada y Validar (clientes), Estado y Ganancia (Space Eyes),
    y Próximo, Vigente y Vence (inventario).
  - Las tres versiones de «Actualizar» quedaron en una sola entrada con los tres motivos (admin, Space Eyes,
    inventario/DOOHmain).
  - Las únicas líneas «perdidas» son las tres versiones anteriores de esa misma entrada, y es lo correcto.
- **Bóveda `idiomas-es-en.md`.** Las subsecciones de los tres lotes están completas en HEAD, tal como venían en
  cada rama:
  - «Lote operaciones y clientes» (l. 1398);
  - «Lote Space Eyes» y su «Segunda vuelta» (l. 1497 y 1566);
  - «Lote inventario y arrendadores» (l. 1598).

  Además se añade «Costura 2» (l. 1719). Las subsecciones de `00815aa3` (catálogos, admin, servidor) siguen ahí.
- **Las demás líneas «perdidas» son cambios intencionados de la costura**, y cada uno está declarado:
  - ZIP → postal code;
  - it still needs → this is missing;
  - can’t → cannot;
  - Legal name → Legal entity;
  - las claves `arrendadores.entidades.*`;
  - el helper de inventario sustituido;
  - `[t]` → `[t, idioma]`;
  - `fraseDeLote` exportada;
  - la constancia («circumstantial evidence»);
  - `'>of 1 space<'` en admin.
- **Inglés entre bases.** Solo dos claves tenían valores distintos entre las bases: `nav.actividad` y
  `campanas.facturacion.cp`. Las ramas de lote venían de bases anteriores. HEAD conserva el valor más nuevo de
  `00815aa3` («Activity log», «Tax postal code»), que es lo correcto.

## 2 · `/razones-sociales`

- **Claves.** La página se pinta con `admin.razones.*`: `sin-acceso` y `error` en
  `app/(app)/(shell)/razones-sociales/page.tsx:69-70` y `:77`, y `titulo` y `subtitulo` en `:92` y `:94`.
  Debajo, `GestionEntidadesFiscales` usa también `admin.razones.*`.
- **Claves retiradas.** Nadie usa ya las tres claves `arrendadores.entidades.*`. Con `git grep HEAD` solo
  aparecen en `docs/i18n/revision-arrendadores.md:481-483`, tachadas, y en la bóveda. Ningún snapshot se quedó
  obsoleto: vitest no avisó de ninguno. Su español es idéntico al de la clave de admin, como prueba el volcado
  HTML del punto 6 (inventario se volcó con su propia versión de la página, y el diff sale vacío).
- **Avisos.** Los de `GestionRazonesSociales` dicen «Legal entity added / updated / deleted», también en la
  variante «· assigned to {n} contract(s)…» (`lib/i18n/textos/arrendadores.ts:693-697`).
- **«Legal entity» y «legal name» juntos.**
  - En la tarjeta de admin (`GestionEntidadesFiscales`) tiene sentido: el registro es una *legal entity* y el
    campo «Razón social» es su *Legal name*.
  - En `GestionRazonesSociales` (la página de Arrendadores) la mezcla es menos limpia: el título dice «Legal
    entities» y los avisos «Legal entity…», pero en la misma tarjeta aparecen «{n} without a legal name» (`:703`),
    «No legal name. …» (`:707`) y «There are contracts invoiced to this legal name» (`:712`). Se defiende
    leyéndolo como «el nombre al que se factura», pero el botón «Add →» de al lado añade una *legal entity*.
    → **Menor M4** y decisión del dueño.

## 3 · Divergencias

La prueba de costura pasa, así que **no queda ninguna divergencia sin declarar** según su criterio: el mismo
español en dos lotes con distinto inglés.

**Unificadas.** Las seis están bien justificadas:

| Unificación | Juicio |
|---|---|
| «Invalid postal code» y «Tax postal code» | Correcto. Coincide con el servidor (`errores-servidor.ts:607`), admin (`admin.razones.cp`) y campañas, y «ZIP» es de EE. UU. Ya no queda ningún «ZIP» en `textos/` ni en `errores-servidor.ts` |
| «postal code» en los ejemplos de domicilio de arrendadores | Correcto, por lo mismo |
| «this is missing» | Coincide con el servidor (`errores-servidor.ts:919`). Con varios elementos («this is missing: the address, the owner…») el número no concuerda; viene del servidor, ver la decisión del dueño |
| «It cannot be negative» | Correcto, como compartidos |
| «cannot» en `licencias.invertidas` | Correcto contra el servidor. Pero en la misma tarjeta queda `licencias.antes-expedicion` = «Can’t be earlier than the issue date» (`arrendadores.ts:872-873`): unificar por texto exacto dejó dos registros distintos en la misma tarjeta. → **Menor M5** |

**Declaradas.** Las cinco son correctas: significan cosas distintas, y cada motivo está escrito en
`costura.test.ts:104-108`.

| Español | Inglés | Por qué es correcto |
|---|---|---|
| Dada de baja | Deactivated / Decommissioned | Baja lógica reversible frente a una pantalla que sale de la flota. Es coherente con «Baja» = Decommissioned del sitio |
| Equipo | Team / Device | Personas frente a aparato |
| Operador | Operator / Carrier | Empresa dueña frente a compañía telefónica de la SIM |
| Volver | Back / Revert | Navegar frente a devolver la cámara |
| Registrar | Register / Record | Dar de alta un artículo frente a anotar un pago |

No encontré ninguna que debiera estar y falte.

## 4 · El ayudante `lib/i18n/guardias-ingles.ts`

- **Patrones** (`:52-59`): dinero sin `MX$` (el importe se lleva el código de moneda que lo sigue), `dd/mm/aaaa`,
  fecha larga, mes corto, corto con guion y «a. m.».
- **Atributos** (`:62`): `title`, `aria-label`, `placeholder` y `alt`. Los `value=` se quitan antes.
- **`permitidos`** (`:101`): se prueba contra el **trozo**, compilado sin `/g`, así que el `lastIndex` no causa
  saltos.
- **Uso.** Lo llaman los once grupos:
  - propuestas, compartidos, campañas y finanzas, comercial, catálogos, admin, cuenta y shell, clientes y
    operaciones, en un `describe` por estado;
  - Space Eyes, quitando antes la marca de la foto;
  - inventario y arrendadores, con `permitidos: [/\$[\d,.]+ MXN/]` en `pantallas-inventario-arrendadores.test.ts:1523`.

**Sonda directa.** La corrí con un archivo de prueba temporal, ya borrado.

| Entrada | Resultado | Tipo |
|---|---|---|
| `<input value="02/11/2026">` | limpio | correcto, no es falso positivo |
| `data-fecha="02/11/2026"` | limpio | correcto |
| `$5.00` con `moneda:'USD'` | limpio | correcto, no es falso positivo |
| `02 nov 2026, 10:15 a.m.` (formato de `space-eyes/piezas.tsx:194`) | 2 huellas | correcto |
| `2/11/2026`, que es lo que da `toLocaleDateString('es-MX')` | **limpio** | **falso negativo**, M1 |
| `<span>$</span><span>10,000.00</span>` | **limpio** | **falso negativo**, M2 |
| `02/11/26` | limpio | falso negativo, menor |
| `2 de nov. de 2026` | limpio | falso negativo, menor |
| `aria-label='…'` con comilla simple | limpio | irrelevante: React siempre usa comillas dobles |
| `US$ 5.00` en modo MXN | huella «$ 5.00» | falso positivo, M3 |
| `11/02/2026` en en-US con relleno | huella | falso positivo teórico: el inglés de la app usa «Nov 2, 2026» |
| «Opens at 9 a.m.» | huella | falso positivo teórico: hoy no hay prosa así en el diccionario |

## 5 · Los retoques menores

- **Space Eyes.**
  - `alta.tel.3` dice ahora «choose {vincular}». Es el único cambio en el HTML inglés de las 95 pantallas inglesas
    de Space Eyes (2 archivos `en_alta_telefono_*` difieren justo en esa frase).
  - `space-eyes-api.ts`: las 8 funciones exportadas reciben `idioma = 'es'`. Las llaman con idioma la ficha, el
    historial, la lista y los creativos. `infoAltaApi()` se llama sin idioma (`AltaDispositivo.tsx:195`), pero su
    error se traga con `.catch(() => setInfo(null))`, así que no se pinta.
  - Efecto lateral sin daño: los efectos de esas cuatro pantallas vuelven a pedir los datos al cambiar de idioma,
    porque `idioma` entró en sus dependencias.
- **Inventario.**
  - `fraseDeLote` y `avisoDeLote` solo pasan a exportarse; la lógica no cambia.
  - La prueba las llama, y hay una guardia de fuente sobre `unidadLoteRef.current`.
  - Constancia: «circumstantial evidence». Es solo inglés: la constancia va en el idioma configurado y el texto
    legal del contrato no se toca.
- **Administración.** `'>of 1 space<'` en el estado de un solo espacio. Es una prueba; no toca código.
- **Servidor, lo hecho FUERA de lo pedido.**
  - «promo code» → «negotiation code» en tres mensajes, y «package» → «bundle» con comillas tipográficas en dos.
  - Es coherente con el glosario (`idiomas-es-en.md:703` y `:712`), y ya no queda ningún «promo code» ni
    «package» en `errores-servidor.ts` ni en `textos/servidor.ts`.
  - **El español quedó intacto.** Las regex y las claves del catálogo no cambiaron: el diff solo toca la parte
    `en`. Armé los tres mensajes desde su fuente (`codigos-repo.ts:358-359`, `paquetes-repo.ts:291-292` y
    `codigos-controller.ts:141`) y para los tres sale `traducirError(m,'es') === m` **true**. En inglés salen
    «The bundle “Pack Centro” on this proposal is a final price and does not accept negotiation codes. Remove the
    bundle…», su par y «That proposal has no negotiation code applied».

## 6 · Español intacto (medido por mí)

**HTML.** Usé un worktree temporal en el scratchpad, ya retirado; antes de quitarlo deshice los enlaces de
`node_modules`. Volqué con `I18N_VOLCAR` / `VOLCAR_HTML` las 11 pruebas de pantallas:

- los siete grupos ya integrados, desde `00815aa3`;
- clientes y operaciones, desde `feat/ingles-operaciones-clientes`;
- Space Eyes, desde `feat/ingles-space-eyes`;
- inventario y arrendadores, desde `feat/ingles-inventario-arrendadores`, con su propia versión de `/razones-sociales`;
- y todo desde HEAD.

`diff -rq` da **0 diferencias en los 397 estados españoles**:

| Grupo | Estados |
|---|---|
| propuestas | 23 |
| compartidos | 6 |
| campañas y finanzas | 56 |
| comercial | 24 |
| catálogos | 15 |
| admin | 28 |
| cuenta y shell | 32 |
| clientes | 25 |
| operaciones | 12 |
| Space Eyes (españoles) | 95 |
| inventario y arrendadores | 81 |

Las únicas diferencias son 2 HTML **ingleses** de Space Eyes, por el «choose» de arriba.

Comparé con la punta de cada rama de lote y no con «`00815aa3` + rama». Es una comparación más exigente: HEAD
reproduce a la vez el español que se aprobó en cada lote y el de la base.

**`DICCIONARIOS.es`.** Volqué el JSON en las cinco referencias y comparé HEAD con la unión de las cuatro bases.
La unión tiene 4892 claves y HEAD 4890:

- **0 valores cambiados**;
- 0 conflictos entre bases;
- 1 clave nueva: `spaceeyes.comun.sin-hablar`;
- 3 retiradas: `arrendadores.entidades.sin-acceso`, `.no-cargar` y `.sub`. Están justificadas en el punto 2.

En `DICCIONARIOS.en` cambian 15 valores, todos los declarados en la Costura 2 (ZIP ×4, this is missing ×2,
choose, Legal entity ×5, cannot ×2, circumstantial evidence).

## 7 · Reglas

- `git diff --name-only 00815aa3..HEAD` no toca ninguno de estos:
  - `middleware.ts`, `nav.ts`, `db/` (schema y migraciones);
  - `app/api`, `lib/contrato-documento.ts`.

  `IDIOMA_INGLES` solo aparece como `process.env.IDIOMA_INGLES = '1'` en las pruebas.
- La marca de la foto: los commits propios de la costura no tocan `space-eyes-actualizacion.ts` ni
  `space-eyes-marca-*`; esos cambios vienen del lote ya aprobado. La prueba «la marca de la foto SI sigue en
  es-MX» sigue pasando.
- No hay ningún `desktop.ini` en el diff. Los `vault/*/desktop.ini` que ya estaban versionados son anteriores.
- No hay dinero en el diccionario: en los 5 archivos nuevos, la búsqueda de `$`+cifra, `MX$`, `US$`, `MXN`,
  `USD` y `peso` solo encuentra `spaceeyes.texto.peso` = «Font weight», que es el grosor de la letra.

## 8 · Pruebas

```
cd apps/web && npm run typecheck                    → limpio (exit 0)
npx vitest run --testTimeout=60000                  → 355 archivos, 6376 pruebas en verde (21.7 s)
```

Coincide con lo que la bóveda dice en `ingles-olas.md`.

**Mutantes.** Los nueve murieron, y en cada uno se restauró el archivo con `git checkout`:

| # | Lote | Mutante | Resultado |
|---|---|---|---|
| M1 | clientes | `CampanasDelCliente.tsx:56` `formatFecha(c.fechaInicio)` sin idioma | **muere**: huella `01/01/2026` (y el barrido de frases) |
| M2 | inventario | `InventarioTabla.tsx:941` `formatMonto(sitio.tarifaMensual)` sin idioma | **muere**: `$ 30,000.00`, `$ 50,000.00`… |
| M3 | Space Eyes | `Programacion.tsx:770` `title="Quitar"` en español | **muere** por el barrido de frases (el ayudante solo mira formatos, por diseño) |
| M4 | Space Eyes | mismo `title={formatFecha('2026-11-02')}` | **muere** por el ayudante: atributo `title` con `02/11/2026` |
| M5 | Space Eyes | `Programacion.tsx:175`: `fechaCorta` siempre es-MX (el M10) | **muere**: mes corto «1 dic», «1 oct» |
| M6 | ayudante | `permitidos` contra el texto entero y no contra el trozo | **muere**: «lo declarado NO perdona una huella vecina» |
| M7 | ayudante | `aria-label` fuera de los atributos | **muere** |
| M8 | ayudante | quitar la huella «mes corto» | **muere**: 3 pruebas del ayudante |
| — | — | árbol final | `git status` limpio (salvo los `desktop.ini` sin seguimiento que ya había) |

---

## Hallazgos

| # | Severidad | Dónde | Escenario |
|---|---|---|---|
| M1 | Menor (preventivo) | `lib/i18n/guardias-ingles.ts:54` | `\d{2}/\d{2}/\d{4}` exige día y mes de dos cifras. `toLocaleDateString('es-MX')` da `2/11/2026` o `12/1/2026` sin relleno, y la guardia no lo ve. Hoy ningún componente usa ese formato numérico por omisión (lo busqué), pero es la forma más común de olvidar el idioma. Arreglo sugerido: `\d{1,2}/\d{1,2}/\d{4}`, porque el inglés de la app nunca es numérico |
| M2 | Menor | `lib/i18n/guardias-ingles.ts:84` | Las etiquetas se cambian por `\n`, así que un importe partido entre elementos (`<span>$</span><span>10,000.00</span>`) ya no se caza; el helper de inventario las cambiaba por espacio y sí lo cazaba. Con `renderToStaticMarkup` el texto de un mismo nodo no se parte, así que el riesgo es bajo |
| M3 | Menor | `guardias-ingles.ts:53` y `:98` | En modo MXN, `US$ 5.00` da un falso positivo, porque `(?<!MX)` deja pasar «US». En modo USD la guardia del dinero se apaga entera, de modo que un `US$` que se coló en inglés (el español de una instancia USD) no se vigila. Ninguna prueba de pantallas rinde una instancia USD |
| M4 | Menor (estilo) | `lib/i18n/textos/arrendadores.ts:703`, `:707` y `:712` | En la tarjeta de razones sociales de Arrendadores conviven el título «Legal entities» y los avisos «Legal entity…» con «{n} without a legal name», «No legal name.» e «invoiced to this legal name» |
| M5 | Menor (estilo) | `arrendadores.ts:872-873` | En la misma tarjeta de licencias quedan «Can’t be earlier…» y «The permit cannot expire…» |
| M6 | Informativo | `clientes.ts:450-451` y `errores-servidor.ts:919` | «this is missing: the address, the owner…»: el singular no concuerda cuando la lista tiene varios elementos |

Nada de esto toca el español ni la regla de dinero, y ningún hallazgo es mayor o crítico.

## Decisiones del dueño

1. **«legal name» frente a «legal entity» en la tarjeta de Arrendadores (M4).** ¿Se queda «legal name» cuando se
   habla del nombre al que se factura («{n} without a legal name») o se pasa todo a «legal entity» («{n} without a
   legal entity», «invoiced to this legal entity»)?
2. **«this is missing» (M6).** ¿Se acepta, o se cambia en el servidor y en clientes a la vez por una forma neutra
   en número, como «To send it for review, it still needs: …» o «Missing before review: …»?
3. **Contracciones dentro de una misma tarjeta (M5).** ¿Se pasa a la forma larga todo el texto de licencias, o se
   acepta la mezcla mientras no haya una regla general?
