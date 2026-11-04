# Supervisión · ADR 0049, el idioma de los documentos es de la instancia

- **Rama:** `feat/idioma-instancia`, worktree `.claude/worktrees/idioma-instancia`
- **Zona:** ROJA (R3 migración · firmas y su hash · aprovisionamiento · alta · correos)
- Supervisor, sin corregir nada. Lo escrito aquí es lo único que tocó.

---

## Segunda pasada · 2026-11-04 · HEAD 873ac6dc (7 commits sobre 9d404205)

### Veredicto: ÁMBAR (aterriza; la deuda queda declarada abajo)

B58 queda cerrada: medí yo las e2e y salen 1206 en verde. El único rojo es el entorno (grants-rol-app no tiene Postgres efímero en esta máquina). En una instancia es+es, los correos son byte a byte los de antes (6 hashes recalculados por mí) y el HTML existente no cambia (volcado completo, diff vacío). B59 y B60 quedan cerradas.

Sigue en ámbar por dos cosas. La primera: no miré la liga, el portal ni el comprobante en un navegador. La segunda, que es la que importa: hoy una instancia en italiano manda el contrato en italiano y la propuesta y los correos en inglés (B67). Eso cae dentro de D13 y es una decisión de alta, no un defecto que impida fusionar.

### Lo que medí

```
npm test (con I18N_VOLCAR_TODO)   -> Test Files 390 passed (390) · Tests 7124 passed (7124)
bash infra/scripts/pruebas-provision.sh -> 47 escenarios · 164 comprobaciones · 0 fallos
provision-instancia.sh --ayuda    -> termina en la línea «SPACES_REGION … OBLIGATORIA» (B60 cerrada)
npm run build                     -> BUILD_ID SVonTAZJZofIvInrFjfV2
PUERTO_E2E=3341 PUERTO_DOBLE_GOOGLE=3342 (el 3312 estaba ocupado)
DATABASE_URL_TEST(_APP) -> spaces_instancia_e2e · npm run test:e2e
 Test Files  1 failed | 84 passed | 1 skipped (86)
      Tests  1 failed | 1206 passed | 21 skipped (1228)   Duration 359.41s
 FAIL grants-rol-app.e2e > si NO existe ninguno de los dos, ABORTA…
   Error: connect ECONNREFUSED 127.0.0.1:55471   (Postgres efimero que esta maquina no levanta: entorno)
(el archivo omitido no aparece en la salida; space-eyes.e2e es el unico con skip condicional: no verificado que sea ese)
```

**Correos en español, byte a byte.** Saqué de 9d404205 `email.ts`, `propuesta-correo.ts` y
`recordatorios-contratos.ts`, y de f434e6f1 `correo-recordatorios.ts`. Comprobé además que
f434e6f1 mueve la plantilla de `app/api/recordatorios/route.ts` sin cambiar ni un carácter (está
en el diff). Ejecutados con Node 24 sobre los datos de `correos-idioma.test.ts`, los 6 hashes
coinciden con los fijados:

```
invitacion          54ca1167…66c4c9   propuestaCompleta 9265cb5e…d78e6
propuestaMinima     16c0222a…cbcea    asunto            5d6b7478…7fb
recordatorios       031208fe…341b     asuntoRecordatorios c6565c5b…4878
```

**Páginas: el volcado.** `I18N_VOLCAR_TODO` con la suite unitaria completa en un árbol temporal en
9d404205 (3037 archivos) y en HEAD (3053). `diff -rq`: **ningún HTML existente cambia**. Las cinco
diferencias son pruebas nuevas: `idioma-documentos-cliente.test.ts`, `papeles-idioma-instancia.test.ts`,
dos casos ADR 0049 en `pantallas-propuestas.test.ts` y uno en `pantallas.test.ts`.
**Ojo, esto es igual en parte por construcción:** `pantallas-propuestas.test.ts` simula que el
idioma de la instancia es el de la cookie (`instancia.idioma ?? cabeceras.cookie ?? 'es'`). Así
que demuestra que «instancia es + persona es» no cambia, no que «instancia es + persona en» siga
igual. Ese caso cambia **a propósito** (el papel sale en español) y lo fija su propia prueba.

**El rojo del TDD sí está en el historial.** Corrí los cinco archivos nuevos en 70dc61ff (árbol
temporal): 5 archivos en rojo y 15 pruebas. En correos y en la propuesta el rojo es por
**aserción** (`expected 'Propuesta comercial: …' to be 'Commercial proposal: …'`,
`… to contain 'PROPUESTA COMERCIAL'`). En `idioma-documentos-cliente`, `papeles-idioma-instancia`
y `pantallas` es `Cannot find module`, que es un rojo débil. B60 tiene su rojo propio (94189547).

**Mutaciones** (en el árbol temporal en 873ac6dc, revertidas):

| Mutante | Resultado |
|---|---|
| `htmlCorreoInvitacion` en/it sin `escaparHtml` | 2 en rojo («los datos van tal cual, y escapados», en y en it) |
| `href` de la propuesta sin `escaparHtml` | 4 en rojo (los 2 hashes del español y los 2 de escapes) |

### Las preguntas del orquestador

- **¿Qué pasa si la base no responde al pintar la liga pública o el portal?** No aparece ningún
  modo de fallo nuevo. El layout raíz ya llamaba a `monedaDeLaInstancia()`, también fail-closed y
  sin `catch`, desde el ADR 0048 (`git show 9d404205:apps/web/app/layout.tsx` línea 90). Con la
  base caída y el proceso en frío, el layout raíz lanza **antes** que el de `/p` o `/portal`, y
  se sirve `app/global-error.tsx`. `login-sin-base.e2e.test.ts:122` comprueba ese caso
  («GET … con la base caida sirve el error global PROPIO»). Las dos páginas necesitan la base
  para sus datos de todos modos. Una vez leída, el idioma queda en caché y no vuelve a consultar.
  El cliente externo ve el error global, no un texto en un idioma equivocado: eso es lo correcto.
- **Escapes en los correos en/it.**
  - `htmlCorreoInvitacion`, la propuesta traducida y los recordatorios traducidos escapan el
    texto **ya interpolado** (`escaparHtml(traducir(…))`), una sola vez.
  - La fecha de vigencia se inserta escapada en un hueco `\u0000FECHA\u0000` que `escaparHtml` no
    toca.
  - `interpolar` (`lib/i18n/diccionario.ts:582-585`) usa un replacer de función, así que un `$&`
    en un nombre no se expande.
  - El asunto quita `\r\n`.
  - Las dos mutaciones de arriba muerden.
- **Correo de restablecer contraseña:** `htmlCorreoReset` no está en el diff de `email.ts`, y
  `app/api/auth/forgot/` tampoco aparece en `git diff --stat`. Sigue en español, fuera de alcance.
- **Archivos protegidos:** el diff 9d404205..HEAD sobre `aislamiento.e2e.test.ts`,
  `servidor-e2e.ts`, `db-e2e.ts`, `db/`, `middleware.ts`, `nav.ts` y `app/api/auth/forgot` está
  vacío.
- **B59:** se cerró documentándolo. `bootstrap-auth.mjs` y `entorno-y-despliegue.md` dicen que es
  la ruta de desarrollo, solo en español y MXN.
- **B60:** cerrada, con `uso()` en `2,58p`.

### Hallazgos nuevos

1. **(MEDIA, producto · B67) Hoy, una instancia en italiano sale en dos idiomas.** El contrato y la
   constancia salen en italiano. La propuesta, su liga, el portal, el comprobante y los tres
   correos caen al **inglés**: `IT_PROPUESTAS`, `IT_CUENTA` e `IT_NOTIFICACIONES` no tienen
   ninguna clave `correo.` (contadas con `awk`), y el commit a354eee0 lo dice («cae al ingles
   hasta el lote L2»). No es un fallo silencioso de datos, pero es un cliente italiano recibiendo
   correos en inglés. Se suma a D13 (no dar de alta `it` todavía).
2. **(BAJA · B68) El `<html lang>` de `/p` y `/portal` sigue el idioma de la petición**, mientras el
   contenido va en el de la instancia. Lo declaran los propios layouts. Afecta a lectores de
   pantalla y traductores automáticos, no a lo que se ve.

### No verificado

- La liga, el portal y el comprobante en un navegador real.
- La calidad de las traducciones.

---

## Primera pasada · 2026-11-03 · HEAD 9d404205 — ÁMBAR

> Este informe se escribió el 03/11 en el worktree `integra-ingles` (`integra/idiomas`) y se quedó
> allí **sin commitear**. Ese worktree pasó a usarlo otro agente, y esta copia es la que vale.

**Veredicto:** ÁMBAR, por cuatro motivos:
- las e2e no las corrí (→ B58);
- el rojo de 7d4b5290 era solo `Cannot find module`;
- no miré la página del contrato en un navegador;
- `bootstrap-auth.mjs` no podía elegir idioma (→ B59).

**Medido:**
- typecheck limpio;
- 7094 unitarias en verde;
- arnés de aprovisionamiento 46/160/0;
- recuentos 159 endpoints / 66 tablas / 124 migraciones / ADR 0049 / 115 notas / 1642 enlaces /
  3 rotos / 0 huérfanas.

**Hashes del contrato en español:** los 14 fijados en `contrato-documento-idioma.test.ts`,
recalculados por mí con `git show 6779321d:apps/web/lib/contrato-documento.ts`, son idénticos
(completo fc94ef81…, otro a62cf977…, vacio 3855015c…, usd d19db10d…, usdPesosSiempre 84b04613…,
huella 48116cd6… y las 8 periodicidades).

**Mutaciones (unitarias):**
- `ENCABEZADOS.es.clausulas` cambiado → 16/67 en rojo;
- `idiomaDeLaInstancia` fail-open → 1 en rojo;
- `/api/signup` acepta `idiomaDocumentos` → 2 en rojo.

**Migración:**
- idempotente, transaccional, `default 'es'`, CHECK y los dos triggers;
- `tenants` no tiene RLS: el bucle de `20260720_hard1_rls_todas_tablas.sql` solo cubre tablas
  con `tenant_id`;
- no le afecta `ANTES_DE`.

**`PUERTO_E2E`:** ya existía en `servidor-e2e.ts:25`, con un diff vacío.
**Caché:** por proceso, sin riesgo entre organizaciones mientras el trigger de unicidad exista.
**LESSOR:** una sola línea del snapshot.
