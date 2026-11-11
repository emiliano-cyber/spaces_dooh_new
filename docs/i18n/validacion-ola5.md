# Validación · ola 5 (cierre) de la versión en inglés

- **Rama:** `feat/ingles-ola5` (`5021af01`), contra la base `008bb1b9`.
- **Fecha:** 2026-11-03. Validador independiente: no recibió el razonamiento del traductor.
- **Veredicto: VERDE** (con tres menores que no bloquean).

## 1 · Español idéntico (medido)

- **HTML.** Se volcó el español de las 15 pruebas de pantallas (`I18N_VOLCAR` / `VOLCAR_HTML`), cada una en su carpeta, en la base y en la rama. La base fue el worktree `integra-ingles` (`f4eaa365`), que respecto a `008bb1b9` solo cambia `lib/test/db-e2e.ts` y una nota de la bóveda.
  - `diff -rq`: **0 diferencias en los 550 estados de la base**. Solo hay 5 archivos nuevos, los estados que añade la ola: `comercial/ficha…fijo`, `compartidos/06` y `07`, `cuenta-shell/32` y `propuestas/23`.
  - Los 5 nuevos se revisaron leyendo el código. La rama española de cada cambio es el código viejo, literal:
    - `idioma === 'es'` devuelve el dato crudo en propuestas y en `/p/[id]`;
    - el `fijo` en español es el mismo dato que se pintaba;
    - «Minimizar {titulo}» y «Cerrar menú» son los literales de antes.
- **`DICCIONARIOS`.** Volcado con `jiti` en la base y en la rama.
  - `es`: 5510 → 5521, con **0 valores cambiados**, 11 claves nuevas y 0 retiradas.
  - `en`: 11 valores cambiados (arrendadores ×7, licencias, captación ×2 y energía) y las mismas 11 claves nuevas. Cuadra con lo que dice `revision-ola5.md` §4.

## 2 · Corrección de lo nuevo

- **`lib/i18n/errores-acceso.ts`.** Correcto.
  - `git diff 008bb1b9..HEAD -- app/api middleware.ts lib/server lib/auth-real.ts` sale vacío: las rutas de acceso no se tocaron.
  - La traducción es 1 a 1 sobre el texto exacto. No añade ni quita información.
  - Contraseña mala y correo inexistente siguen dando el mismo mensaje en los dos idiomas: el 401 es único en `app/api/auth/login/route.ts:82`.
  - «Esta cuenta entra con Google» solo lo emite el servidor después de verificar la contraseña (`route.ts:86-124`), así que traducirlo no abre una enumeración nueva.
  - En español devuelve el mensaje tal cual (`errores-acceso.ts:69`).
  - Lo desconocido pasa a `traducirError` y, si este tampoco lo conoce, queda igual.
- **Menor A, sin traducir.** `'Cuerpo inválido'` (`login/route.ts:37`) y `'Falta el enlace de restablecimiento.'` (`reset/route.ts:42`) siguen en español en inglés. La interfaz no los provoca: siempre manda el cuerpo y el token.
- **`guardias-ingles.ts`.** Los cambios no ocultan huellas reales, comprobado con sondas:
  - `Total: $ 10.00` y `<b>IVA</b>$10.00` siguen siendo huella;
  - `$\n10` partido es huella;
  - `US$ 5.00` en una instancia USD es huella.
  - El único caso que ahora se escapa es un `$` pegado a dos mayúsculas («TOTAL$ 10»). Es teórico: ninguna pantalla lo escribe así.
  - La fecha nueva `\d{1,2}/\d{1,2}/aa(aa)` también caza trozos como `v0.12/5/26`. Es un falso positivo posible, pero la suite entera está en verde.
- **`CardColapsable`.** «Collapse {titulo}» / «Expand {titulo}». Sin más literales: `grep` de «Minimizar», «Expandir» y «Cerrar menú» en `components/` y `app/` sale vacío.
- **Pipeline (`PipelineView.tsx:309-316`).** Correcto en sentido: «Nov 3».
  - **Observación previa, no regresión.** `fechasPipeline` pone `confirmada = c.fechaInicio`. Si viene como fecha sola (`2026-11-03`), `new Date()` la toma en UTC y en México se pinta el día anterior. Pasa igual en español (`formatFechaLocal`) y en inglés (`formatearFecha` sin `timeZone`), así que los dos idiomas coinciden.
  - La prueba usa `T12:00:00`, que lo esquiva.
- **`fijo` / `fija` (`SiteFicha.tsx:126-131`).** Correcto. En español da «fijo», el mismo dato; en inglés, «static».
- **`/p/[token]` (`p/[id]/page.tsx:252`).** Correcto en inglés («Billboard», «Digital screen»).
  - Un tipo de medio desconocido cae a `etiquetaTipoMedio`, que da una etiqueta española en mayúscula inicial. Es aceptable: es el camino de reserva.
- **Periodicidad (`propuestas/page.tsx:1701-1705`).** «monthly», «every two weeks» (catorcenal) y «twice a month» (quincenal). Correcto.
- **Textos.** «it still needs: …» concuerda con uno o con varios faltantes. «Check each row against the bill and confirm it» también vale con un archivo y varios renglones. *legal entity* es coherente en toda la tarjeta.

## 3 · Mutantes (cada uno restaurado; `git status` limpio al final)

| # | Mutante | Resultado |
|---|---|---|
| m01 | clave de «Correo o contraseña inválidos» rota en `EXACTOS` | muere (errores-acceso, 1 cae) |
| m02 | `Espera (\d+)s\.$` → `(\d)s` en el límite corto | **SOBREVIVE** (menor B) |
| m03 | catch del login vuelve a `e.message` | muere (prueba de fuente) |
| m04 | guardia `\$\s*\d` → `\$ ?\d` (M2) | muere |
| m05 | lookbehind `(?<![A-Z]{2})` → `(?<!MX)` (M3) | muere |
| m06 | fecha `\d{1,2}…` → `\d{2}/\d{2}/\d{4}` (M1) | muere (3 caen) |
| m07 | quitar el `continue` de la huella US$ fuera de USD | muere |
| m08 | huella US$ que nunca casa | muere |
| m09 | `CardColapsable` vuelve al literal «Minimizar/Expandir» | muere (2 caen) |
| m10 | `PipelineView` deja `x.fecha` (dd/mm) en inglés | muere |
| m11 | quitar `fijo` del mapa `EXHIBICION` | muere |
| m12 | `/p/[id]` pinta el código crudo en inglés | muere |
| m13 | alta de propuesta con la periodicidad cruda en inglés | muere (1 cae) |
| m14 | `Sidebar` vuelve a `aria-label="Cerrar menú"` | muere (2 caen) |
| m15 | `errores-servidor` vuelve a «this is missing» | muere |

**Menor B.** Los casos del límite corto solo usan esperas de una cifra («5s», «3s»). Un `\d` en lugar de `\d+` no lo ve ninguna prueba. Basta un caso con «Espera 45s.».

## 4 · Cifras

- `npm run typecheck`: limpio.
- `npx vitest run --testTimeout=60000`: **6697 de 6697 en 366 archivos**, verde.
- `npm run build`: exit 0. Solo avisos `react-hooks/exhaustive-deps` ya existentes; ninguno en archivos de la ola salvo `SiteFicha.tsx:1288`, que no es de esta ola.

## 5 · Navegador (parcial)

- Se levantó `next start -p 3430` con `IDIOMA_INGLES=1` y la base `spaces_ola5`, y se abrió `/login` con la cookie `spaces_idioma=en`.
  - Con un correo inexistente y la contraseña mala sale **«Incorrect email or password»**.
- El servidor se paró al terminar y el 3430 quedó libre.
- **No se pudo comprobar en el navegador:**
  - la ficha de campaña y la tarjeta plegable, porque no tengo la contraseña de la dueña de `spaces_ola5`. Las cubren los estados de las pruebas de pantallas (m09, m10);
  - el mensaje «solo Google» con la credencial buena.

## 6 · Menores (no bloquean)

- **A.** Dos mensajes de las rutas de acceso siguen en español en inglés: `Cuerpo inválido` y `Falta el enlace de restablecimiento.` La interfaz no los alcanza.
- **B.** El mutante m02 sobrevive: falta un caso con una espera de dos cifras en el límite corto.
- **C.** Desfase de un día con `fechaInicio` sin hora en el pipeline. Es previo a esta ola y pasa igual en los dos idiomas.
