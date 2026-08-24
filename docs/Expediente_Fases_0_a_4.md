# Expediente · Fases 0 a 4 del Plan de Instancias Soberanas v3

**Fecha:** 2026-08-21 · **Rama:** `feat/servidor-padre-instancias` (no fusionada)
**Cubre:** las **28 tareas** de las fases 0 a 4, de las 46 del plan.

> [!important] Qué significa «completo» en este documento
> **21 de las 28 tareas están cerradas en local o ensayadas.** Las **7 que
> faltan son todas de servidor o de persona** — nadie puede cerrarlas escribiendo
> código.
>
> Y hay un cambio de fondo respecto a ayer: **el 21/08 se levantó el droplet
> PADRE**, así que una parte de lo que las fases 3 y 4 querían demostrar **ya
> está medido contra un servidor real**, no simulado. Va marcado con 🖥️.

---

## 1 · El panorama en una tabla

| Fase | Tareas | Cerradas en local | De servidor / persona | Estado |
|---|---|---|---|---|
| **0** · autoregistro | 3 | 1 | 2 | Sobrepasada por los hechos |
| **1** · quitar los `DEFAULT` de tenant | 5 | 4 | 1 | **Cerrada en local**, validada |
| **2** · release versionado | 6 | 6 | 0 · falta TH-P4 | **Cierre parcial**, validado |
| **3** · `update.sh` + runner | 9 | 7 | 2 | Casi cerrada; una sin re-auditar |
| **4** · DEMO como instancia | 5 | 3 | 2 | Ensayada, y hoy **medida en real** |
| | **28** | **21** | **7** | |

**Nada está fusionado a `main` y nada se ha desplegado al droplet viejo.**

---

## 2 · 🖥️ Lo que el servidor real cambió, y es lo más importante del expediente

El 21/08 se levantó `ubuntu-s-2vcpu-4gb-amd-nyc1` (NYC1, Ubuntu 24.04, 2 vCPU /
4 GB) siguiendo el runbook, de cero. **Lo que hasta ayer eran ensayos con dobles
y bases desechables, hoy está medido contra una máquina de verdad:**

| Lo que se probó | Resultado medido | A qué tarea le da fuerza |
|---|---|---|
| La cadena de migraciones entera | **70 aplicadas, 1 de datos pendiente, salida 0** | **F3.2, F3.3** |
| `--instalacion-nueva` verificada contra una base real | Pasó: ninguna de las 11 tablas testigo existía | **F3.2** |
| El esquema resultante | **39 tablas** | **F4.2** |
| La base nace **sin ninguna organización** | `tenants` vacía hasta el alta | **F4.2** (criterio literal) |
| El rol de la app | `spaces_app` **NOSUPERUSER NOBYPASSRLS** | **F4.2** (criterio literal) |
| El catálogo de permisos | **41 filas · 9 módulos · 5 roles** | ROJO-2 |
| El alta de la instancia | Dueño creado, contraseña **generada** y de un solo uso | ROJO-1 |
| El registro de cuentas | **`signup: 503`**, `{"google":true,"autoregistro":false}` | **F0.1** (para el PADRE), **F4.4** |
| El servicio | pm2 `online`, **`restarts: 0`** | **F4.5** |
| Servido por nginx | `raiz 302 · login 200 · signup 503` | **F4.5** |

> **El matiz que no se puede perder:** todo esto se midió **en el PADRE, no en
> DEMO**. El procedimiento queda validado sobre infraestructura real; la tarea
> **F4.2 sigue abierta** porque su objeto es el droplet de DEMO, que no existe.

### Lo que el servidor real NO probó

- **Nada del droplet viejo.** F0.1, F4.1 y F1.5 siguen intactas.
- **Nada por HTTPS.** Sin certificado, la cookie de sesión —que sale con
  `Secure`— no viaja, así que **no se ha iniciado sesión desde un navegador**.
- **El acceso con Google.** Las claves están puestas y `metodos` dice
  `google:true`, pero eso **solo comprueba que las variables no estén vacías**.
- **`update.sh`.** El PADRE corre con **pm2**, no en contenedor; el actualizador
  conmuta contenedores. Sigue sin ejecutarse en ningún servidor.

---

## 3 · Fase por fase

### Fase 0 · Cerrar el autoregistro fuera de DEMO — *sobrepasada por los hechos*

**1 de 3.** Expediente propio: `docs/evidencias/fase-0.md`.

| Tarea | Estado | Evidencia |
|---|---|---|
| **F0.1** · ¿está abierto el registro en el droplet? | **PENDIENTE_SERVIDOR** | Tarjeta **TH-F0.1**, emitida y sin correr |
| **F0.2** · cerrarlo si estuviera abierto | PENDIENTE_SERVIDOR | Condicionada a F0.1 |
| **F0.3** · la plantilla nace con el registro cerrado | **COMPLETADA_LOCAL** | `6044732`. La prueba **muerde**: se comprobó poniendo la plantilla en `=1` y viéndola roja |

**Por qué se dice «sobrepasada»:** la fase se titula «cerrar el autoregistro
**fuera de DEMO**», y la decisión del 14/08 —reafirmada el 20/08— lo cierra **en
todas partes, DEMO incluida**. La asimetría que perseguía ya no existe.

🖥️ **En el PADRE está medido: `signup` responde 503 y `metodos` dice
`autoregistro:false`.** Eso no cierra F0.1, cuyo objeto es el droplet viejo, pero
sí demuestra que la bandera se comporta como se decidió.

> **Y una decisión que la remata (20/08):** *nadie crea su propia cuenta, en
> ninguna instancia*. El super admin del PADRE crea instancias y el Dueño de cada
> una; ese Dueño da de alta a su equipo. **El autoregistro se queda apagado, sin
> retirarlo** — la capacidad sigue en el producto y lo que no se enciende es la
> bandera. Vigilado por prueba en las dos plantillas.

---

### Fase 1 · Limpieza de los 23 `DEFAULT` de `tenant_id` — **CERRADA en local**

**4 de 5.** Validada por `validador-plan` en **AMARILLO** y aceptada el 17/08.
Expediente: `docs/evidencias/fase-1.md`.

| Tarea | Estado | Evidencia |
|---|---|---|
| **F1.1** · censo del catálogo | ENSAYADA_LOCAL | 23 tablas confirmadas. **Los datos no**: la base local es *fixture* |
| **F1.2** · la migración que retira los `DEFAULT` | **COMPLETADA_LOCAL** | `65bf9b5`. Descubre tablas **por catálogo**, no por lista; idempotencia probada ×3 |
| **F1.3** · el cupo se lee con filtro de organización | **COMPLETADA_LOCAL** | `c50344a`. R2: un `limit 1` sin `where` devolvía la fila de cualquier organización |
| **F1.4** · pruebas del aislamiento | **COMPLETADA_LOCAL** | `3671e8a` |
| **F1.5** · aplicarla al droplet | **PENDIENTE_SERVIDOR** | Tarjeta **TH-F1.5** |

🖥️ **Lo que cambió hoy:** `20260812_sin_default_tenant.sql` **ya no es una
migración solo escrita** — corrió dentro de las 70 del PADRE, contra un
PostgreSQL 16 real, sin incidencias. Su comportamiento está demostrado; lo que
falta es aplicarla al droplet **viejo**, que es F1.5.

> ⚠️ **P1 le quitó urgencia a F1.5 y a TH-02.** Las dos existen para *reparar
> datos* del droplet viejo, y se decidió que sus datos **se recrean desde cero**.
> Un censo de filas que se van a borrar no informa ninguna decisión. **No se
> retiraron**: retirar una tarjeta emitida es decisión de Jochelo.

---

### Fase 2 · Release versionado — **cierre PARCIAL, validado**

**6 de 6 en local.** Expediente: `docs/evidencias/fase-2.md`.

| Tarea | Estado | Evidencia |
|---|---|---|
| **F2.1** · `Dockerfile` reproducible | COMPLETADA_LOCAL | `8ae8f77` |
| **F2.2** · la imagen lleva esquema y migraciones | COMPLETADA_LOCAL | `3f16386`. ⚠️ **No copia `scripts/`**: el runner viaja con el aprovisionamiento |
| **F2.3** · workflow de release | COMPLETADA_LOCAL | `958a3e6`. Escrito, **no corrido**. Dispara con **tags**, no con push a `main` |
| **F2.4** · promoción a `estable` | COMPLETADA_LOCAL | `0584d97`. Escrito, no corrido |
| **F2.5** · smoke de la imagen | ENSAYADA_LOCAL | |
| **F2.6** · el autoregistro sale del build | COMPLETADA_LOCAL | `70ca3f0`. **Con la misma imagen sin recompilar**: sin variable → 503, `=0` → 503, `=1` → 400 |

**Lo que falta para cerrarla del todo:** **TH-P4**, las dos variables de
repositorio en GitHub para el registry de DigitalOcean. Sin ellas `release.yml`
no puede ni hacer login, así que **nunca se ha publicado una imagen**.

> 🟢 **P4-bis quedó cerrada con evidencia el 19/08:** se relanzó **la misma
> imagen** añadiendo solo `-e AUTOREGISTRO=1` y `signup` pasó de **503** a **400**.
> **Un solo artefacto sirve a DEMO y a las instancias de owner.**

> ⚠️ **Hallazgo abierto de los dos workflows:** el token del registry viaja en
> `argv` (`release.yml:242` lo pasa como `--username`), así que queda en
> `/proc/<pid>/cmdline`. Atenuantes: runner efímero y de un solo inquilino.

---

### Fase 3 · `update.sh` + runner de migraciones

**7 de 9.** La fase más grande y la que más auditorías consumió.

| Tarea | Estado | Evidencia |
|---|---|---|
| **F3.1** · nace `schema_migrations` | COMPLETADA_LOCAL | `6cb16d4`. Backfill de **65**, con tres exclusiones deliberadas |
| **F3.2** · el runner | COMPLETADA_LOCAL | **Tres ciclos.** El 1.º auditado **ROJO**: daba por «nueva» una instancia con historia y le reaplicaba todo. Cerrado con `--instalacion-nueva`, que **se verifica** contra una señal derivada del repo |
| **F3.3** · integridad de lo aplicado | COMPLETADA_LOCAL | `dc6df52`. Una migración alterada **aborta con salida 3** nombrando los dos checksums |
| **F3.4** · `update.sh` | ENSAYADA_LOCAL | Ensayo **demostrado en los nueve puntos**. La vuelta atrás se decide **por la huella de la base**, no por la prosa del runner |
| **F3.5** · ensayo contra DEMO real | **PENDIENTE** | Necesita la DEMO de la Fase 4 |
| **F3.6** · retirar `deploy.yml` | **PENDIENTE_SERVIDOR** | **No se mergea** hasta que el canal esté probado: es el único despliegue que existe |
| **F3.7** · respaldo fuera del droplet | COMPLETADA_LOCAL | `f369b4c`. Las credenciales **no viajan en `argv`** y el `chmod 600` va **antes** del secreto |
| **F3.8** · reintentos con backoff | COMPLETADA_LOCAL | `84c6c20`. 1 s, 5 s, 30 s exactos; **la migración no reintenta nunca** |
| **F3.9** · el log viaja sin datos de negocio | **HECHA, sin re-auditar** | Cuatro ciclos. **Auditada ROJO el 20/08**; el arreglo está hecho pero **no vuelto a auditar** |

🖥️ **Lo que cambió hoy:** **la cadena de 70 migraciones corrió entera contra un
servidor real por primera vez**, de una pasada y con salida 0. F3.2 y F3.3 dejan
de estar validadas solo contra bases desechables.

> [!danger] Lo que sigue abierto en esta fase
> **D1 se cerró** el 20/08 —la vuelta atrás restaura sobre esquema limpio y lo
> comprueba— pero **F3.9 arrastra una auditoría ROJO**: el actualizador publicaba
> la contraseña en el registro que sube al bucket cuando el `=` iba codificado.
> Se arregló **dos veces** —el primer intento era una lista negra y duró una
> auditoría— y **la versión buena no se ha auditado**.
>
> Y al arreglarlo apareció **una segunda puerta**: con un `?` escondido como
> `%3F`, la contraseña llegaba al **`argv` de `pg_dump`**, en la ejecución normal
> y sin que fallara nada. También cerrada, también sin auditar.

**Arnés de `update.sh` al cierre: 102 escenarios · 664 comprobaciones · 0 rojas**,
frente a 28 · 101 cuando nació.

---

### Fase 4 · DEMO como instancia real

**3 de 5.** Re-ensayada el 19/08 con **los cuatro criterios pasando**.

| Tarea | Estado | Evidencia |
|---|---|---|
| **F4.1** · censo del droplet actual | **PENDIENTE_SERVIDOR** | Solo una persona |
| **F4.2** · droplet y base de DEMO | ENSAYADA_LOCAL | 🖥️ **Sus dos criterios están medidos hoy en el PADRE**: base sin una fila de ningún owner, y rol de app que **no** puede saltarse la RLS |
| **F4.3** · dominio y certificado | **PENDIENTE_SERVIDOR** | No se simula con hosts falsos |
| **F4.4** · datos y bandera | ENSAYADA_LOCAL | 🖥️ La bandera, medida en real: `signup 503` |
| **F4.5** · smoke y cierre del riesgo | Smoke **local en verde** | 🖥️ Hoy además: `login 200 · signup 503` servidos por **nginx** en un servidor real |

> **La receta de aprovisionamiento, medida y repetida:** rol de aplicación →
> `db/schema.sql` → `migrar.mjs --instalacion-nueva` → alta. **Sin el primer paso
> aborta en la migración 52 de 70.** Se midió en el ensayo del 19/08 y se
> reprodujo hoy, paso por paso, en el PADRE.

---

## 4 · Lo que salió de correrlo en un servidor de verdad

Ocho defectos, **todos del mismo tipo**: cosas que en la máquina de desarrollo ya
estaban hechas, así que **ninguna prueba automática podía verlos**.

| # | Qué | Estado |
|---|---|---|
| 1 | `npm ci` estaba en el paso 7 y el runner lo necesita en el 4 | ✅ corregido en el runbook |
| 2 | La URL de socket no sirve: el runner corre como **root** y falla `peer` | ✅ corregido |
| 3 | El runner dijo `(url no parseable)` y **escondió el error real** | ⏳ pide código |
| 4 | El epílogo de `setup-droplet.sh` manda al **modelo muerto** | ⏳ pide código |
| 5 | `setup-droplet.sh` **no es desatendido**: se cuelga en un diálogo de `dpkg` | ✅ documentado |
| 6 | **El alta no valida el correo** — aceptó un marcador como si lo fuera | ✅ corregido el 24/08 (`lib/validacion-email.mjs`) |
| 7 | `.env.production` nace **644**, con la contraseña de la base dentro | ✅ `chmod 600` en el runbook |
| 8 | **`nginx -t` dijo «ok» sobre una configuración corrupta** | ✅ la config pasa a archivo versionado |

> **El ⑧ es el más instructivo:** un validador que solo mira sintaxis no distingue
> una configuración correcta de una rota que casualmente parsea. La única señal
> fue el **comportamiento** —200 donde debía haber 302—. Por eso la comprobación
> mide **códigos de respuesta**, no que el servicio arranque.

---

## 5 · Lo que falta, y quién lo desbloquea

### Las 7 tareas que no puede cerrar nadie escribiendo código

| Tarea | Qué pide | Nota |
|---|---|---|
| **F0.1** | `curl` + `ssh` al droplet viejo | El plan dice que **bloquea toda la Fase 4** |
| **F0.2** | Cerrar el registro allí, si estuviera abierto | Condicionada a F0.1 |
| **F1.5** | Aplicar la migración al droplet viejo | ⚠️ P1 le quitó sentido: esos datos se recrean |
| **F3.5** | Ensayar `update.sh` contra DEMO | Necesita la DEMO real |
| **F3.6** | Retirar `deploy.yml` | **No antes** de que el canal funcione |
| **F4.1** | Censo del droplet viejo | Solo una persona |
| **F4.3** | Dominio y certificado | **Es el bloqueo de hoy** |

### Los bloqueos de decisión

1. **El dominio del PADRE.** Sin él no hay certificado, ni `APP_URL`, ni acceso
   con Google, ni sesión desde el navegador.
2. **Diecinueve commits ROJO**: 15 aprobados el 20/08, **4 sin auditar** —y dos
   de ellos ya fueron rechazados una vez—. Bloquean el merge a `main`.
3. **Qué pasa con el droplet viejo**: apagarlo, dejarlo como DEMO —lo que
   ahorraría los $12 que el plan presupuesta para ella— o guardarlo de reserva.
4. **TH-P4**: las dos variables del registry. Cierran la Fase 2.
5. **Los códigos de recuperación no existen.** Se decidió que el Dueño entre solo
   con Google; hoy no hay segunda vía si pierde esa cuenta.

---

## 6 · Estado de las pruebas

| | Al cerrar la Fase 2 (14/08) | Hoy |
|---|---|---|
| Unitarias | 805 en 73 archivos | **826 en 75** |
| Integración | 147 + 1 en 14 archivos | **208 + 1 en 19** |
| Arnés de `update.sh` | 28 escenarios · 101 comprobaciones | **102 · 664** |
| Migraciones | 68 | **71** |
| Documentación interna | — | **51 notas · 678 enlaces · 0 rotos** |

**`apps/web/lib/test/aislamiento.e2e.test.ts` no se ha tocado en toda la rama**,
que es el invariante que el plan exige.

---

*Preparado el 2026-08-21. Ninguna de las tareas pendientes se ha ejecutado contra
un servidor sin decirlo.*
