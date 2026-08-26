# ADR 0019 — DEMO arranca con systemd, no con pm2

- **Fecha:** 2026-08-25
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Relacionadas:** [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  `infra/systemd/spaces-demo.service` · `ecosystem.demo.config.js` (queda sin uso)

---

## Contexto

El [ADR 0017](0017-todo-se-concentra-en-el-padre.md) pone DEMO dentro del PADRE,
y acepta el riesgo de que la demostración pública comparta máquina con el plano
de control **porque se separa por usuario del sistema**: esa separación es su
única mitigación real.

Al montarlo, `pm2 start` como el usuario `demo` falló con
`pm2: command not found`. La causa, medida con `namei -l` y no supuesta:

```
drwxr-xr-x root root /
drwx------ root root root          <-- aquí se corta
drwxr-xr-x root root .nvm
...
-rwxr-xr-x root root   pm2
```

El PADRE instala Node por **nvm**, bajo `/root/.nvm`. **`/root` es `drwx------`**,
así que el usuario `demo` no puede atravesarlo. `pm2` y `npm` le son
inalcanzables, y **ningún enlace simbólico lo arregla**: el enlace apuntaría a
través de `/root`.

## Decisión

**DEMO arranca como un servicio de systemd con `User=demo`**, definido en
`infra/systemd/spaces-demo.service` y **enlazado** desde el repositorio, no
pegado a mano.

Arranca Next **directamente con el node de `/usr/local/bin`**, sin `npm` y sin
`pm2`.

## Por qué esta y no las otras dos

**Instalar Node y pm2 de sistema** — dejaría dos instalaciones de Node en la
máquina, y las dos hay que mantener y actualizar. Se paga complejidad
permanente para conservar una herramienta que systemd ya reemplaza.

**Arrancar DEMO bajo el pm2 de root** — descartada **de plano**: el proceso
público, el de más superficie de ataque, correría **como root dentro del plano de
control**. El ADR 0017 acepta la convivencia *porque* hay separación por usuario;
quitarla deja la decisión sin su única mitigación.

Y systemd no es un sustituto pobre: `User=`, reinicio automático y arranque al
bootear son **nativos**, no emulados. Montar un pm2 por usuario exigiría además
su propio demonio residente y su propio `pm2 startup`.

## Dos defectos que salieron al escribirlo

**① `ecosystem.demo.config.js` nunca habría funcionado.** Declara `PORT: 3001` en
su entorno y lanza `npm start`, que ejecuta
`apps/web/package.json:8` → **`next start -p 3000`**. El puerto está **fijo en el
script** y `-p` gana sobre `PORT`: DEMO habría intentado tomar el **3000**, que ya
sirve el PADRE. Nadie lo había ejecutado, así que el defecto vivía sin dar señal.

La unidad invoca el binario de Next directamente y pasa `-p 3001` explícito.

**② `node_modules` está en la raíz del repositorio**, no bajo `apps/web`: es un
workspace de npm. La ruta del binario lo refleja.

## Consecuencias

### Lo que cuesta, y es real

> **La máquina queda con DOS gestores de proceso**: pm2 para el PADRE, systemd
> para DEMO. Es una inconsistencia, y alguien tendrá que mirarla el día que el
> PADRE también salga de root — que sigue siendo tarea abierta desde el 24/08.
>
> **Lo coherente a medio plazo es que el PADRE también pase a systemd**, no que
> DEMO vuelva a pm2.

`ecosystem.demo.config.js` **queda sin uso**. No se borra: sigue sirviendo de
plantilla para la Fase 5, y su cabecera documenta decisiones que no dependen del
gestor de procesos.

### Lo que se gana

- La separación por usuario que el ADR 0017 daba por hecha **existe de verdad**.
- DEMO sobrevive a un reinicio de la máquina sin depender de `pm2 startup`.
- `After=postgresql.service`: en un reinicio, Next no arranca antes que su base.
  **No es teórico** — el PADRE pasó cuatro días sirviendo con la conexión rota, y
  aunque la causa fue otra, el modo de fallo es el mismo: arranca igual y no se
  queja.

## Cuándo revisar esta decisión

- **Cuando el PADRE salga de root.** Ese es el momento de unificar, y la dirección
  natural es systemd para los dos.
- **Cuando exista `provision-instancia.sh` (F5.4)**, que tendrá que elegir gestor
  de procesos para cada instancia nueva. Esta unidad es el punto de partida.
