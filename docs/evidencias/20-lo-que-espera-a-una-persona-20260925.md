# Lo que espera a una persona — al cierre del 2026-09-25

Este expediente existe porque **el trabajo de estos dos días dejó una cola que
ningún agente puede tocar**: cosas que exigen un navegador, un servidor, el panel
de DigitalOcean, o una decisión de negocio.

Está escrito para poder retomarse en frío. Cada punto dice **qué falta, por qué
importa y qué pasa si se ignora.**

---

## 0 · Lo primero, y no es opcional

```
cd C:\Users\Server\spaces_doohmain_nueva
git push emiliano main
```

Al escribir esto, `main` va **36 commits por delante** de `emiliano/main`. Todo
lo de estos dos días está **solo en esta máquina**: el manual ilustrado, el
respaldo diario, las etiquetas OCI, los seis cuadros del candado, el arreglo del
mapa y toda la documentación.

`ci.yml` corre al empujar y es la **única verificación en una máquina limpia**
que tiene este trabajo.

---

## 1 · NADIE HA ABIERTO UN NAVEGADOR

**Es el hueco más grande y el más barato de cerrar.**

El 25/09 se arreglaron **seis pantallas** y **ninguna se ha visto funcionando**.
Todas están verificadas leyendo el código y corriendo pruebas — el arnés unitario
**no tiene DOM**, y las e2e no ejercen estos flujos con el control de cambios
encendido. Los cinco agentes lo declararon, cada uno por su cuenta.

### El recorrido, y qué buscar

Hace falta **el control de cambios ENCENDIDO** en la organización, o ninguna de
las seis pedirá nada y el recorrido no prueba nada.

| # | Dónde | Qué hacer | Qué tiene que pasar |
|---|---|---|---|
| 1 | Arrendadores → ficha de contrato → **«Con cuál de tus razones sociales se paga»** | elegir una y guardar | aparece el campo **dentro del cuadro**; en blanco, «Confirmar y guardar» no se pulsa |
| 2 | misma ficha → **«Completar información»** | rellenar y guardar | pide la clave **y los cuatro datos siguen ahí** (antes había que teclearlos otra vez) |
| 3 | misma ficha → **«Registrar pago»** | registrar | el mensaje sale **dentro del cuadro**, no en un aviso que se desvanece |
| 4 | misma ficha → **«Renovar»** | pulsar | **algo pasa.** Antes no pasaba nada en absoluto |
| 5 | Arrendadores → tarjeta de pagos → **botón de pago de la lista** | pulsar | **se abre un cuadro** pidiendo la clave |
| 6 | Finanzas → **«Emitir factura»** y **«Registrar pago»** de cobranza | las dos | el paso de la clave sale dentro; los datos quedan **en gris** |

**Lo que más preocupa de las seis, por orden:**

1. **El nº 5**, porque el cuadro se abre desde una celda de una tabla paginada y
   va **fuera** de `CardColapsable` a propósito — si la tarjeta se pliega, se
   llevaría el cuadro con el pago a medias. Eso se razonó, **no se vio**.
2. **El nº 4**, porque es un `Modal` sobre el `Sheet` de la ficha: dos capas de
   Radix, y nadie ha comprobado que la de arriba se vea.
3. **El nº 6**, porque confirmar **repite la acción pendiente**. En una cobranza
   hay «Liquidar total» y «Registrar abono», y confirmar el que no era movería
   otra cantidad. Hay prueba de mutación que lo cubre, pero verlo cuesta un
   minuto.

### Y el borde de 1px, que sigue sin mirarse

Del 23/09: un arreglo de CSS hizo **aparecer bordes donde nunca hubo ninguno**,
en unos 90 archivos, incluidos `Modal`, `Sheet`, `Card`, `Sidebar` y `Topbar` —
que salen en todas las pantallas. Es correcto: ese borde llevaba desde siempre
sin pintarse por un choque de CSS. Pero **nadie lo ha visto**. Si algo se ve mal,
revertir es un solo commit: `git revert afee2cf`.

---

## 2 · El respaldo de g500 — lo ÚNICO con urgencia real

g500 es la **única instancia con datos de cliente reales**, y hoy solo se
respalda **cuando se despliega una versión**. Al 22/09 su copia remota tenía
5 días; hoy son **~8**.

El trabajo está construido, probado y aterrizado. **Instalado: cero.**

**La tarjeta: `docs/evidencias/12-instalar-respaldo-diario.txt`.** Dos bloques —
**A** (g500, desde el portátil, porque el PADRE no tiene llave hacia g500) y
**B** (DEMO, dentro del PADRE). **El bloque A es el urgente; el B puede esperar.**

### Tres pasos de esa tarjeta que NO se pueden saltar

- **A2** · correrlo a mano **antes** de poner el cron.
- **A2b** · el `ls -l` de permisos. **Es la única comprobación real que existe**:
  las pruebas de permisos no valen en Git Bash sobre Windows, donde `chmod` y
  `umask` no se reflejan en `stat`. El propio arnés lo dice de sí mismo.
- **A2c** · `chmod 600` a los dumps que `update.sh` ya dejó. **No es opcional:**
  nacieron `0644`, o sea **la base entera de un cliente legible por cualquier
  usuario local del droplet**, incluido el que corre la aplicación.

### Y algo que hay que mirar ANTES del cron

**¿Está escrita `SPACES_REGION` en el `instancia.env` de g500?**

`respaldo.sh:95` trae `nyc3` por omisión y **esta cuenta usa `sfo3`** — medido el
17/09 contra la URL real del bucket. Si falta, el respaldo de cada noche falla
con un **404 NoSuchBucket**, que se lee como «el bucket no existe» y no como
«falta una variable». Se comprueba en el paso A3.

---

## 3 · Cinco preguntas que solo se contestan mirando un servidor o el panel

Ningún agente puede responderlas: **esta información no está en el repositorio.**

1. **`SPACES_REGION` en g500** — la de arriba. La más urgente.
2. **¿Existe de verdad la regla de retención de 30 días en el bucket?** El guion
   **no borra nada remoto a propósito**, confiando en esa regla. Si no existe, el
   bucket crece sin límite y nadie se entera.
3. **El 403 de `space-os-logs`.** La llave de g500 funciona en
   `space-os-respaldos` y **no** en el de logs, así que el registro del respaldo
   se queda en el droplet — y para saber si va bien hay que entrar al servidor,
   que es exactamente lo que este modelo evita. Se arregla en el panel de
   DigitalOcean, no es código.
4. **¿De qué base son los dumps** que ya están en `/var/lib/space-os/respaldos`
   del PADRE? Se ve con `pg_restore -l`. Importa porque DEMO y el PADRE los
   escribían **con el mismo nombre** en el mismo sitio.
5. **¿El PADRE corre su propio `update.sh` por cron?** Eso decide si **B37** es
   naranja o rojo.

---

## 4 · El manual — envejeció HOY, y estaba avisado

El manual ilustrado aterrizó con **45 capturas** (hoy 43: se retiraron dos de una
pantalla que ya no existe). Se fotografió el **24/09**.

**El 25/09 cambiaron cuatro de esas pantallas.** D7 avisaba textualmente:

> *«hay que hacerlo después de que no vaya a cambiar nada más de pantalla, o las
> capturas nacen viejas»*

Y nacieron viejas en parte. **Qué falta:**

- **Refotografiar** el 4.1 y los flujos de dinero que cambiaron el 25/09.
- **Un paso sin foto desde el principio:** el 1.1, guardar los códigos de
  recuperación — exige una sesión iniciada con Google, y falsearlo habría sido
  fingir la captura. Dicho en `manuales/capturas-pendientes.md`.
- **Regenerar el PDF.** Hoy **sigue enseñando la pantalla rota** del 4.1.
- **11 capturas del 21/09** quedaron fuera de git, a salvo en el scratchpad de la
  sesión. Están superadas por las del 24/09; falta decidir si se tiran.

---

## 5 · Decisiones de negocio — nadie las puede tomar por ti

**De producto, en `docs/Supervision/ABIERTOS.md`:**

- **D6** · ¿se le pone tope a cuántos meses se le pueden pedir al reporte?
- **D9** · **el cambio de correo**, y lleva cuatro preguntas dentro: ¿quién
  cambia el de quién? ¿va detrás del candado —y entonces entra también la
  contraseña propia, que hoy tampoco lo exige—? ¿se avisa a la dirección
  anterior? ¿se cortan las demás sesiones?
- **D10** · el `?? 0` de `sitios-repo.ts:44-45`. Hoy lo tapa el guard del mapa,
  pero el dato falso se sigue produciendo, y cualquier consumidor nuevo que lea
  `sitio.lat` se lo va a creer.
- **La pantalla de la cuenta bancaria del arrendador.** El guard existe y está
  bien pensado; **ninguna pantalla manda `cuentaBancaria` ni `formaPago`**, así
  que hoy ese dato **no se puede cambiar desde la aplicación**. Es literalmente a
  dónde se manda el dinero. Es una **feature**, no un arreglo, y merece su propia
  tarjeta — con campo de contraseña desde el primer día, que ahora sale gratis.

**De infraestructura:**

- **B36 parte 2** · impedir el push a `estable` fuera de `promover.yml`. Es la
  que habría **impedido** el incidente del 14/09, no solo diagnosticado. Nadie ha
  mirado si DigitalOcean permite restringir el push por etiqueta.
- **B37** · `version-anterior` y `version-actual` colisionan entre DEMO y el
  PADRE, igual que colisionaban los respaldos. Son los archivos que deciden **a
  qué versión se vuelve**, y un respaldo pisado se nota al restaurar mientras que
  una versión pisada se nota **al volver atrás**, con prisa y un despliegue malo
  encima.
- **¿El respaldo avisa cuando falla, y a dónde?** Hoy no avisa nadie. Un respaldo
  sin alerta que deja de correr es **indistinguible de uno que corre**.
- **¿El respaldo entra en el alta de instancias nuevas?** Hoy no:
  `provision-instancia.sh` escribe el cron de update y no este, así que cada
  instancia nueva nace sin respaldo diario y hay que acordarse.
- **¿DEMO recibe credenciales de Spaces?** Hoy no, así que su respaldo se queda
  en el droplet del PADRE. Si el PADRE desaparece, DEMO desaparece con él. La
  decisión del 22/09 fue «respaldo de TODAS las instancias», y esto la deja a
  medias.
- **La deuda de las dos copias:** `conexion-pg.sh` duplica letra por letra seis
  funciones de `update.sh` — la lógica que separa la contraseña de la URL, que
  necesitó tres ciclos de arreglos. Hay un guard que vigila la deriva, pero el
  final bueno es que `update.sh` la sourcee. Cuesta correr `pruebas-update.sh`
  (**15 minutos**).

---

## 6 · Una versión de ensayo, antes del Summit

**Nadie ha corrido `release.yml` con las etiquetas OCI dentro.** El `docker build`
está probado en local, con `docker inspect` y con `crane copy` sobre un registro
desechable. **El workflow entero, no.**

El riesgo es bajo pero no nulo, y a tres semanas de una fecha dura un run en rojo
se lee como «el lanzamiento está roto» aunque no lo esté.

**Quemar un `v0.8.1-rc1`** cuesta unos minutos de runner y ~6 % del registro.
`release.yml` publica solo a **`beta`**, que únicamente consume DEMO: **ninguna
instancia de cliente lo mira.** Es exactamente para lo que está ese canal.

> **Y un hueco que no tiene arreglo:** todo lo publicado antes del 25/09 —
> **incluida la imagen que corre la flota ahora mismo**— no lleva etiquetas, y no
> se puede retroarreglar: reconstruir desde el mismo commit daría otro digest y
> dejaría de ser el artefacto que se probó, que es justo lo que prohíbe el
> invariante 3. **La cobertura empieza en la próxima versión publicada.** Una
> imagen sin `revision` no es un defecto: es anterior al 25/09.

---

## 7 · Decisiones que un agente tomó por su cuenta

**Si nadie dice nada, se quedan así.** Están listadas para que sea una decisión y
no un descuido:

| Qué | Cómo quedó |
|---|---|
| La contraseña al cerrar el cuadro | **se borra** — ese modal no se desmonta al cerrarse, así que sin esto lo tecleado seguiría vivo |
| Los datos mientras se pide la clave | **se congelan**, para que se confirme lo mismo que el servidor rechazó |
| `PagoModal` | **sin `onError`**: el aviso vive dentro del cuadro, no en un toast que se desvanece |
| Los textos | «Tu contraseña», «Confirmar y guardar», y el aviso de por qué se pide |
| `flock` en el respaldo diario | **no se toma** — una sola vía de entrada y el dump tarda segundos |

---

## 8 · Cabos sueltos

- **`emiliano/feat/bootstrap-sin-password`** sigue en el remoto. Está 100 %
  fusionada, pero borrar una rama de un remoto compartido es una acción hacia
  fuera y por eso no se hizo:
  `git push emiliano --delete feat/bootstrap-sin-password`
- **El comentario de `DesbloqueoCambios.tsx`** afirma que al Dueño el botón «no
  le sale nunca», y en la pasada del 24/09 **le salió**. O el comentario miente o
  hay un caso que nadie previó. Sin investigar.
- **El contenedor del 5433** lo recreó un agente el 25/09 y ahora monta los
  `.sql` de otro árbol. Los datos están intactos: once bases, y `spaces` con sus
  dos tenants.
- **Una corrida de pruebas dio 1 fallo** justo después de una fusión, y las tres
  siguientes salieron verdes las 1913. No se identificó cuál. Probablemente
  inestabilidad del momento; **no está demostrado**, y por eso queda escrito.
