# Runbook · actualizar una instancia

**La instancia jala. El padre no empuja.**

Nadie entra por SSH a una instancia a compilar código. Ni una persona, ni un
workflow. Esa era la forma vieja y se retiró el **2026-08-31** (F3.6, junto con
`.github/workflows/deploy.yml`).

## Cómo llega una versión nueva

1. Un tag `vX.Y.Z` dispara `release.yml`: suite completa → imagen → canal **`beta`**.
2. `promover.yml`, a mano, valida en DEMO y reetiqueta esa **misma** imagen como
   **`estable`**. No reconstruye: el binario que corre un owner es, byte por byte,
   el que se probó.
3. Cada instancia corre `update.sh` por `cron` (F3.4): compara el canal que dice su
   `instancia.env`, jala la imagen si cambió, respalda, migra y comprueba salud. Si
   algo falla, vuelve atrás sola y se queda en la versión anterior.

## Lo único que la imagen NO trae: el propio `update.sh`

*Anotado el 2026-09-22, al encontrarlo en la revisión final del ADR 0037.*

`update.sh` actualiza **el contenedor, no a sí mismo**. Vive en el **anfitrión**
(`/opt/space-os/update.sh`) y **nada lo actualiza solo**: solo lo escriben
`infra/scripts/instalar-hijo.sh` y `infra/scripts/provision-instancia.sh`, o sea
en un alta o un aprovisionamiento. Todo lo demás —la aplicación, las migraciones,
`scripts/`— viaja dentro de la imagen y llega solo.

**Consecuencia:** cualquier cambio en `update.sh` (una bandera nueva, un paso
nuevo) **no llega a las instancias que ya existen** por sí mismo. Hay que
copiarlo, y el `case` del parseo **rechaza lo que no conoce**, así que una
instancia con el `update.sh` viejo responde a una bandera nueva con `exit 1`.

```bash
scp infra/scripts/update.sh root@<IP>:/opt/space-os/update.sh
ssh root@<IP> 'chown root:root /opt/space-os/update.sh; chmod 750 /opt/space-os/update.sh'
ssh root@<IP> '/opt/space-os/update.sh --dry-run'   # no toca nada, y confirma que arranca
```

Es exactamente lo que hace el alta; a mano solo para las instancias que nacieron
antes del cambio.

## Qué hace una persona

**Nada, en el caso normal.** Y si hay que forzarlo, se entra a la instancia y se
corre su propio actualizador — no se le empuja nada desde fuera:

```bash
/opt/space-os/update.sh --dry-run   # cuenta qué haría
/opt/space-os/update.sh             # lo hace
```

## Lo único que sigue entrando por SSH

**El alta**, y una sola vez: `infra/scripts/provision-instancia.sh` (F5.4), que
corre desde la máquina del operador y deja la instancia lista salvo el DNS del
owner. Después de eso, la instancia se gobierna sola.

## Por qué se retiró el camino viejo

`deploy.yml` entraba por SSH, construía **en el servidor** y recargaba con `pm2`.
Tres razones para que no exista:

- **Construir en el servidor no da el mismo binario dos veces** — el motivo del
  registry (ver `docs/evidencias/registry-TH-P4b.txt`).
- **Ya no había un servidor al que apuntar**: el droplet que era su destino salió
  del modelo (ADR 0023).
- **Se había vuelto peligroso**: hacía `pm2 reload spaces-web`, y desde el
  2026-08-28 el puerto 3000 lo sirve **systemd**. Dispararlo habría puesto a pm2 a
  pelearse con systemd por el puerto.

Detalle completo en `vault/01-Arquitectura/entorno-y-despliegue.md`.
