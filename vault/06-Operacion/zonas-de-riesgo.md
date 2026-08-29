---
tipo: operacion
estado: verificado
actualizado: 2026-08-28
tags: [riesgo, seguridad, operacion, obligatorio]
archivos:
  - apps/web/lib/server/
  - db/migrations/
  - apps/web/middleware.ts
  - infra/nginx/demo.space-os.io.conf
---

# Zonas de riesgo

> [!warning] Lectura obligatoria antes de escribir código
> Clasificación derivada del código real de este repo, no de reglas genéricas.
> Cada zona dice **por qué**, **qué se rompe** y **qué verificar antes de
> mergear**.

---

# 🔴 ROJO — no tocar sin aprobación humana

## R1 · Autenticación y sesión

**Archivos:** `lib/server/auth.ts`, `lib/server/cambios.ts`,
`lib/server/password-reset-repo.ts`, `lib/server/identidades-repo.ts`,
`lib/server/google-oauth.ts`, `app/api/auth/**`, `app/api/signup/`,
`app/api/perfil/`, `app/api/usuarios/[id]/restablecer/`

**Por qué:** `crearSesion()` es el punto único por el que se entra al sistema, y
de la sesión cuelga **todo** el aislamiento multi-tenant.

**Qué se rompe:**
- Un cambio en `exigir()` afecta a **65 de 86** handlers a la vez.
- Quitar el corte de `debe_cambiar_password` reabre la ventana de suplantación
  que ADR 0009 cerró — y `/api/estado` devuelve el tenant entero.
- Tocar `cookieSesion()`/`cookieCsrf()` puede dejar la sesión sin `Secure` o
  romper el double-submit en todas las mutaciones.

**Verificar antes de mergear:**
- [ ] `npm run test:e2e` completo, no solo unitarias (las unitarias simulan la
      base y **no ven** los fallos de RLS).
- [ ] Login, logout, restablecer y desbloqueo probados a mano.
- [ ] Que la cookie salga con `httpOnly` y `Secure` en producción.

## R2 · Aislamiento entre organizaciones (RLS)

**Archivos:** `lib/server/db.ts`, `lib/server/tenant.ts`, políticas RLS,
funciones `auth_*` y `*_tenant_por_token`

**Por qué:** el modo de fallo **no da error**: devuelve datos de otra empresa, o
cero filas en silencio.

**Qué se rompe:** usar `qRaw` donde tocaba `q` hace que una consulta conteste
vacío sin fallar. Ya pasó dos veces (`43f9284`, `cambios.ts:115-123`) y una de
ellas dejó el desbloqueo inservible **un despliegue entero**.

**Verificar antes de mergear:**
- [ ] `aislamiento.e2e.test.ts` en verde (casos 8–14, todos en negativo).
- [ ] Que la consulta nueva use `q`/`q1`, y si usa `qRaw` esté justificado por
      escrito.
- [ ] Que el rol de la base **no** sea superusuario ni `BYPASSRLS`.

## R3 · Migraciones ya aplicadas en producción

**Archivos:** todo `db/migrations/*.sql` con fecha ≤ hoy

**Por qué:** editar una ya aplicada hace que el repo y producción divergan **sin
que nada lo detecte**. No hay tabla de control de migraciones.

**Qué se rompe:** un entorno nuevo levanta un esquema distinto al real. Ya pasó:
`20260805_objetos_solo_en_prod.sql` documenta 27 columnas que existían solo en
producción y hacían fallar «retirar un creativo» en cualquier clon.

**Verificar antes de mergear:**
- [ ] La migración es **nueva**, no una edición.
- [ ] Ensayo en `ROLLBACK` con salida 0.
- [ ] Respaldo `pg_dump` antes de aplicar.
- [ ] `recrearEsquema()` de las e2e sigue funcionando desde cero.
- [ ] Nota `DESPLIEGUE_*.txt` con la hora de ejecución.

## R4 · Dinero irreversible

**Archivos:** `lib/server/finanzas-repo.ts`,
`app/api/campanas/[id]/facturar/`, `app/api/cobranzas/[id]/pagar/`,
`app/api/pagos-renta/[id]/pagar/`, `app/api/contratos/**`,
`app/api/arrendadores/[id]/`

**Por qué:** emitir factura consume folio fiscal y crea cobranza. Registrar un
pago altera saldos.

**Qué se rompe:** debilitar el candado permite facturar sin evidencia; romper
`repartirCuotas()` produce planes que no suman al total.

**Verificar antes de mergear:**
- [ ] `flujo-critico.e2e.test.ts` casos 4 y 5 en verde.
- [ ] El endpoint sigue siendo `exigirCambioSensible`, no `exigir` a secas.
- [ ] Doble factura sobre lo mismo sigue dando 409.

## R5 · Borrados en cascada

**Por qué:** ocho relaciones `ON DELETE CASCADE` (ver [[esquema]]). Borrar un
`usuarios` arrastra sesiones e identidades; borrar una `campanas` arrastra
reservas, creativos, OC y órdenes de impresión.

**Verificar:**
- [ ] ¿La operación es un borrado real o debería ser un `activo = false`?
      (`arrendadores` y `clientes` ya usan soft-delete.)
- [ ] Confirmación explícita del usuario en la UI.

## R6 · Configuración de nginx y del proceso

**Archivos:** `infra/nginx/space-os.io.conf` y sus `snippets/`,
`infra/systemd/spaces-web.service`, `infra/systemd/spaces-demo.service`,
`infra/systemd/flota-reporte.service`

> [!success] 2026-08-28 · La CSP pasa a BLOQUEANTE
> Nació en modo reporte el 26/08 —una CSP mal puesta no da error de servidor,
> devuelve 200 con la interfaz rota— y ese modo hizo su trabajo: destapó las
> fuentes de `api.fontshare.com` y, de paso, el `AuthProvider` archivado que se
> ejecutaba en cada visita. Las dos cosas se retiraron.
>
> **Lo que sostiene el cambio no es una prueba, y conviene saberlo:** una
> persona recorrió con la consola abierta las cinco pantallas que cargan algo
> distinto —mapa, arte de creativo, documento de contrato, propuesta pública y
> panel— sin una sola violación. **Las suites no cargan un navegador**, así que
> `cabeceras.e2e.test.ts` solo puede afirmar que la cabecera es la bloqueante.
>
> **Si se añade una pantalla que cargue de un origen nuevo, la CSP la bloqueará
> EN SILENCIO.** Volver a reporte es una palabra en `next.config.mjs`.

> [!success] 2026-08-28 · El PADRE ya NO corre como root
> `ecosystem.config.js` deja de mandar en el 3000: la aplicación la arranca
> **systemd** (`spaces-web.service`) como el usuario **`padre`**. Con eso los
> tres procesos de la máquina tienen su propio usuario —`padre` en el 3000,
> `demo` en el 3001, `flota` en el receptor— y **ninguno es root**. Era la deuda
> que la Fase 4 dejó abierta.
>
> **`pm2 restart spaces-web` ya no vale**, y hay dos pasos nuevos en cada
> despliegue: `chown -R padre:padre apps/web/.next` después del build —Next
> escribe ahí en caliente y el build lo hace root— y `systemctl daemon-reload`,
> porque la unidad es un symlink al repositorio.
>
> **Y un secreto se cambia en DOS archivos:** `apps/web/.env.production`, que lee
> el build, y `/etc/space-os/padre.env`, que lee el proceso. Si divergen, manda
> el segundo. Evidencia: `docs/evidencias/padre-fuera-de-root-20260828.md`.
>
> ⚠️ **`pm2 save` se niega a guardar una lista vacía sin `--force`**, y el aviso
> es un `WARN` en medio de una salida larga. Sin él, el `dump.pm2` conserva
> `spaces-web` y **al reiniciar la máquina pm2 lo resucita a pelear por el 3000
> contra systemd**. Comprobar `pm2 list` vacía, no fiarse del mensaje.

**Por qué:** `X-Forwarded-For $remote_addr` es lo que impide falsear la IP y
saltarse el rate limit del login. Y `instances: 1` es lo que hace que el
limitador en memoria funcione.

**Verificar:**
- [ ] Si subes `instances`, migra `rate-limit.ts` a un store compartido **antes**.

---

# 🟡 AMARILLO — cambiar con cuidado

## A1 · Módulos de dinero sin prueba unitaria

Cubiertos por e2e, pero **no** por unitarias:

| Archivo | Líneas | Cobertura |
|---|---|---|
| `finanzas-repo.ts` | 298 | solo e2e |
| `propuestas-repo.ts` | 593 | solo e2e |
| `ot-repo.ts` | 269 | solo e2e |
| `usuarios-repo.ts` | 224 | solo e2e |
| `password-reset-repo.ts` | 122 | solo e2e |
| `identidades-repo.ts` | 127 | solo e2e (Google) |

**39 de 54 módulos de `lib/server/` no tienen prueba unitaria.** Antes de
cambiar cualquiera de los de arriba, corre las e2e — que son las únicas que lo
cubren y **tardan** (necesitan Docker).

## A2 · Los archivos gigantes

| Archivo | Líneas | Riesgo |
|---|---|---|
| `arrendadores-repo.ts` | 1317 | Conflictos entre agentes garantizados |
| `campanas-repo.ts` | 1214 | Idem |
| `sitios-repo.ts` | 624 | Whitelist `CAMPO_COL` — expone columnas a escritura |
| `propuestas-repo.ts` | 593 | Sin unitarias |

Dos agentes en el mismo archivo **van a chocar**. Ver [[AGENTES]].

## A3 · Contratos públicos de API

Los cuatro endpoints por token (`/api/portal/`, `/api/firma/`,
`/api/propuestas/publica/`, `/api/logo/`) los consumen páginas que abre gente de
fuera. Cambiar su forma rompe enlaces ya enviados por correo.

**Verificar:** que un campo nuevo en `rowToCampana`/`rowToSitio` no se filtre al
portal ([[paginas-publicas]]).

## A4 · Tipos y utilidades compartidas

`packages/types/src/*`, `packages/utils/src/*`, `apps/web/lib/data/types.ts`,
`apps/web/lib/modulos.ts`, `components/demo/shell/nav.ts`,
`components/demo/ui/*`. Muchas dependencias entrantes: un cambio de forma toca
decenas de archivos. **Claim exclusivo.**

## A5 · Enums de Postgres

Quitar un valor exige recrear el tipo y todas las columnas que lo usan. Por eso
`CLIENTE` sigue en `rol_demo` pese al ADR 0010. **Añadir** valores es seguro;
quitarlos no.

## A6 · El `AuthProvider` muerto — ✅ RETIRADO el 2026-08-27

**Ya no existe.** Se retiró la pista archivada entera de `apps/web`: nueve rutas
y ~2 700 líneas. Lo afirma `apps/web/lib/pista-archivada.test.ts`, que se pone
roja si algo de eso vuelve.

> **Lo que esta ficha decía, y por qué se quedó tres semanas sin hacerse:**
> «retirarlo es correcto pero en su propio commit: hoy tres componentes lo
> importan». Era cierto — y engañoso. **Esos tres componentes no los importaba
> nadie**: eran huérfanos que solo se sostenían entre sí. Medido el 27/08:
> `PermissionGuard`, `OTMovil`, `ReporteVisual` y `ReadinessPanel` tenían
> **cero importadores**. El único enganche real al árbol vivo era una línea:
> `providers.tsx` montando `<AuthProvider>`.
>
> **Contar quién importa un archivo no basta: hay que preguntar si a ESE lo
> importa alguien.** Un anillo de huérfanos parece una dependencia viva.

**Y no era inocuo mientras estuvo.** Lo destapó la CSP en modo reporte: en cada
carga de página en producción, `POST http://localhost:3001/auth/refresh` con
`credentials: 'include'` — una página pidiéndole una identidad a la máquina del
visitante. Las 997 unitarias y las 294 e2e estaban en verde con eso dentro,
porque **ninguna carga un navegador**.

## A7 · Integraciones con subproceso

`lib/server/doohmain.ts` invoca Python con `execFile`. Cambiar rutas o el
contrato JSON rompe la publicación sin que la app dé error visible.

---

# 🟢 VERDE — seguro de iterar

## V1 · Utilidades puras con prueba

`apps/web/lib/*.ts` con `.test.ts` al lado: `finanzas-calculo`,
`reparto-creativos`, `renta-periodicidad`, `predio-cercania`,
`contrato-vigencia`, `recordatorios-contratos`, `contrato-documento`,
`creativo-html`, `data-url`, `paginacion`, `periodos`, `tipo-medio`,
`tipos-ot`, `ubicacion`, `validacion`, `rfc`, `medios-url`,
`inventario-export`, `contratos-export`, `arrendadores-filtro`,
`email-remitente`, `carga-global`.

Sin efectos secundarios y con red de seguridad. **Empieza aquí si eres nuevo.**

## V2 · Componentes de presentación

`components/demo/ui/*` (implementación interna), `EmptyState`, `KPICard`,
`StatusBadge`, `SlotsBadge`, `Stepper`, `charts`. Cambiar estilos y layout es
seguro; cambiar sus **props** es AMARILLO (A4).

## V3 · Pantallas de solo lectura

`/actividad`, `/network`, `/comisiones`, `/integraciones`. Leen y muestran.

## V4 · Documentación

`docs/`, las notas `DESPLIEGUE_*.txt`, y esta bóveda.

---

## Regla de oro

> Si el cambio toca **sesión, tenant, migración o dinero**, es ROJO aunque
> parezca de una línea. Las tres regresiones más caras de este proyecto
> (`43f9284`, el no-op de `fijarExigirReautenticacion`, las 27 columnas
> fantasma) fueron todas cambios que parecían pequeños.

## Relacionadas
[[AGENTES]] · [[convenciones]] · [[autenticacion-y-sesion]] ·
[[multi-tenancy-y-rls]] · [[migraciones]] · [[MOC-Proyecto]]
