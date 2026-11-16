# Validación de ciberseguridad — v0.12.11 y `feat/personalizar-dashboard`

**Fecha:** 2026-11-13 · **Pedido del dueño:** «añade una validación tuya para ver la parte de ciberseguridad».

**Alcance**

| Qué | Rango | Por qué |
|---|---|---|
| La v0.12.11, ya en `main` | `fccfd92a..4462557e` | Trae una ruta nueva (`/api/perfil/avisos`), una tabla nueva (`avisos_usuario`, migración ROJA R3), correo saliente con datos de la empresa, un disparo **sin sesión** (aceptación por liga pública) y la guarda del rol del Dueño |
| La rama por subir | `origin/main..feat/personalizar-dashboard` | Solo interfaz y `localStorage` |
| Dependencias de producción | `npm audit --omit=dev` | Lo que corre en el servidor y en el navegador |

**Método.** Lectura del código de cada capa (ruta → controlador → repo → SQL → migración → correo) y **sondeo real** contra un servidor LOCAL de pruebas (`localhost:3412`, base desechable `spaces_vista` con la semilla `demo-rentabilidad`). Nada contra producción ni contra DEMO.

## Veredicto

**VERDE para publicar** lo que hay hoy, con **una decisión del dueño** (H1) antes de pedir a todos que enciendan los correos, y **una tarea aparte de dependencias** (H2).

No se encontró ninguna falla explotable en el código nuevo.

## Lo que se comprobó y está bien

**Ruta `/api/perfil/avisos`**
- El usuario sale de la **sesión** (`usuarioActual()`), nunca del cuerpo.
- El repo filtra por `tenant_id` además de la RLS, y usa `q` y no `qRaw`.
- Sondeado: un `usuarioId` o un `tenantId` metidos en el cuerpo **se ignoran**, y el cambio cae en la cuenta propia.

**Entrada validada con listas blancas** (`lib/avisos.ts`)
- Tipo y canal solo de su lista; tope de tamaño de la lista.
- Teléfono en E.164, con el mismo patrón en un `check` de la base.
- Sondeado, todo con **400**: un tipo con inyección SQL, el teléfono con `<script>`, 5 000 elementos, JSON roto y WhatsApp (sembrado, todavía no se permite encenderlo).

**CSRF**
- `/api/perfil` no está en las excepciones del middleware (`middleware.ts:119`).
- Sondeado: sin token **403**, con token falso **403**.

**Aislamiento entre empresas (R2)**
- `avisos_usuario` con RLS `enable` **y** `force`, la política `tenant_isolation` de siempre y los `GRANT` al rol de la app.
- Los destinatarios de un aviso se buscan con el tenant fijado: `q` con sesión, `qConTenant` en la liga pública.
- Solo usuarios **activos**: alguien dado de baja deja de recibir correos.
- Las e2e `avisos-canal` y `aislamiento` pasaron el 13/11 (1271 en verde).

**El correo** (`lib/server/correo-aviso.ts`)
- Título, detalle, nombre de la empresa y logo pasan por `escaparHtml` (`& < > "`, y todos los atributos van entre comillas dobles).
- El botón solo acepta rutas internas: rechaza `//otro.com`, que tendría cara de ruta propia.
- El asunto no lleva el texto que escribe el cliente.
- Va por API REST con cuerpo JSON (Resend o Brevo), no por SMTP: no hay cabeceras donde inyectar saltos de línea.

**Disparo sin sesión** (aceptación por liga pública)
- El nombre del cliente tiene longitud máxima y va escapado.
- Una propuesta se acepta **una sola vez**: la liga no sirve para mandar correos en bucle.
- El correo sale **después** del `commit` y con su propia conexión: si falla, no se pierde la aceptación.

**Teléfono de WhatsApp (dato personal)**
- Solo se lee por la ruta de la propia cuenta. Ningún listado de usuarios lo expone.

**Rol del Dueño (GUARD 5)**
- Lo impide el **servidor** (`lib/guardas-usuarios.ts`, aplicado en `usuarios-repo.ts`), no solo la pantalla.
- Sondeado: la Dueña no puede cambiarse el rol (**400**).

**Secretos**
- Los diffs no traen claves. Las únicas son de mentira, en pruebas (`re_x`, `xkeysib-y`).
- Las plantillas `.env` llevan las variables vacías.

**`feat/personalizar-dashboard` y el menú plegable**
- Solo `localStorage`, leído con `JSON.parse` dentro de `try` y filtrado por lista blanca de ids (`leerOcultas`, `menu-plegado.ts`).
- No hay `fetch`, `innerHTML` ni `eval` nuevos. Los nombres de los bloques salen del diccionario y React los escapa.

## Hallazgos

### H1 · MEDIO · decisión del dueño — los avisos de dinero llegan por correo a cualquier rol que los encienda

**Qué pasa.** Configuración → Avisos ofrece los 7 tipos a **todas** las cuentas. Un vendedor sin permiso de Finanzas puede encender FACTURA, PAGO y COBRANZA. El correo de cobranza lleva folio, cliente y saldo (`finanzas-repo.ts:114`).

**Por qué no es una falla nueva.** La campana ya los muestra a todos: `listarNotificaciones` filtra solo por empresa, y las rutas de la campana usan `exigir()` sin módulo. El correo no da acceso a nada que esa persona no vea ya en la app.

**Por qué importa igual.** El correo **saca el dato del sistema**: queda en un buzón externo, se reenvía, y no se borra al dar de baja a la persona.

**Recomendación.** Filtrar los tipos por permiso:
- FACTURA, PAGO y COBRANZA con `finanzas:ver`; OT con operaciones; y lo mismo para los demás.
- Aplicarlo en `validarPreferencias` y en `SQL_DESTINATARIOS`.
- De paso, en la campana: es la misma exposición desde hace tiempo.

Es una decisión de negocio (qué ve cada rol), así que no se tocó.

### H2 · ALTO · preexistente — dependencias con avisos públicos (`npm audit`: 2 críticas, 5 altas, 1 moderada)

Ninguna la introducen estas ramas: `package.json` no cambió. Para cada una se revisó si **aplica a esta app**:

| Paquete | Aviso | ¿Aplica? |
|---|---|---|
| `next` 14.2.29 | RCE en el optimizador de imágenes (SVG/AVIF), DoS del optimizador | **No**: `images.unoptimized: true` (`next.config.mjs:160`) |
| `next` | SSRF y *request smuggling* en `rewrites` | **No**: no hay `rewrites` |
| `next` | DoS y SSRF en Server Actions | **No**: no hay `'use server'` |
| `next` | RCE en servidores Windows | **No en producción** (Linux) |
| `next` | DoS en Server Components; envenenamiento de caché en redirecciones del middleware | **Sí, en parte**: la app usa App Router y redirige en el middleware. El envenenamiento exige una caché compartida delante (CDN) |
| `xlsx` 0.18.5 | Contaminación de prototipo y ReDoS; **sin versión corregida en npm** | **Bajo**: el Excel se lee en el navegador de quien lo sube (`ImportarInventarioDialog`), ninguna ruta del servidor lo usa |
| `maplibre-gl` | XSS al saltarse el saneador de `setHTML` | **Mitigado**: el popup escapa antes de `setHTML` (SEG-21OCT, `lib/popup-sitio.ts`) |
| `zod` | Memoria agotada con colecciones enormes | Bajo: las rutas nuevas no usan zod; revisar las que sí |
| `postcss`, `nanoid`, `source-map-js` | Varios | Herramientas de compilación, no del servidor en marcha |

**Recomendación.** Una tarea aparte, con aprobación del dueño, porque toca `package.json` (archivo de alto contacto) y sale en la imagen de toda la flota:
- Subir Next a la última **14.2.x** con parches, o planear el salto a 15/16, que es versión mayor.
- Cambiar `xlsx` por la distribución oficial de SheetJS (0.20.x desde su CDN), ya que npm no tiene parche.

Se prueba en DEMO antes de `estable`.

### H3 · BAJO · defensa en profundidad — `avisos_usuario` sin llave compuesta con el tenant

`usuario_id` apunta a `usuarios(id)`, pero la base no exige que `tenant_id` sea el del usuario. Hoy no se puede romper: la única escritura toma el id **de la fila del usuario ya filtrada por tenant**, y la RLS frena el resto. Una llave `(usuario_id, tenant_id) → usuarios(id, tenant_id)` lo cerraría también en la base. Sería migración (ROJO R3): no se hizo.

### H4 · INFORMATIVO — el log de un correo fallido guarda la respuesta del proveedor

`enviarEmail` lanza `Resend 4xx: <cuerpo>` y `avisos-canales.ts` lo imprime en el registro del servidor. Ese cuerpo puede incluir la dirección del destinatario. Es poco, y sirve para diagnosticar. Conviene saberlo si algún día los logs salen a un servicio externo.

## Sondeo — salida literal

```
PASA  · GET avisos sin sesión → 401 — status 401
PASA  · login de la Dueña local — status 200
PASA  · PUT avisos SIN token CSRF → 403 — status 403
PASA  · PUT avisos con token CSRF falso → 403 — status 403
PASA  · WhatsApp (sembrado) se rechaza → 400 — status 400
PASA  · tipo inventado / inyección SQL → 400 — status 400
PASA  · teléfono con HTML → 400 — status 400
PASA  · lista gigante (5000) → 400 — status 400
PASA  · JSON roto → 400 — status 400
PASA  · usuarioId/tenantId del cuerpo se ignoran (guarda en la cuenta propia) — status 200, telefono +525512345678
PASA  · se deja todo como estaba
PASA  · la Dueña no se cambia su propio rol → 4xx — status 400
```

## Lo que esta validación NO cubre

- **No hubo envío real de correo** (no hay cuenta contratada). El día que se contrate, hay que verificar el dominio del remitente (SPF, DKIM y DMARC) en Resend o Brevo; si no, los avisos caen en spam o se pueden suplantar.
- **No se probó contra producción ni contra DEMO.** Las cabeceras de nginx, TLS y el cortafuegos del droplet quedan fuera.
- **No es una auditoría de toda la app:** solo de lo que cambió en la v0.12.11 y en esta rama, más las dependencias.
