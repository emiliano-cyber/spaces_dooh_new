# Validación independiente · «pesos» en redacción neutra

- **Rama:** `feat/pesos-neutral` · commit `0aa75db9` sobre `integra/ingles` (`85a8ee67`)
- **Fecha:** 2026-11-02
- **Validador:** sesión independiente; no corrigió nada. Solo escribió este informe, que queda sin commitear.

## Veredicto: ÁMBAR, con una corrección de redacción

El cambio hace lo que se pidió. Se reescribieron exactamente cuatro claves, en los dos idiomas. Fuera de ellas el español no cambió, y está medido en los 124 estados. No se tocó nada prohibido. Las guardias nuevas cazan los mutantes que se pidieron.

Lo que impide el VERDE es una frase: «al centavo» / «to the cent». No es falsa, pero cambia el sentido original. Además choca con «sin centavos», que sale en la misma pantalla. Hay también unos cuantos hallazgos menores, en las guardias y en la documentación.

---

## Hallazgos

| # | Sev. | Dónde | Qué |
|---|---|---|---|
| H1 | **Media** | `apps/web/lib/i18n/textos/catalogos.ts:71`, `:117` (es) · `:320`, `:366` (en) | «al centavo» / «cuadra al centavo» / «to the cent» / «adds up to the cent». Ver §2. |
| H2 | Baja | `apps/web/lib/i18n/textos/costura.test.ts:114` | La guardia no ve códigos de moneda: «MXN» o «USD» en un diccionario sobreviven (mutante M7). Además dará un falso positivo con «peso» en el sentido de *weight* (`components/demo/space-eyes/AjustarTexto.tsx:552`, «Peso de la fuente»), en cuanto se traduzca Space Eyes. |
| H3 | Baja | `apps/web/lib/i18n/textos/costura.test.ts:129` y `:138` · `vault/03-Frontend/idiomas-es-en.md:1135` | La prueba de paridad con el servidor solo cubre UNA clave hoy (`compartidos.cifra.mayor`). La excepción `propuestas.calc.` no excluye nada. Y «nueve claves» de la calculadora no se reproduce: con el método de la propia prueba salen 6 que llegan al traductor del servidor, y 5 distintas. |
| H4 | Baja | `docs/Registro_Cambios.md:23` | Dice «se comparó el HTML de **todas** las pantallas traducidas». Lo que se comparó son los 124 estados de las cinco pruebas de pantallas. La bóveda lo dice bien. |
| H5 | Info | `apps/web/lib/i18n/textos/compartidos.ts:313-314` | En inglés quedan dos estilos pegados: «It cannot be less than {n}» junto a «Must not be greater than {n}». No hay patrón del servidor para «menor que», así que no es un error. Es estética. |
| H6 | Info (preexistente) | `apps/web/lib/i18n/errores-servidor.ts` | El motivo `precio-entero`, cuando lo rechaza el **servidor**, llega en español también en inglés: no tiene entrada en el catálogo, ni antes ni ahora. La bóveda lo declara. No es una regresión, y es trabajo de la ola 4. |

---

## Evidencia por punto

### 1 · Inventario

Repetí el grep de `\bpesos?\b|M\.N\.|\bMXN\b|mexican[oa]s?|d[oó]lar|dollar` en `apps/web/**/*.ts(x)`, sin `node_modules` ni `.next`, sin pruebas y sin líneas de comentario. Salen 101 líneas. Ninguna es texto de interfaz que dé por hecho el peso:

- **Nombres de variable o función:** `const pesos = formatMonto` y similares. Todos formatean con `simboloMoneda()` o `formatearDinero`. Por ejemplo `lib/tarifa-calculada.ts:174` y `lib/data/reportes.ts:1901`. También entran aquí `repartirPaquete(pesos…)`, el `peso` de orden de `inicio/indicadores.ts:295` y el `{peso}` de `GestionPaquetes.tsx:218`.
- **Legítimos, porque nombran la moneda a partir de la moneda:**
  - `lib/i18n/dinero.ts:137-138`, con `nombreMoneda()`;
  - `errores-servidor.ts:73` y `moneda-alta.ts:21`, «La moneda debe ser MXN o USD»;
  - los `coalesce(…,'MXN')` de los repos;
  - la semilla.
- **Prohibidos, y SIN tocar:**
  - `lib/contrato-documento.ts:163`, con `PESOS`/`M.N.` y las reglas `pesos-siempre` y hash;
  - `lib/server/recibos-cfe/casos.ts`.
- **Comentarios JSX:** `ContratoWizard.tsx:550-556` y `administracion/page.tsx:1033`.

En los diccionarios ya no queda ningún «peso», «M.N.» ni «dólar»: lo comprueba la guardia, y yo lo confirmé con un volcado JSON. El diff no toca `contrato-documento.ts`, ni `recibos-cfe`, ni migraciones, ni la semilla. Tampoco el comentario de `paquete.ts`, que sigue diciendo «pesos enteros», como está permitido. El único comentario que cambia es la cabecera de `catalogos.ts`, que era uno de los tres menores encargados.

No es de moneda, así que queda fuera de alcance, pero lo anoto: `compartidos.cifra.punto-decimal` dice «En México el punto es decimal». Es una afirmación de formato de número, y la bóveda la excluye a propósito.

### 2 · La redacción nueva, en su contexto

- **«Precio del conjunto (cantidad entera, sin centavos)» / «Price for the set (whole amount, no cents)»:** correcto y neutro.
- **Motivo «tiene que ser una cantidad entera: el reparto … no admite centavos» / «a whole amount: … does not allow cents»:** correcto. El literal de `lib/paquete.ts:281` y la clave cambiaron juntos.
- **«al centavo» (H1).** Así trabaja el reparto en `lib/paquete.ts`:
  - `repartirPaquete` es entero de punta a punta: `T = Math.round(...)` (`:126`), `Math.floor` por línea y el resto de uno en uno.
  - `motivoPaqueteInvalido` rechaza los precios con centavos.
  - Las partes son unidades enteras y Σ partes = precio exacto.
  - Por eso «cuadra al centavo» no es falso: la diferencia es 0, también en centavos.
  - Pero no conserva el significado. «Al peso» decía «exacto en unidades enteras»; «al centavo» sugiere que las partes se calculan con precisión de centavo, y no es así.
  - Además, en la misma pantalla (estado `catalogos/02-es.html`) conviven «(cantidad entera, sin centavos)» y «— cuadra al centavo» a pocas líneas. Un lector se pregunta cuál de las dos es la buena.
  - **Propuesta:**
    - `reparto.cuadra`: «— cuadra exacto» / «— adds up exactly».
    - `lista.explicacion.peso`: «sin diferencias» / «exactly»: «…da el precio del paquete **sin diferencias**», «…add up to the bundle price **exactly**».
    - O, si se quiere conservar la idea de unidad: «sin un centavo de diferencia» / «to the last cent», que es neutro y verdadero.

### 3 · El español, intacto fuera de esas claves

- **Volcado.** Vertí el HTML español de las cinco pruebas de pantallas con HEAD y con el código de `85a8ee67`:
  - método: `git checkout 85a8ee67 -- apps/web`, volcar y `git checkout HEAD -- apps/web`;
  - variables: `I18N_VOLCAR` en cuatro de ellas y `VOLCAR_HTML` en comercial;
  - **124 estados** en total: 56 de campañas y finanzas, 15 de catálogos, 6 de compartidos, 23 de propuestas y 24 de comercial.
- **Resultado de `diff -rq`:** solo difieren `catalogos/01`, `02` y `03`. En ellos solo cambian «al peso → al centavo», «(pesos enteros) → (cantidad entera, sin centavos)» y «cuadra al peso → cuadra al centavo». Comercial y las demás, idénticas.
- **`DICCIONARIOS.es`** (volcado JSON ordenado, antes contra después): cambian **solo 4 claves**:
  - `catalogos.motivo.paquete.precio-entero`
  - `catalogos.paquetes.lista.explicacion.peso`
  - `catalogos.paquetes.precio`
  - `catalogos.paquetes.reparto.cuadra`
- **`DICCIONARIOS.en`:** cambian esas mismas 4 y `compartidos.cifra.mayor`. No falta ni sobra ninguna clave.

### 4 · Las pruebas que se tocaron

Todas son consecuencia directa del texto autorizado:

- **`pantallas-catalogos.test.ts`:** las tres frases nuevas, literales completos.
- **Las dos instantáneas:** las cuatro claves y `cifra.mayor` en inglés.
- **`paquete.test.ts:167` y `paquetes-controller.test.ts:95`:** pasan de `/entero/i` a `/cantidad entera/i`. Eso no relaja la prueba, la **endurece**: el viejo `/entero/` también aceptaba «entero de pesos». El mutante M5 lo confirma: devolver el literal viejo hace caer las dos.

El título de la prueba de `paquete.test.ts` sigue diciendo «en pesos enteros». Es un nombre de prueba, que está fuera de alcance.

### 5 · Las guardias nuevas de `costura.test.ts`

**«Ningún texto da por hecho el peso»** (`:106-118`). Caza «pesos» en `es`, «whole pesos» en `en` y «to the peso» en `en` (M1, M2 y M6). No hay falsos positivos hoy: pasa en verde. Tiene dos puntos ciegos, los de H2:

- Un código de moneda no se ve: con «(whole MXN)» solo cae la instantánea (M7).
- «peso» en el sentido de *weight* va a dar un falso positivo.

**«El mismo español que el servidor, el mismo inglés»** (`:120-145`):

- Caza «It cannot be greater than» (M4).
- Su cobertura real es **una sola clave**. Lo medí recorriendo el diccionario con el mismo filtro.
- Hay seis claves de calculadora que el servidor reconoce. Cinco tienen un inglés distinto: `roadblock-todos`, `horas`, `roadblock-libres` y las dos `pocos-libres`. `rango-espacios` coincide.
- La excepción `propuestas.calc.` no excluye nada: ninguna de esas claves la reconoce `traducirError`.
- El «nueve» del comentario y de la bóveda no se reproduce (H3).
- La excepción en sí está bien justificada y lleva la condición de cuándo se quita.

### 6 · Los tres menores de catálogos

- **Las seis claves `compartidos.cifra.*` atadas a su literal:** `vacia`, `enteras`, `max-decimales.otros`, `grande`, `negativo` y `mayor`, en `catalogos.fuentes.test.ts:203-210`. Con las siete que ya estaban se cubren las 13 claves de `cifra.*`. El mutante M3, «No puede ser negativa» en `lib/captura-cifra.ts:139`, cae.
- **«Must not be greater than» unificado:** `compartidos.ts:314` coincide con `errores-servidor.ts:677`.
- **La cabecera de `catalogos.ts`:** dice «deactivate / Deactivated», y eso es lo que usan las claves en inglés (`catalogos.comun.dar-de-baja`, `paquetes.desactivar`). No queda ningún «retire» en los diccionarios.

### 7 · Pruebas

**Typecheck y suite completa:**

```
cd apps/web && npm run typecheck   →  tsc --noEmit, limpio
cd apps/web && npm test            →  Test Files 338 passed (338) · Tests 5129 passed (5129)
```

No corrí las e2e ni `next start`, por instrucción.

**Mutantes.** Los corrí contra los 8 archivos que tocan esto: costura, catalogos, catalogos.fuentes, compartidos, paquete, paquetes-controller, pantallas-catalogos y captura-cifra. La base da 188 en verde.

| Mutante | Resultado |
|---|---|
| M1 · `es` vuelve a «(pesos enteros)» | **Muere** (3): pantallas-catalogos, instantánea es, guardia costura |
| M2 · `en` «(whole pesos)» | **Muere** (2): instantánea en, guardia costura |
| M3 · literal «No puede ser negativa» | **Muere** (1): catalogos.fuentes «reproduce los literales» |
| M4 · `en` vuelve a «It cannot be greater than» | **Muere** (2): instantánea, paridad con el servidor |
| M5 · literal de `paquete.ts` vuelve a «numero entero de pesos» | **Muere** (3): catalogos.fuentes, paquete, paquetes-controller |
| M6 · `en` «to the peso» | **Muere** (2): instantánea, guardia costura |
| M7 · `en` «(whole MXN)» | Solo lo caza la instantánea; **la guardia lo deja pasar** (H2) |

Con la suite completa en paralelo aparecieron fallos ajenos al mutante: `CampanasNav`, `derive.formato-moneda`, `tenant-activo-cookie` y varios `pantallas-*`. Aislados pasan. Lo atribuyo a la carga de la máquina, compartida con otros agentes. Por eso la tabla usa la corrida dirigida.

Cada mutante se restauró con `git checkout -- .`. El árbol queda limpio salvo este informe.

### 8 · Documentación

- **`docs/Registro_Cambios.md`:** tiene la entrada del 02/11, en lenguaje llano, con las cuatro frases y la exclusión del contrato y la CFE. La única pega es H4.
- **Bóveda:**
  - `vault/03-Frontend/idiomas-es-en.md` §7 lleva la tabla de claves, lo que no se tocó y lo que se midió (los 124 estados coinciden con mi medición), con `actualizado: 2026-11-02`.
  - `vault/03-Frontend/ingles-olas.md` lleva el tablero de la ola al día.
  - La única pega es el «nueve» de H3.

---

## Para que decida el dueño

1. **La redacción de «al peso»** (H1). Hay tres opciones:
   - «cuadra exacto» / «adds up exactly», más «sin diferencias» / «exactly» en la explicación;
   - «sin un centavo de diferencia» / «to the last cent»;
   - dejar «al centavo», que es verdadero pero choca con «sin centavos» en la misma pantalla.

   Es texto en español, así que lo decide él.
2. **Si la guardia debe prohibir también los códigos MXN y USD en los diccionarios** (H2). Hoy ningún diccionario los lleva; los nombres salen de `nombreMoneda()`. Si se amplía, habrá que prever el caso de «peso» en el sentido de *weight* cuando se traduzca Space Eyes.

---

## Segunda pasada (2026-11-02) · commit `9e890d72` sobre `0aa75db9`

### Veredicto: VERDE

H1 a H5 quedaron resueltos tal como decidió el orquestador. El español cambia solo en las 4 claves autorizadas, y lo comprobé de forma mecánica. La guardia ya no tiene los dos puntos ciegos: atrapa MXN y USD, y no señala el «peso» que no es dinero. Typecheck limpio y 5131 unitarias en verde.

### 1 · Cada hallazgo

- **H1 · resuelto.** `catalogos.ts:71`, `:117`, `:320` y `:366`. Así queda cada frase, completa:
  - Español: «…y la suma de las partes da el precio del paquete **con exactitud**.» y «Suma de las partes **— cuadra exacto**».
  - Inglés: «…the shares add up to the bundle price **exactly**.» y «Sum of the shares **— adds up exactly**».
  - Los dos idiomas se leen bien. La razón del autor para no poner «exacto» en la explicación se sostiene: el hueco cierra la frase, y «…el precio del paquete exacto» se leería como un adjetivo del precio o del paquete. «Con exactitud» modifica a «da», que es lo que se quiere decir.
  - Ya no choca con «(cantidad entera, sin centavos)». Y describe bien `repartirPaquete`, que reparte en unidades enteras y cuya suma da el precio exacto.
- **H2 · resuelto.** `costura.test.ts:110-131`:
  - La guardia exige además `\b(MXN|USD)\b`, en mayúsculas y como palabra suelta.
  - Las excepciones son frases enteras y cada una lleva su motivo: «peso de la fuente» y «peso visual».
  - Una metaprueba (`:139`) impide que una excepción contenga «pesos», «centav», «precio», «monto» o «importe».
- **H3 · resuelto.** Medí la paridad por mi cuenta, recorriendo el diccionario con `traducirError` y los huecos rellenos con «1000». Salen **19** textos que el servidor reconoce: 7 con hueco y 12 fijos. **10** coinciden. **9** divergen: 5 con hueco y 4 fijos.
  - Esos 9 son exactamente los de `CALCULADORA_DIVERGE_OLA_4` (`:149`): `propuestas.calc.prima.no-puede`, `sin-loop`, `rango-prima`, `cero-spots`, `roadblock-todos`, `horas`, `roadblock-libres` y las dos `pocos-libres`.
  - La prueba ahora vigila los 10 que coinciden, y exige que sean al menos 10 (`:176`).
  - Hay otra prueba que obliga a sacar de la lista cada clave que se unifique.
- **H4 · resuelto.** `docs/Registro_Cambios.md` ya dice «124 estados de pantalla» y nombra las pruebas. Ya no dice «todas las pantallas».
- **H5 · resuelto.** `compartidos.cifra.menor` dice «Must not be less than {n}». La bóveda aclara que es por estilo: el servidor no manda «No puede ser menor que».
- **H6 · sigue igual**, como estaba previsto. Es informativo, ya existía y corresponde a la ola 4.

### 2 · El español, comparado de forma mecánica

- **El método:**
  - HEAD (`9e890d72`) contra `85a8ee67`, con `git checkout 85a8ee67 -- apps/web`, volcado y `git checkout HEAD -- apps/web`.
  - El HTML español de las cinco pruebas de pantallas, con `I18N_VOLCAR` en cuatro y `VOLCAR_HTML` en comercial: **124 estados**.
  - Además, `DICCIONARIOS` volcado a JSON ordenado.
- **HTML:** solo difieren `catalogos/01`, `02` y `03`. Las únicas líneas nuevas son las tres frases de arriba y «Precio del conjunto (cantidad entera, sin centavos)».
- **`DICCIONARIOS.es`:** cambian **exactamente 4 claves**: `motivo.paquete.precio-entero`, `lista.explicacion.peso`, `paquetes.precio` y `reparto.cuadra`.
- **`DICCIONARIOS.en`:** cambian esas 4, más `compartidos.cifra.mayor` y `compartidos.cifra.menor`. No se añade ni se pierde ninguna clave.

### 3 · La guardia: mutantes

Corrí los mutantes solo contra `costura.test.ts`, que en la base da 11 en verde.

| Mutante | Esperado | Resultado |
|---|---|---|
| M7 · `en` «(whole MXN)» | cae | **cae**: «ningún texto da por hecho la moneda» |
| M8 · `en` «Price for the set in USD» | cae | **cae** |
| M9 · clave nueva `es` «Peso de la fuente» / `en` «Font weight» | no cae | **no cae**: 11 en verde |
| M10 · `es` «Peso visual del botón» | no cae | **no cae** |
| M11 · `es` «Peso de la fuente: 100 pesos» (la excepción no tapa) | cae | **cae** |
| M12 · `es` «cuadra al peso» | cae | **cae** |
| M4 · `en` «It cannot be greater than {n}» | cae | **cae**: paridad con el servidor |
| M14 · `cero-spots` en inglés, igualado al del servidor | cae | **cae**: «las excepciones de la calculadora siguen divergiendo» señala `cero-spots` |

Queda un detalle sin consecuencia práctica: la excepción se quita con `new RegExp(frase, 'gi')`, sin límite de palabra. Por eso «contrapeso visual» también se borraría. No encubre dinero, y la metaprueba sigue vigilando. Los símbolos `US$` y `MX$` no entran en esta guardia, pero ya los cubre la guardia anterior de «ningún diccionario lleva dinero» (§7 de la bóveda).

### 4 · Pruebas

```
cd apps/web && npm run typecheck   →  tsc --noEmit, limpio
cd apps/web && npm test            →  Test Files 338 passed (338) · Tests 5131 passed (5131)
```

La suite completa pasó sin `--testTimeout`. Son 5131, dos más que en la primera pasada: las dos pruebas nuevas de `costura`. Cada mutante se restauró con `git checkout -- .`, y no usé `git stash`. El árbol queda limpio salvo este informe, modificado y sin commitear.

### Para que decida el dueño

Nada nuevo. Las dos preguntas de la primera pasada las resolvió el orquestador: «exacto» y la guardia con MXN y USD.
