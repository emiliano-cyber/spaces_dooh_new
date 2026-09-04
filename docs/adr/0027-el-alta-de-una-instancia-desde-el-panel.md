# ADR 0027: El alta de una instancia se pide desde el panel, y la ejecuta otro proceso

- **Fecha:** 2026-09-04
- **Estado:** Aceptada (2026-09-04, por Emiliano)
- **Amplía:** [ADR 0026](0026-panel-de-flota-con-pantalla-propia.md)

## Contexto

Dar de alta una empresa **no es un formulario**: como una empresa es una instancia
(un droplet, una base, un dominio), el alta es aprovisionar una máquina entera. Hoy
son diez pasos a mano con `provision-instancia.sh`, y el ensayo del 2026-09-04 (F5.6)
los recorrió por primera vez de punta a punta.

Lo que ese ensayo dejó medido, y que manda sobre este diseño:

- **Este camino lleva 22 defectos conocidos**, y **ocho aparecieron el mismo día en que
  se ejecutó por primera vez** contra máquinas reales. Los tres últimos —el certificado
  sin cuenta, los dos `default_server` y el cableado del panel— salieron con la tarjeta
  delante y una persona atenta.
- **La mitad de esos defectos son de datos mal tecleados o variables olvidadas**: un
  espacio delante de un valor, `DO_SSH_KEYS` sin poner, un correo con marcadores.
- El alta **se para a propósito** esperando al DNS, porque la zona del owner es suya.

El panel de flota (ADR 0026) existe desde hoy y **no tiene ni una credencial**: pregunta
al PADRE quién eres y consulta `/api/version`. Esa ausencia es lo que hace que
comprometerlo no sea comprometer la flota.

**Decidido por Emiliano el 2026-09-04**, tras plantearle el riesgo y reafirmarlo:

1. El alta **se pide desde la página**. Las llaves van en archivos `.env`.
2. **La región es fija: Nueva York.** No se pregunta.
3. **El dominio lo crea AS OOH en Cloudflare**, así que el DNS entra en el alcance.
4. Esto **solo existe en el PADRE**, nunca en la instancia de un owner.

## Decisión

**El panel pide el alta; un proceso aparte la ejecuta.**

**`panel`** (3002, detrás de nginx, el de hoy) muestra el formulario, valida y **anota
una solicitud** en `estado/solicitudes/`: `{instancia, dominio, email, quién, cuándo}`.
No tiene el token de DigitalOcean, ni el de Cloudflare, ni clave SSH. **No ejecuta
nada.**

**`ejecutor`**, un proceso que **no escucha en ningún puerto** —lo despierta un
temporizador de systemd—, toma la solicitud pendiente, corre el alta y va escribiendo su
registro, que el panel muestra. Ahí, y solo ahí, viven las credenciales.

Para quien lo usa la experiencia es la de un botón. La diferencia es que **el proceso
que da la cara a internet sigue sin tener ninguna credencial**: quien comprometa el
panel puede, como mucho, dejar escrita una solicitud — que es un problema, pero no es
«se llevó la flota». Es la misma forma que ya usa el proyecto para actualizar: la
instancia jala, el padre no empuja.

**El formulario pide cuatro cosas:** nombre de la instancia, dominio, correo del Dueño y
nada más. **Región `nyc1` y tamaño quedan fijos** en el entorno del ejecutor, y **el
canal es siempre `estable`** — el invariante 13 dice que nada llega a un owner sin pasar
por el banco de pruebas, y un desplegable con `beta` es una forma de saltárselo sin
darse cuenta.

**El DNS entra en el alcance, con una raya clara:** si el dominio cuelga de una zona que
AS OOH controla en Cloudflare, el ejecutor **crea el registro `A` por API**, siempre con
`proxied: false`. Si el dominio es del owner, el alta **se para igual que hoy** y el
panel muestra «esperando DNS» hasta que resuelva.

> La nube gris no es un detalle: con el proxy encendido el nombre resuelve a direcciones
> de Cloudflare y el certificado se pediría sobre una máquina que no es la del owner.
> Medido el 2026-09-03. Por eso el `proxied: false` va en el código y no en la cabeza de
> quien rellena el formulario.

## Alternativas consideradas

**Que el panel ejecute directamente**, sin partirlo. Es menos trabajo y menos piezas. Se
descarta porque pone el token que **crea y destruye droplets** dentro del único proceso
expuesto a internet. La partición cuesta un temporizador y un directorio, y quita
exactamente ese poder de la cara pública.

**Dejarlo como está: el panel prepara la tarjeta y una persona la corre.** Cero
credenciales nuevas y cero superficie; quita la mitad de los defectos —los de teclear
mal— sin automatizar el recorrido. Se propuso y **se descartó por decisión de negocio**:
el alta la harán solo los dueños de la empresa, desde el PADRE, y se aceptan los riesgos.

**Emitir el certificado por DNS-01 aprovechando el token de Cloudflare.** Se descarta, y
esto **ya se decidió una vez**: los ADR 0016 y 0017 retiraron el token de Cloudflare
justamente porque el camino DNS-01 lo metía en la **renovación** — *«si caducaba, hacía
morir el certificado»*. Aquí el token se usa **solo el día del alta**, para crear un
registro `A`. Si caduca, un alta falla en voz alta y una vez; ningún certificado vivo se
cae. Esa es la diferencia que hace aceptable reintroducirlo, y no otra.

## Consecuencias

**Positivas**

- El alta deja de depender de que una persona teclee diez comandos sin equivocarse.
- La cara pública **sigue sin credenciales**. El ADR 0026 no se debilita.
- El DNS deja de ser un alto manual cuando el dominio es nuestro.
- Queda registrado **quién pidió cada alta y cuándo**, que hoy no consta en ningún sitio.

**Negativas**

- **Se automatiza un recorrido que todavía produce defectos nuevos cada vez que se
  corre.** Es el costo principal y conviene no maquillarlo: hoy, con una persona atenta y
  la tarjeta delante, salieron tres. Detrás de un botón, esos tres habrían sido «el alta
  falló» sin más.
- **Dos credenciales nuevas en el PADRE**: DigitalOcean (crear/borrar droplets) y
  Cloudflare (editar DNS). Antes había cero en este camino.
- Un proceso y un temporizador más que mantener.
- El estado del alta vive en archivos, no en una base: si el ejecutor muere a mitad,
  alguien tiene que mirar el registro y decidir. **No hay reintento automático**, y es
  deliberado — reintentar un alta a medias puede crear un segundo droplet.

**Implicaciones de seguridad**

- **Superficie que se agrega:** un formulario `POST` en el panel. Sigue exigiendo
  `administracion:ver` del PADRE; conviene que el alta exija además `administracion:crear`.
- **Dónde viven los secretos:** `/etc/space-os/ejecutor.env`, modo 600, propiedad del
  usuario del ejecutor y **no legible por el usuario del panel**. Esa separación de
  usuarios es lo que hace real la partición; sin ella es decorativa.
  **El ejecutor corre como `altas`, distinto de `flota`** — decidido el 2026-09-04.
- **Alcance de los tokens:** DigitalOcean **solo droplets** (crear, leer, borrar).
  Cloudflare **solo `DNS:Edit` sobre la zona concreta**, nunca de cuenta.
- **Quién los rota:** nadie hoy. Es deuda, y se anota aquí para que conste.
- **Lo que puede hacer un panel comprometido:** escribir una solicitud. El ejecutor la
  ejecutaría — así que la solicitud **es** la superficie real. Por eso el ejecutor
  **valida otra vez** todo lo que lee (dominio, nombre, correo) en vez de fiarse de que
  el panel ya lo validó.
- **Auditoría:** cada solicitud queda con su autor y su hora, y el registro del ejecutor
  con lo que hizo. Es más rastro del que hay hoy, no menos.

## Cómo revertir

- Quitar el `include` del panel en nginx lo saca de internet en un minuto.
- `systemctl disable --now` del temporizador del ejecutor deja el alta como está hoy:
  `provision-instancia.sh` a mano, que **sigue existiendo y no se toca**. Esa es la razón
  de no meter la lógica del alta dentro del panel: el camino manual sigue siendo el
  camino, y esto es una capa encima.
- Los dos tokens se revocan en sus consolas y se borran del `.env`.
- No hay esquema nuevo ni migración: el estado son archivos.
