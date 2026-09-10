# ADR 0031 — Los datos de g500 sí se rescatan del droplet viejo

- **Fecha:** 2026-09-09
- **Estado:** **Aceptada y EJECUTADA el mismo día**
- **Decide:** Emiliano
- **Sustituye:** el **punto 2** del
  [ADR 0023](0023-el-droplet-viejo-sale-del-modelo.md) — *«No se exporta ni se
  respalda su base»*. **El resto del ADR 0023 sigue vigente.**
- **Relacionadas:** [ADR 0022](0022-instancia-dedicada-por-owner.md) ·
  [ADR 0025](0025-acceso-de-soporte-a-una-instancia.md) ·
  [ADR 0028](0028-google-obligatorio-y-la-contrasena-para-los-cambios.md) ·
  `docs/Plan_Migracion_Datos_g500.md` ·
  `docs/evidencias/migracion-g500-E2-censo.md`

---

## Contexto

El ADR 0023 (27/08) sacó `209.97.146.136` del modelo y del trabajo, y decidió que
su base no se exporta. **Ese punto no era un capricho: se apoyaba en una premisa
escrita.**

> *«`rgb`, `telcel`, `g500`, `eyro` y `demo-owner` son datos de prueba. **No hay
> organización real que migrar a una instancia (`F7.2`)** ni destino que decidir
> para `rgb` (`F7.3`).»*

**Esa premisa caducó el 2026-09-09**, y no por un cambio de opinión: ese día
`g500` dejó de ser un slug en una base de pruebas y pasó a tener **instancia
propia** —`g500.space-os.io`, su droplet, su base y su Dueño entrando con
Google—, creada desde el panel de altas. A partir de ahí sí hay una organización
real, y sí hay un destino.

Lo que no cambió: las otras cuatro organizaciones siguen siendo datos de prueba,
y el droplet viejo sigue fuera del modelo.

## Decisión

**Se rescatan los datos de una sola organización, `g500`, en una sola lectura, y
el droplet viejo no se vuelve a tocar.**

1. **Solo `g500`.** `rgb`, `telcel`, `eyro` y `demo-owner` no viajan. La máquina
   de un cliente no contiene datos de otras organizaciones — y eso no lo garantiza
   la RLS, lo garantiza que no estén ahí.
2. **Una sola lectura de la máquina vieja**: un `pg_dump` y nada más. Ni
   despliegues, ni migraciones, ni `git pull`, como sigue mandando el ADR 0023.
3. **No viajan las personas.** Ni usuarios, ni credenciales, ni sesiones. El
   equipo lo invita el Dueño desde la instancia. Efecto secundario buscado: no
   aparece un segundo `DUENO` que entre con contraseña, que es lo que el
   [ADR 0028](0028-google-obligatorio-y-la-contrasena-para-los-cambios.md)
   retiró.
4. **Tampoco viaja la bitácora** (`acciones`). Lo decidió la base: tiene un
   trigger `BEFORE DELETE OR UPDATE` que la hace *append-only*, y cargarla dejaba
   la operación **sin marcha atrás en el sitio**. Sus 175 filas eran de `Sistema`
   y del usuario `DEMO`.
5. **La transformación se ensaya en local**, contra una reconstrucción del
   esquema de la instancia, antes de tocar la base del cliente.

## Lo que esta decisión NO dice

> Se escribe aparte, siguiendo el patrón de los ADR 0021 y 0023, porque en este
> expediente los huecos rellenados por deducción son lo que ha costado caro.

**No reabre el droplet viejo para nada más.** No vuelve `F7.1` (censo
autoritativo), no vuelve `F1.1` ni `F1.5`, y la Fase 7 sigue sin existir. Esta
decisión autoriza **una lectura, ya hecha**.

**No dice que los datos de las otras cuatro organizaciones valgan algo.** Siguen
siendo de prueba y siguen sin rescatarse.

**No decide cuándo se destruye el droplet viejo.** Sigue encendido sirviendo
`demo.space-os.io` hasta que se decida otra cosa (ADR 0021 y 0024).

## Consecuencias

**Ejecutado el 2026-09-09**, con expediente completo en
`docs/Plan_Migracion_Datos_g500.md`:

| | |
|---|---|
| Filas cargadas | **541** de negocio, más la configuración y 8 contadores de folio |
| Personas | **ninguna** |
| Bitácora | **ninguna** |
| Verificación | recuentos por tabla contra el censo, dentro de la misma transacción |

**Y encontró un fallo silencioso que ninguna otra vía habría encontrado:** las
**12 modalidades de venta** de las 12 pantallas de g500 —sus tarifas— estaban
etiquetadas como `rgb` por la deriva del `DEFAULT` de `tenant_id`. Un export por
`where tenant_id = g500` habría entregado las pantallas **sin un solo precio y
sin dar ningún error**. Se rescataron por su clave ajena
(`docs/evidencias/migracion-g500-E2-censo.md` §2).

### Dos deudas que esta operación deja abiertas

1. **Dos llaves SSH puestas a mano.** Para leer el droplet viejo y para escribir
   en la instancia hubo que añadir una llave a `/root/.ssh/authorized_keys` de
   cada máquina: la contraseña de `root` del viejo se había perdido y la llave
   efímera de la consola web caduca en horas. **Se retiran** —tarjeta
   `docs/evidencias/migracion-g500-retirar-llaves.txt`.
2. **El acceso de soporte del ADR 0025 no existe todavía**, y esta fue la primera
   operación real que lo necesitaba. No hay usuario `soporte`, ni
   `infra/acceso/personas.yml`, ni rastro fuera de la máquina; el 22 sigue
   abierto al mundo. Se resolvió por la excepción que el propio ADR 0025 nombra
   —la consola de DigitalOcean, que da root sin pasar por `sshd`—. **Mientras eso
   siga así, la respuesta contractual de «quién entró a mis datos y cuándo» no
   existe.**

## Alternativas consideradas

### A · Mantener el ADR 0023 al pie de la letra y que g500 empiece vacía

Cero riesgo y cero trabajo: la instancia ya funcionaba. **Se descarta porque le
pide al cliente que vuelva a capturar 12 pantallas, 5 arrendadores, 13 contratos
y su histórico de campañas y cobranza** — un trabajo que ya estaba hecho y que
existe, medido, a un `pg_dump` de distancia.

### B · Restaurar el dump entero en la instancia

Un solo paso. **Se descarta**: metería `rgb`, `telcel`, `eyro` y `demo-owner` en
el droplet de un cliente, dejando la RLS como única barrera dentro de su propia
máquina. Y además no habría funcionado: el droplet viejo va **13 migraciones por
detrás**.

### C · Apuntar `g500.space-os.io` al droplet viejo

Cero migración. **Se descarta por lo mismo que el ADR 0023 descartó su
alternativa B**: sería un cliente corriendo código del 11/08, sin contenedor, sin
`update.sh` y fuera del camino de actualización de la flota.
