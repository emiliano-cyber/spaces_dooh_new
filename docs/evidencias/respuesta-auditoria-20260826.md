# Respuesta a la auditoría del 2026-08-26

**Auditoría:** caja negra sobre `space-os.io/spaces-dooh/` (producción), sin acceso
al repositorio. Su propio informe marca todas las causas como
*«HIPÓTESIS / POR VERIFICAR»*.

**Esta respuesta:** cada hallazgo verificado **contra el código**, con
`archivo:línea`. Lo que reproduce se arregló; lo que no reproduce se dice, con la
evidencia que lo desmiente y con qué haría falta para cerrarlo del todo.

> [!important] Un aviso sobre el alcance de esta verificación
> Se verificó contra la rama `feat/servidor-padre-instancias`. **Producción corre
> código anterior.** Para los tres hallazgos que no reproducen eso no cambia nada
> —el código en cuestión es muy anterior al último despliegue—, pero conviene
> tenerlo presente antes de dar ninguno por cerrado en el servidor.

---

## Resumen

| | Hallazgo | Veredicto | Estado |
|---|---|---|---|
| SEC-01 🔴 | CSRF no se valida | **No reproduce** | Prueba de regresión añadida |
| SEC-02 🔴 | Cambio de correo/clave sin reautenticación | **No reproduce** | El servidor la exige |
| SEC-03 🟠 | Autorización por rol en `/api/estado/` | **Refutado** | Era su prioridad #1 |
| SEC-04 🟠 | Sin CSP ni Permissions-Policy | **Cierto** | Corregido |
| DATA-01 🟠 | Pantalla de CDMX guardada en Perú | **Cierto** | Corregido en parte — ver abajo |
| VAL-01 🟠 | Validaciones ausentes en la API | **Cierto, y peor** | Corregido |
| CRUD-01 🟠 | No existe DELETE | **Cierto** | En curso |
| VAL-02 🟡 | Nombre de 5 000 caracteres | **Cierto** | Corregido |
| VAL-03 🟡 | Duplicados sin aviso | **Cierto** | Corregido (migración sin aplicar) |
| UX-01 🟡 | Fecha fin anterior a la de inicio | **Cierto, y había dos más** | Corregido |
| CFG-01 🟡 | Plazos de cobranza que no gobiernan nada | **Cierto** | Corregido |
| UI-01 🔵 | `<title>` «Spaces — Demo» | **Cierto** | Corregido |
| SEC-05 🔵 | Registros QA en producción | **Malentendido** | Ver abajo |

---

## Los tres que no se sostienen

### SEC-01 · el CSRF sí se exige

Se escribió la llamada exacta del informe y se ejecutó
(`apps/web/lib/test/csrf.e2e.test.ts`, commit `a21eea2`):

| Petición | Resultado |
|---|---|
| con sesión y **sin** cabecera CSRF | **403**, no crea nada |
| con sesión y con la cabecera | 201, crea uno |
| **sin** sesión | **401**, no crea nada |

El bloque CSRF entró en `f40f752`, muy anterior al último despliegue, así que
producción lo tiene.

**Una hipótesis sobre de dónde sale su 201**, que ellos no podían ver desde
fuera: `middleware.ts:57` exige el CSRF solo `if (!exento && sesion)`. Sin cookie
de sesión no hay credencial ambiental que proteger, el middleware deja pasar y
contesta la ruta. Una herramienta que mande la petición sin cookie ve un 401; con
cookie, un 403. **Ninguna de las dos da 201.**

**Para cerrarlo del todo hace falta la petición y la respuesta crudas que
capturaron.** Sin eso, lo único demostrado es que el código de esta rama no se
comporta como describen.

### SEC-02 · la reautenticación la exige el servidor, no la pantalla

`perfil-controller.ts:82-90`: si no aplica la excepción, pide `passwordActual`,
la verifica y lanza **401 antes de tocar nada**.

El campo ausente que observaron tiene explicación, y es una decisión del día
anterior: el **ADR 0018** oculta el campo con **cuatro condiciones a la vez**, y
una es que esa cuenta **nunca haya puesto su contraseña** y esté en **sesión de
Google**. Cambiar el correo **nunca** entra en la excepción
(`lib/perfil-acceso.ts`).

Si la cuenta con la que auditaron no muestra el campo, es que sigue en ese
estado. **Si el criterio del ADR 0018 no convence, es una decisión de un día de
antigüedad y se revisa** — pero no es un fallo de implementación.

### SEC-03 · el rol sí filtra, y era su prioridad #1

No pudieron probarlo por falta de un rol limitado. Se leyó el código:
`app/api/estado/route.ts:48-52` calcula los permisos del rol y envuelve **cada
porción** en `si(modulo, consulta)`, que devuelve arreglo vacío **sin consultar la
base**. Un rol Comercial recibe `facturas: []` y `cobranzas: []`.

Lo que el rol no puede ver **ni siquiera se pregunta**.

---

## Lo que era cierto, y lo que apareció al arreglarlo

### DATA-01 · corregido en parte, y la parte que falta importa

Confirmado en tres sitios. Ciudad y estado **dejan de inventarse**. El país
**no puede todavía**: `db/schema.sql:136` es `pais text not null default 'PE'`, o
sea que **la aplicación hoy no tiene forma de decir «país desconocido»** — un
`null` revienta con 23502.

**Queda abierto**, y es ROJO: cambiarlo es una migración sobre una columna con
filas en producción, y antes hay que decidir en qué se convierten las filas que ya
dicen `'PE'`. Nada en la fila distingue un `'Lima'` tecleado de uno inventado.

**Las filas ya guardadas no cambian.** La corrección es solo de escritura.

### VAL-01 · cierto, y el informe se quedó corto

El RFC validaba forma y no calendario (`\d{6}` aceptaba el mes 13). Corregido con
validación de mes y día. Los genéricos `XAXX010101000` y `XEXX010101000` pasan
**sin caso especial**, que es la comprobación de que la regla es correcta.

Y sobre el correo: reportaron «acepta correo inválido con 201». Cierto —
**y además ese correo no se guardaba en ningún sitio.** El esquema nunca declaró
un `email` de primer nivel y zod descarta en silencio lo que no declara. La
pérdida callada era la mitad grave, y desde fuera es invisible.

### UX-01 · había dos defectos más en el mismo código

Además de lo reportado: el esquema no validaba que una fecha fuera una fecha
(`'mañana'` llegaba a `$1::date` y volvía como un 500 del driver), y la
comparación de fechas era **sobre cadenas**. Lo destapó un control positivo en
rojo: un contrato correcto de `2026-9-1` a `2026-10-01` se rechazaba.

### CFG-01 · la configuración ya manda

El dato llegaba entero hasta el borde y lo descartaban **dos veces**:
`finanzas-controller.ts:27` y los botones de `finanzas/page.tsx:467`.

Dos cautelas que se tomaron y conviene no deshacer: **lista vacía → respaldo
`{60,90,120}`** (se pueden borrar todos los plazos desde la pantalla, y tomarlo al
pie de la letra dejaría a esa organización sin poder facturar), y **solo valida lo
que se escribe** — una factura ya emitida a 45 días se sigue leyendo y cobrando
aunque se retire ese plazo.

---

## Una corrección al informe

**SEC-05 no es lo que parece desde fuera.** `spaces_prod` del PADRE **es una base
de pruebas**, no clientes reales. Los registros `QA-AUDIT` que dejaron ahí no son
contaminación de producción: esa base se reinicia sin preguntar. El auditor no
podía saberlo.

Eso **no** invalida CRUD-01: que no exista forma de borrar sigue siendo cierto y
se está corrigiendo.

---

## Lo que la auditoría no podía ver, y sí es un hallazgo

**No existía ni una prueba que afirmara que el CSRF rechaza.** El cliente de
pruebas siempre manda el token, así que la protección estaba *ejercitada* pero
nunca *comprobada*: desactivarla habría dejado las 237 pruebas en verde. Ahora hay
dos archivos que lo afirman.

Es, irónicamente, el hallazgo más valioso de SEC-01 — y no es el que reportaron.

---

## Lo que sigue abierto

| | Qué | Por qué no se cerró |
|---|---|---|
| DATA-01 | El `NOT NULL DEFAULT 'PE'` del esquema | Migración sobre columna con filas en producción: **ROJO**, y necesita decidir qué pasa con las filas actuales |
| VAL-03 | La migración de RFC único | **Escrita y sin aplicar.** Hasta entonces el aviso por nombre funciona y el RFC duplicado no se bloquea |
| — | Tres copias más de la expresión del RFC | `config-fiscal.ts:20` valida **el RFC de la propia organización** y sigue aceptando el mes 13 |
| — | Cuatro `update … where id = $1` sin `and tenant_id` | `clientes-repo.ts:191`, `sitios-repo.ts:327/439/448`. La RLS los cubre; falta la segunda capa de la convención. Es trabajo de tenant → **ROJO** |
| — | `plazoDias` tipado `60 \| 90 \| 120` | Solo el tipo; la columna es `integer` y el valor llega validado |
| SEC-04 | La CSP entra en **modo reporte** | Activarla bloqueando exige que una persona abra la aplicación en un navegador y revise la consola |
| UI-02 | Marca de agua en los mapas | Falta una API key de CARTO; no es código |
| UI-03 | Responsive | No verificable sin dispositivos |
| DATA-02 | `spotsReservados: null` vía propuesta | Sin investigar todavía |

**Ninguna fase pendiente del Plan de Instancias Soberanas v3 corrige nada de esto.**
Se comprobó: las siete que quedan son `[infra]`, `[release]` o `[verificación]` del
modelo de despliegue. El plan no menciona CSP, ni validación de entrada, ni el
país, ni el título. Son ejes ortogonales.
