# Validación independiente · P3 del portugués (papeles pt-BR en una instancia `pt`)

- **Rama:** `feat/portugues-documentos`, diff `e018b1bb..3583c800` (3 commits).
- **Fecha:** 2026-11-05. **Validador:** sesión aparte del ejecutor; no corrigió código.
- **Zona:** ROJA (R3 migración + firmas).

## Veredicto: VERDE (con cuatro observaciones menores, ninguna bloqueante)

Lo que la tarea prometía se cumple y se midió. Ningún hallazgo toca firmas existentes,
aislamiento ni la migración. Las observaciones H1–H4 de abajo son de redacción, de un formato
de pantalla o de defectos heredados.

## Lo que se midió

1. **Los hashes es/en/it se midieron de verdad sobre `e018b1bb`.** Abrí un worktree temporal
   de `e018b1bb` (ya borrado), transpilé su `contrato-documento.ts` y el de HEAD con
   `typescript.transpileModule` y calculé los hashes con los expedientes de
   `contrato-documento.datos-prueba.ts`. **Los 39 hashes fijados** en
   `contrato-documento-portugues.test.ts` (5 expedientes + 8 periodicidades × 3 idiomas)
   **coinciden uno a uno** con los medidos en la base, y los de español coinciden también con
   los que ya fijaba `contrato-documento-idioma.test.ts` (sin cambios en el diff).
   Además, una comparación del **texto** base contra HEAD: **11 055 casos** (es/en/it/sin
   idioma × 4 expedientes × 19 importes, incluidos `null`, 0, 1e6, 999 999 999,99 × 9
   periodicidades × renovable/no × con y sin fecha de firma, más `numeroALetras` en MXN/USD y
   `encabezadosDocumento`): **0 diferencias**.
2. **Cantidad con letra pt-BR**, batería propia de 80 importes: 0, 1, 2, 10–19, 20, 21, 99,
   100, 101, 110, 111, 120, 150, 200–900, 999, 1000, 1001, 1010, 1099, 1100, 1101, 1200, 1201,
   1999, 2000, 2001, 2100, 10 100, 100 001, 100 100, 101 000, 999 999, 1 000 000, 1 000 001,
   1 000 100, 1 000 101, 1 001 000, 1 100 000, 1 200 000, 1 250 500, 2 000 000, 2 000 001,
   2 001 000, 21 000 000, centavos y USD singular/plural. Todo conforme a la norma brasileña:
   «CEM» / «CENTO E UM», «e» entre centenas/decenas/unidades, «MIL» sin «UM», «MIL E CEM» pero
   «MIL CENTO E UM», «UM MILHÃO DE PESOS», «DOIS MILHÕES E MIL», «UM DÓLAR» / «DOIS DÓLARES»,
   «ZERO PESOS». Sin «UM MIL», sin «CEM E», sin «M.N.».
3. **Interruptor `IDIOMA_PORTUGUES`.** Leídos los caminos de escritura y lectura de la
   preferencia (login, código, Google, `servidor.ts`, `resolverIdioma`, «Mi cuenta»): apagado,
   `normalizarIdioma` por omisión y `idiomasActivos()` excluyen `pt`, así que una preferencia
   `pt` guardada se ignora y el PUT da 400; encendido, se guarda y se aplica. `fr`, `pt-BR`,
   `PT` siguen dando 400 en «Mi cuenta» y en el alta, y salida 64 en el aprovisionamiento. El
   alta acepta `pt` con el interruptor apagado **a propósito** (adenda del ADR 0049: los
   papeles son de la instancia, como el italiano). No encontré ningún camino que lo contradiga.
4. **Migración** sobre un Postgres 16 desechable (paquete portátil, **puerto 5439**, no el
   5433), base `val_pt_test` creada con el driver `pg`, con la cadena completa en el orden de
   `ordenar()`: `20261105` va última; aplicada dos veces, `pg_get_constraintdef` de las dos
   restricciones, los dos comentarios de columna y los dos triggers quedan **idénticos**. La
   base admite `pt`, `it` y `null` en `usuarios.idioma_preferido` y rechaza `fr`, `pt-BR` y
   `PT` (23514); una organización nace en `pt` en una instancia vacía; el trigger sigue
   impidiendo cambiar `es → pt`; la vuelta atrás escrita en la cabecera falla con una fila `pt`,
   como dice. Archivo en LF, su sha256 en disco = el del blob de git
   (`4566e765…`), `.gitattributes` lo fija a `eol=lf`; no toca `schema.sql` ni migraciones
   aplicadas.
5. **e2e — corridas, pero NO contra el 5433**, que estaba libre: contra ese Postgres del 5439
   (`DATABASE_URL_TEST`/`_APP`) y el build existente del worktree, tras comprobar que incluye el
   código de P3 (las cadenas del contrato pt y del 400 nuevo están en `.next/server`).
   `idioma-portugues`, `idioma-instancia`, `bootstrap`, `aislamiento` y `migraciones`:
   **99 pasan, 1 omitida, 0 fallan**. No corrí la suite e2e entera.
6. `npm run typecheck` limpio; `npm test`: **420 archivos, 8863 pasan, 1 omitida**.
   `infra/scripts/pruebas-provision.sh`: 52 escenarios, 179 comprobaciones, 0 fallos.
7. **Mutantes propios (6, todos MUERTOS):**
   | # | Mutación | Resultado |
   |---|---|---|
   | M1 | `letrasPortugues`: «E» antes de cualquier grupo, no solo el último | muere (3 pruebas) |
   | M2 | `guardarIdiomaCtrl` con todos los idiomas encendidos | muere (15) |
   | M3 | el alta rechaza `pt` | muere (5) |
   | M4 | `generarContrato` no deriva `pt` a `redactarEnPortugues` | muere (7) |
   | M5 | `CEM` → `CENTO` | muere (4) |
   | M6 | `provision-instancia.sh` acepta `pt-BR` | muere (2 comprobaciones) |
   Contra unitarias y el arnés de aprovisionamiento; **las e2e no se mutaron**.
8. **Lectura de sentido:** el contrato pt completo (persona física y moral, huecos, USD) y las
   169 claves de `papeles-portugues.ts` (constancia, propuesta impresa, `/p`, portal,
   comprobante, correos de propuesta, invitación, restablecer y aviso de contratos). pt-BR
   correcto, «você», «on-line», «tela», «e-mail», «senha». Sin español colado salvo lo indicado
   en H4.

## Hallazgos

**H1 · baja · `apps/web/components/demo/arrendadores/PanelFirmas.tsx:409-414`.**
`importeDeRevision` solo tiene rama para `it`: con la interfaz en `pt` la revisión previa a
enviar a firma muestra «$1,234,567.89 MXN», mientras el contrato pt recita «1.234.567,89 MXN».
Es el mismo defecto que el recorrido italiano del 04/11 corrigió para `it` (en Brasil se lee al
revés). Escenario: `IDIOMA_PORTUGUES=1`, persona con la interfaz en pt revisando un contrato.
No toca firmas ni hashes. Es pantalla, no papel: puede ir al lote de traducción.

**H2 · baja (documentación) · `db/migrations/20261105_idioma_portugues.sql:31-37`.**
La cabecera dice que si la cadena se reaplica entera (`deploy.yml`), la del 03/11 de `tenants`
recrea el CHECK corto «pero ESTA va detrás y la vuelve a abrir». `deploy.yml` ya no existe
(`658c467f`), y medido: **con una organización en `pt`, reaplicar
`20261103_idioma_documentos_por_instancia.sql` falla** (23514) antes de llegar a la de hoy.
Por `migrar.mjs` no es alcanzable (el registro salta las aplicadas). No se puede editar una
migración ya escrita una vez aplicada en algún sitio; si aún no se aplicó en ninguna base
compartida, conviene corregir el comentario antes de publicarla.

**H3 · baja (heredado, no lo introduce P3) · `apps/web/lib/contrato-documento.ts:1254`
(y las ramas es/en/it).** `numeroALetras(1.995)` da «UM PESO 100/100» (redondeo de centavos sin
acarreo) y `1 000 000 000` da « MILHÕES» con el número vacío. Pasa idéntico en es/en/it
desde antes. Arreglarlo en es/en/it cambiaría el hash de los contratos con esos importes, así
que solo se anota.

**H4 · cosmética, pero con fecha de caducidad · texto pt.**
- `apps/web/lib/contrato-documento.ts:1321`: «que o recebe a sua inteira satisfação» → «à sua
  inteira satisfação» (crase).
- `apps/web/lib/i18n/textos/papeles-portugues.ts:49`: «constância de conservação NOM-151» —
  en portugués «constância» es perseverancia (falso amigo); mejor «certificado de conservação».
- `papeles-portugues.ts:177`: «Folio fiscal» queda en español; aceptable como término del SAT.
**Importa cuándo:** el texto del contrato pt entra en el hash. Hoy no hay ningún contrato pt
firmado, así que corregir H4 sale gratis; **después de la primera firma pt** cambiarlo exige
otra regla de cotejo como la de la letra del español. Si se va a retocar, que sea antes de
publicar.

## Lo que no se midió

- La suite e2e completa (solo los cinco archivos de arriba) y las e2e con mutantes.
- El render visual (PDF/HTML) de la constancia, la propuesta y los correos en pt: solo se
  leyeron sus claves y las comprueban las e2e citadas.
- `node scripts/recuentos.mjs` y las cifras de `CLAUDE.md`/MOC.
