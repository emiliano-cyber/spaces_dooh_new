# ADR 0014: Postgres en el droplet, no base administrada de DigitalOcean

- **Fecha:** 2026-08-21
- **Estado:** Propuesta

## Contexto

Mañana se contrata el droplet **PADRE** y hay que decidir dónde vive su Postgres.
La misma decisión se multiplica después: el modelo de instancias soberanas
(`vault/01-Arquitectura/modelo-instancias-soberanas.md`) da a **cada owner su
propio droplet y su propia base**, así que lo que se elija aquí se repite tantas
veces como owners haya.

**Lo que hay hoy**, del repositorio:

- Postgres **instalado en el droplet**, no administrado. El plan lo hace constar
  en su §8.
- La aplicación conecta como un rol restringido (`spaces_user` en producción,
  `spaces_app` en una instancia nueva), **NOSUPERUSER NOBYPASSRLS**. El
  aislamiento entre organizaciones se apoya en **RLS con FORCE**, así que ese rol
  no puede ser superusuario: si lo fuera, la RLS no aplicaría y el aislamiento
  desaparecería sin dar error.
- El despliegue corre las migraciones con **`sudo -u postgres psql`**
  (`deploy.yml:147`), es decir **por socket local y como el superusuario del
  sistema**.
- `update.sh` hace `pg_dump` antes de migrar y, si la salud falla,
  `drop schema public cascade` + `create schema public authorization <dueño>` +
  `pg_restore` (`update.sh:1552-1553`). Eso pide privilegios altos sobre la base.
- `db/schema.sql:19` hace `create extension if not exists "pgcrypto"`.
- Los respaldos ya viajan **fuera del droplet**, a Spaces (`respaldo.sh`, F3.7).
- **Los datos de los tres entornos son de prueba** —incluido `spaces_prod`— y se
  recrean si conviene. Eso baja mucho el coste de equivocarse hoy.

**Restricción que no se puede saltar:** la planeación tiene prohibido consultar
DigitalOcean, así que **los precios de abajo son de lista y no están verificados
contra la cuenta**. Hay que confirmarlos antes de contratar.

## Decisión

**Postgres sigue instalado en el droplet**, tanto en el PADRE como en cada
instancia de owner. **No se contrata base administrada** por ahora.

La decisión se revisa cuando ocurra **cualquiera** de estas tres cosas, y se
escriben aquí para que no sea una decisión perpetua por inercia:

1. **La primera instancia con datos reales de un owner.** Hoy todo es de prueba;
   ese día deja de serlo y el valor de los respaldos administrados sube.
2. **Que haga falta recuperar a un punto en el tiempo.** El respaldo de hoy es
   un `pg_dump` por corrida; una administrada da PITR.
3. **Que la base compita por memoria con la aplicación** en el mismo droplet.

## Alternativas consideradas

### A · Base administrada de DigitalOcean, una por instancia

**Qué es:** un clúster Postgres gestionado, con respaldos diarios, PITR de 7
días, actualizaciones menores automáticas y conexión por red dentro de la VPC.

**Qué la haría buena aquí:** quita de encima el respaldo, el parcheo y el ajuste
del motor, que hoy no tienen dueño. Y el PITR es una red que un `pg_dump` por
corrida no da.

**Por qué se descarta hoy:**

- **Duplica el coste por owner.** El plan presupuesta ~$15/mes por instancia
  (droplet $12 + backups $2,40). La administrada más pequeña son **~$15/mes
  más**, así que cada owner pasa de ~$15 a ~$30. Con tres owners, de ~$45 a ~$90.
  **Para datos que hoy son de prueba, es pagar por una garantía que no se está
  usando.**
- **Rompe el despliegue tal como está escrito.** `deploy.yml:147` corre las
  migraciones con `sudo -u postgres psql`, que **solo existe con Postgres local**.
  Con una administrada no hay usuario `postgres` del sistema ni socket: hay que
  reescribir ese paso para que use `psql "$DATABASE_URL"`, y eso es tocar el
  único camino de despliegue que existe hoy, justo antes de una migración.
- **Y toca el punto más delicado del actualizador.** La vuelta atrás hace
  `drop schema public cascade` + `create schema public authorization`. En una
  administrada se conecta como `doadmin`, que **no es superusuario**: hay que
  comprobar que ese bloque funciona igual, y `update.sh` es precisamente el
  archivo del que este proyecto dice que *«las tres veces que se dio por bueno,
  la auditoría encontró algo»*. Cambiarle el suelo hoy es la peor semana para
  hacerlo.
- **Un frente nuevo sin cerrar el anterior:** la Fase 3 acaba de cerrar dos fugas
  de credenciales del actualizador. Meter una conexión de red por medio abre
  superficie —TLS, certificados, `sslmode`— justo cuando ese código está recién
  auditado.

**Esta alternativa es la que hay que reconsiderar primero** cuando se cumpla
cualquiera de los tres disparadores de arriba. No se descarta por mala: se
descarta por **prematura**.

### B · Administrada solo para el PADRE, local en las instancias

**Qué es:** el plano de control con base gestionada; cada owner con la suya en su
droplet.

**Qué la haría buena:** el PADRE es la pieza cuya pérdida duele más — es quien da
de alta instancias y guarda las llaves de la flota.

**Por qué se descarta:** **rompe la premisa que hace barato todo el modelo**, que
es que **el artefacto y el procedimiento son idénticos en todas partes**. Con dos
formas de conectar a la base hay dos runbooks, dos maneras de fallar y dos
caminos que probar — y el ensayo en el PADRE **dejaría de decir nada** sobre lo
que va a pasar en una instancia. Es exactamente el tipo de asimetría que P4-bis
costó tres días en eliminar del autoregistro.

### C · Postgres en el droplet, pero en un contenedor aparte

**Qué es:** la base en su propio contenedor, no instalada en el sistema.

**Qué la haría buena:** encaja con el modelo de instancias, donde la aplicación
ya va en contenedor, y hace la versión de Postgres explícita y reproducible.

**Por qué se descarta hoy:** no resuelve nada de lo que preocupa —el respaldo y
el parcheo siguen siendo nuestros— y **añade un modo de fallo nuevo**: un
`docker` que se reinicia mal se lleva la base por delante. `update.sh` ya
manipula contenedores; que uno de ellos sea la base es pedirle a ese script un
cuidado que hoy no tiene. **Merece reconsiderarse cuando la Fase 5 escriba el
aprovisionamiento**, no antes.

## Consecuencias

**Positivas**

- **Coste:** ~$15/mes por owner en vez de ~$30. Y el PADRE se queda en $12.
- **Nada que reescribir esta semana.** `deploy.yml`, `update.sh` y `migrar.mjs`
  siguen funcionando como están y como se probaron.
- **Un solo procedimiento** para el PADRE y para cada instancia: lo que se ensaya
  en uno vale para el otro.
- La conexión es por **socket local**: no hay credencial de base viajando por la
  red, y eso es una fuga menos que vigilar en un mes en el que ya hubo dos.

**Negativas**

- **El respaldo y el parcheo del motor no tienen dueño.** Hoy lo cubre a medias
  `respaldo.sh`, que sube un `pg_dump` por corrida del actualizador; **entre dos
  actualizaciones no hay respaldo de nada**. Es la deuda más clara de esta
  decisión.
- **No hay recuperación a un punto en el tiempo.** Se recupera al último dump, y
  se pierde lo de en medio.
- **La base compite por la memoria del droplet** con Next y con el build. Es la
  razón de pedir 2 GB y no 1.
- **Una migración fallida deja la base sin recobro** salvo `drop database`
  (defecto **D4**, medido). Hoy se acepta porque las bases se recrean; con datos
  reales, no.

**Implicaciones de seguridad**

- **Superficie que se quita:** la base **no escucha en la red**. No hay puerto
  5432 expuesto, ni TLS que configurar, ni certificado que caduque, ni credencial
  de base viajando entre máquinas. Con una administrada, todo eso pasa a existir.
- **Superficie que se asume:** si alguien entra al droplet, **está dentro de la
  base**. Con una administrada quedaría un salto más. Mitigado en parte porque la
  aplicación conecta con un rol **NOSUPERUSER NOBYPASSRLS** y la RLS con FORCE
  sigue aplicando incluso al dueño de la tabla.
- **Dónde viven los secretos:** la contraseña del rol de aplicación vive en
  `.env.production`, en el droplet, y **la genera el aprovisionamiento — es
  propia de cada instancia**. Nadie la rota hoy; hay que decir en el runbook
  quién y cada cuánto. Las llaves de Spaces para el respaldo viven en la
  configuración del actualizador, y **F3.7 ya garantiza que no viajan en `argv`**.
- **Cifrado:** en tránsito no aplica —es socket local—. **En reposo depende del
  cifrado del volumen del droplet**, no de Postgres. Una administrada lo cifra en
  reposo por omisión; **ésta es la ventaja de seguridad real de la alternativa A**
  y se asume a conciencia mientras los datos sean de prueba.
- **Auditoría:** queda el log de Postgres en el droplet, sin retención definida.
  Una administrada da métricas y logs con retención. Hoy **no hay nadie mirando
  ninguno de los dos**, así que la diferencia es teórica.
- **Dependencias nuevas:** ninguna. Ésa es parte del argumento.

## Cómo revertir

**Barato, y es lo mejor de esta decisión.** Migrar de Postgres local a
administrada es `pg_dump` → crear el clúster → `pg_restore` → cambiar
`DATABASE_URL` → reiniciar. Con datos de prueba, minutos; con datos reales, una
ventana corta.

Lo que **no** es gratis es lo de alrededor, y hay que contarlo:

1. **`deploy.yml:147` y `:119` hay que reescribirlos** para no depender de
   `sudo -u postgres`.
2. **Hay que comprobar la vuelta atrás de `update.sh`** contra una administrada:
   el `drop schema` + `create schema … authorization` corre como `doadmin`, que
   no es superusuario.
3. **`create extension "pgcrypto"`** (`db/schema.sql:19`) tiene que estar
   permitido en el plan contratado.

Ninguna de las tres es una migración irreversible de datos. **La decisión es
reversible; lo que cuesta es el trabajo de fontanería, y hoy ese trabajo compite
con cerrar la Fase 3.**
