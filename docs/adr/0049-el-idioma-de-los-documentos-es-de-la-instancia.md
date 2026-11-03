# ADR 0049: El idioma de los documentos es de la instancia, se elige al crearla y no se cambia

- **Fecha:** 2026-11-03
- **Estado:** Aceptada. La decisión es del dueño (Emiliano), 2026-11-03, como tarea de zona
  ROJA (migración, R3; y firmas/hash de los contratos).
- **Decisión literal del dueño:** «el idioma de papeles y contratos es fijo al crearse la app en
  cada server, pero el idioma de lo demás se debe poder configurar por usuario y navegador».
  Este ADR es la primera mitad. La segunda —la preferencia de idioma de la interfaz por usuario—
  es otra tarea y no toca nada de lo de aquí.
- **Modelo:** [ADR 0048](0048-la-moneda-es-de-la-instancia-y-no-se-cambia.md) (la moneda de la
  instancia). Mismo mecanismo, pieza por pieza.
- **Relacionado:** `vault/03-Frontend/italiano-olas.md` §3 (P4), `docs/i18n/revision-italiano-base.md` §6.

## Contexto

Con el inglés completo y el italiano en camino, la interfaz puede pintarse en tres idiomas. El
contrato de arrendamiento no: `lib/contrato-documento.ts` lo redactaba solo en español, y estaba
bien que así fuera mientras toda instancia era mexicana.

El dato que manda en esta decisión: **el contrato se firma sobre un hash de su texto, y ese texto
se REGENERA para cotejar.** `enviarAFirma` congela `documentoATexto(generarContrato(datos))` y lo
sella con SHA-256; `firmasDeContrato` lo vuelve a generar con los datos de hoy y compara. Si el
idioma del texto dependiera de quien mira, dos personas verían dos documentos con dos hashes, y la
firma de una aparecería «alterada» para la otra. Si dependiera de un ajuste que se pudiera
cambiar, cambiarlo invalidaría de golpe todas las firmas de la instancia sin que nadie tocara un
contrato. Es el mismo argumento que hizo inmutable la moneda.

## Decisión

1. **Tres idiomas de documentos: `es`, `en`, `it`.** Los mismos de `IDIOMAS` (`lib/i18n/idiomas.ts`).
   Otro exige otro ADR (y traducir el contrato).
2. **Es de la INSTANCIA**, como la moneda: `tenants.idioma_documentos`, el mismo para todas sus
   organizaciones. El nombre dice «documentos» a propósito: **no es el idioma de la interfaz**, que
   es de cada persona (cookie, navegador y, con la otra tarea, su preferencia).
3. **Se elige al crear la PRIMERA organización**, por el cuerpo de `POST /api/bootstrap`
   (`idiomaDocumentos: 'es' | 'en' | 'it'`), que el operador pasa con
   `provision-instancia.sh --idioma es|en|it` (o `--idioma=en`). Sin valor, `es`. Las
   organizaciones posteriores heredan; pedir otro en `/api/tenants` es un 400, y en `/api/signup`
   (anónima) mandar el campo es un 400 aunque la instancia esté vacía. `--idioma` sin
   `--bootstrap` para el guion con salida 64. Mayúsculas (`EN`) o etiquetas (`es-MX`) no se
   adivinan: 400 / 64.
4. **No entra por variable de entorno**, por lo mismo que la moneda: el `.env` se edita y se relee.
5. **Inmutable, en la base** (`20261103_idioma_documentos_por_instancia.sql`): columna
   `not null default 'es'`, `CHECK (idioma_documentos in ('es','en','it'))`, un trigger que impide
   el `UPDATE` cuando el valor cambia (reescribir el mismo pasa) y otro que impide que una
   organización nazca en otro idioma que las existentes. Paran a todos los roles. No hay espejo en
   `config_negocio` (nunca hubo ahí una columna de idioma).
6. **Las instancias que ya existen quedan en `es`.** El DEFAULT las deja así; su contrato es el de
   siempre, byte a byte (punto «Firmas»).
7. **Lectura: `idiomaDeLaInstancia()`** (`lib/server/idioma-instancia.ts`), análoga a
   `monedaDeLaInstancia()`: lee la organización más antigua con `qRaw1` (`tenants` no tiene RLS
   fail-closed), cachea en `globalThis` en cuanto hay una organización, no cachea con la base vacía,
   y el alta la recuerda al crear la primera. **Fail-closed:** si la base no contesta, LANZA. Caer
   al español en silencio redactaría el contrato de una instancia inglesa en español, y su hash no
   coincidiría con el firmado: firmas «alteradas» por una caída de la base.
8. **Un solo punto de inyección: `datosContrato()`** (`lib/server/contrato-expediente.ts`) añade
   `idioma` a los datos. Por ahí pasan los cuatro que redactan —la página imprimible, la huella de
   revisión, el congelado al enviar a firma y el cotejo de firmas—, así que ninguno puede
   olvidarlo y redactar en otro idioma que los demás.

## Qué documentos siguen el idioma de la instancia

### Implementado en este ADR

| Papel | Dónde | Qué cambia |
|---|---|---|
| **Contrato de arrendamiento** — texto legal, cláusulas, cantidad con letra, cifras, fechas | `lib/contrato-documento.ts` (`generarContrato`, `numeroALetras`, `fechaEnLetra`, `documentoATexto`) | `es` intacto; `en` e `it` nuevos (ver «Traducción») |
| **Su HTML imprimible / PDF** (`/contrato/[id]`, «Imprimir → Guardar como PDF») | `app/(app)/contrato/[id]/page.tsx` | Encabezados DECLARACIONES/CLÁUSULAS, sellos «FIRMADO ELECTRÓNICAMENTE» / «FIRMA INVALIDADA», su fecha y el aviso de borrador del pie, todo de una tabla única (`encabezadosDocumento`) que también usa el texto sellado |
| **Constancia de firmas** | `components/demo/arrendadores/ConstanciaFirmas.tsx` | **Cambia de regla**: del 02/11 al 03/11 iba en el idioma de la petición; ahora va en el de la instancia, como el contrato que acompaña. Se le añadieron las claves en italiano |
| **Texto congelado en la firma pública** (`/firmar/[token]`) | `components/demo/arrendadores/FirmaPublica.tsx` | Nada que cambiar: muestra `documento_congelado`, que ya nace en el idioma de la instancia. Lo que la rodea (instrucciones, botón) sigue a quien abre el enlace |

Lo que **no** se imprime en la página del contrato —la barra con los datos faltantes, el panel de
firmas, el `title` de los huecos— sigue siendo interfaz y sigue a la persona. Los `faltantes`
del redactor son iguales en todos los idiomas (los traduce la barra).

### Inventario de los demás papeles — DECISIÓN DEL DUEÑO, no implementado

| Papel que sale hacia terceros | Hoy | Propuesta |
|---|---|---|
| Documento imprimible de la propuesta (`/propuesta/[id]`) | Idioma de la petición (quien lo imprime) | **Instancia.** Es lo que se entrega al cliente; que salga en el idioma de quien lo imprime hace que dos vendedores entreguen dos documentos distintos. No lleva hash, así que no hay riesgo de firmas: es solo coherencia |
| Liga pública de la propuesta (`/p/[token]`) | Idioma del navegador del cliente | **Visitante** (como hoy). La lee el cliente en su pantalla; su navegador sabe mejor que nadie en qué idioma lee. Alternativa: instancia, si se quiere que coincida con el PDF |
| Portal del cliente (`/portal/[token]`) | Idioma del navegador del visitante | **Visitante** (como hoy), por lo mismo |
| Comprobante de cobranza / recibo (`components/demo/finanzas/comprobante.ts`) | Idioma de la petición | **Instancia.** Es papel con valor contable que se manda a un tercero |
| Estado de cuenta (CSV) | Idioma de la petición | **Usuario** (como hoy): es una exportación para trabajar, no un papel formal. Si se manda al cliente, **instancia** |
| Correo con la liga de la propuesta (`lib/server/propuesta-correo.ts`) | Solo español | **Instancia**, o el idioma del cliente si algún día se guarda. Hoy el asunto y el cuerpo están fijos en español |
| Correos del sistema (invitación, recuperación) | Español | **Usuario** del destinatario cuando exista la preferencia (la otra tarea) |

## Traducción del contrato al inglés y al italiano

`redactarEnOtroIdioma()` (al final de `lib/contrato-documento.ts`) es una traducción fiel del
español, cláusula por cláusula y párrafo por párrafo: la prueba compara cuántas cláusulas,
incisos y párrafos tiene cada idioma.

> [!danger] REQUIERE REVISIÓN DE UN ABOGADO ANTES DE USARSE CON CLIENTES
> Es el **mismo contrato de derecho mexicano** —RFC, CURP, CFDI, Código Civil, tribunales de la
> ciudad, «Estados Unidos Mexicanos»— escrito en otro idioma. **No** es un contrato adaptado a la
> ley de otro país. Está marcado así en el código, en este ADR y en el runbook del alta: no se
> debería aprovisionar una instancia `en`/`it` para un cliente real hasta que el dueño diga que la
> revisión está hecha.

Decisiones de redacción (todas revisables por el abogado):

- **Partes**: «THE LESSOR / THE LESSEE»; «IL LOCATORE / IL CONDUTTORE». En italiano las partes no
  se interpolan: se escriben con su preposición articulada («al CONDUTTORE», «dello SPAZIO»).
- **Cantidad con letra**: estilo de cheque estadounidense («ONE HUNDRED ONE», «TWENTY-ONE», sin
  «AND»); en italiano en una palabra hasta 999 999 («MILLEDUECENTOTRENTAQUATTRO»), con elisión
  («VENTUNO», «CENTOTTANTA»), «-TRÉ» acentuado al final y apócope ante MILA/MILIONI («VENTUNMILA»).
  Cierran con el código ISO (`MXN`, `USD`): «M.N.» solo tiene sentido en español.
- **Cifras**: «$1,234,567.89 MXN» en inglés; «1.234.567,89 MXN» en italiano. Escritas a mano, como
  el español usa `es-MX` fijo: el texto se sella y no puede depender de la versión de ICU.
- **Fechas**: «August 1, 2026»; «1 agosto 2026». A mano, por lo mismo.
- **Los datos del expediente no se traducen**: nombres, direcciones, la nacionalidad que se capturó
  («mexicana») o el «uso permitido» escrito por una persona salen tal cual.

## Firmas: cómo se coteja

- **Un contrato español se sigue cotejando con su hash original.** El camino `es` de
  `generarContrato` no se tocó, y `contrato-documento-idioma.test.ts` fija los hashes de 14
  documentos (completo, persona moral, todos los huecos, USD, la regla de letra anterior al ADR
  0048, la huella de revisión y las ocho periodicidades) **medidos sobre el código de antes**
  (`6779321d`). Además, las e2e de firmas de `contrato-firmado-editable` y `moneda-instancia`
  corren con este código en instancias `es`.
- **Un contrato en/it** se congela con el texto de su idioma, y `hashParaCotejar` lo regenera en el
  mismo idioma —porque el idioma va en los datos y es inmutable—. La regla vieja de la letra
  («PESOS … M.N.» para todo, ADR 0048) solo se prueba en español: ningún contrato en/it se
  congeló con ella.
- **El idioma es parte de lo firmado**: el mismo contrato en otro idioma tiene otro hash (prueba
  negativa). Por eso es inmutable.
- **Si el abogado cambia la redacción en/it** en una instancia que ya firmó contratos en ese
  idioma, sus firmas aparecerían alteradas. Antes de tocar ese texto en una instancia con
  contratos congelados hay que hacer lo que el ADR 0048 hizo con la letra: conservar la redacción
  anterior y cotejar con ella también (`hashParaCotejar`). Hoy no hay ninguna.
- La e2e `idioma-instancia.e2e.test.ts` lo recorre de punta a punta en una instancia inglesa:
  redacta, congela, firma y coteja en inglés; y si cambia un dato, la firma aparece alterada.

## Consecuencias

- Una instancia puede nacer con contratos en inglés o italiano, y nadie puede cambiarle el idioma
  desde una pantalla, la API o un `UPDATE` descuidado.
- **Cambiar el idioma de una instancia existente** no es un ajuste: es una corrección de datos en
  `docs/datos/` (deshabilitando el trigger a propósito) **y** una decisión sobre los contratos ya
  congelados, que aparecerían alterados. Después hay que reiniciar la aplicación (va cacheado).
- La constancia de firmas cambia de regla: en una instancia española, quien usa la aplicación en
  inglés imprime ahora la constancia **en español**, igual que el contrato. Es la única diferencia
  de HTML en las pruebas de pantallas (medido con `I18N_VOLCAR_TODO` antes/después). La etiqueta
  inglesa de la parte arrendadora en la constancia pasa de «THE LANDLORD» a «THE LESSOR», para
  coincidir con el contrato inglés; la interfaz sigue diciendo «landlord».
- Las semillas (`semilla-desarrollo.sql`, `semillas-e2e.ts`, `semilla-demo.mjs`) insertan
  organizaciones sin idioma → `es`. En una instancia `en`/`it` el trigger de unicidad las rechaza,
  igual que rechaza las de MXN en una instancia USD. Son para instancias españolas de prueba.

## Lo que NO decide

- La preferencia de idioma de la interfaz por usuario (otra tarea).
- Los papeles del inventario de arriba: queda para el dueño.
- Adaptar el contrato a la ley de otro país.

## Revisión independiente

Pendiente: el validador y la revisión legal de las traducciones.
