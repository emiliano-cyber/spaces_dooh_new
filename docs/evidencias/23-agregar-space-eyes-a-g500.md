# Agregar Space Eyes a g500 — guía para correr a mano

> Preparada el 2026-10-08. La corre **una persona**. Claude no hace `ssh`,
> `scp` ni nada contra servidores. Cada paso dice dónde se pega:
> **PowerShell** en tu máquina, o **bash** en la consola de g500
> (`142.93.113.106`). La consola web de DigitalOcean **se come el primer
> carácter** de cada pegado: por eso los bloques empiezan con `echo ok;`.
>
> Entrega del compañero: rama `feat/space-eyes-en-hijo-existente` (`7202c8b1`,
> sin fusionar) y su guía `infra/eyes/AGREGAR-A-UNA-INSTANCIA.md`. Archivos en
> `C:\Users\Server\Downloads\g500-alta-equipos-2026-10-08\g500-alta-equipos-2026-10-08\`.

## 0 · Lo que ya se revisó (08/10, sin tocar g500)

- `spaces-repo.tar.gz` es **idéntico** a la rama en toda la carpeta `infra/`.
  Los scripts vienen con finales de línea de Linux y el paquete **no trae
  secretos**: ni `.env` ni llaves ni `.git`.
- **Qué hace `agregar-eyes.sh`**:
  1. Respalda `/etc/space-os` y el sitio de nginx en `/root/respaldos/agregar-eyes-<fecha>`.
  2. Levanta la pila de Space Eye: MySQL, Redis, API, video y TURN.
  3. Agrega **una línea** `include` al sitio de nginx de g500.
  4. Escribe `SPACE_EYE_*` en `app.env` y **vuelve a crear el contenedor** de la app.
- **Lo que no toca:** la base de g500.
- **Si algo falla, se deshace solo:**
  - si `nginx -t` falla, regresa al sitio anterior;
  - si la app no responde, regresa al contenedor anterior.
- **Las rutas que se llevan los equipos no chocan con la app,** que vive bajo
  `/spaces-dooh`. Son `/api`, `/socket.io`, `/storage`, `/whep` y las
  descargas `/space-eye*.apk|json|tar.gz`, `/instalar-pi.sh` y
  `/SpaceEyeAgente.exe`.
- **Hay dos cosas que el script NO comprueba**, y las cubren §2 y §5:
  - que la app llegue de verdad al Space Eye desde su contenedor;
  - que haya memoria suficiente.

## 1 · Antes de empezar

- [ ] **Los agentes de Claude terminaron** y lo que haya que publicar ya está
      en `main`. Esto no depende de ellos, pero así no se cruzan dos cambios
      en g500 el mismo día.
- [ ] **No hay una actualización aprobada pendiente en g500**: en
      Administración → Actualizaciones no debe decir «Aprobaste…». En el paso 6
      el script recrea el contenedor de la app, y no conviene que coincida con
      una instalación.
- [ ] Es un momento de **poco uso**: la app de g500 se corta unos segundos.
- [ ] Tienes **30 minutos** para correrlo y comprobarlo.
- [ ] Ya sabes que esta es la **primera prueba con equipos reales** sobre la
      instancia de un cliente. El compañero lo ensayó en contenedores (su
      guía, «Ensayado (08-oct)»), no con un teléfono conectado a g500.

## 2 · Comprobaciones en g500 (bash) — si alguna falla, PARA

```bash
echo ok; grep DOCKER_OPCIONES_APP /etc/space-os/instancia.env
free -m
df -h / | tail -1
ufw status | head -8
ss -ltnu | grep -E ':(4200|8889|8554|8189|3478) ' || echo "puertos libres"
sudo -u postgres psql -d spaces -c "select version_instalada, aprobado_digest is not null as aprobada_pendiente from actualizaciones_instancia;"
```

| Qué mirar | Tiene que ser | Si no |
|---|---|---|
| `DOCKER_OPCIONES_APP` | contiene `--network host` | **PARA.** Con `--publish 127.0.0.1:3000:3000` la app, desde su contenedor, no alcanza `127.0.0.1:4200`, y el script diría «LISTO» con el módulo roto. Avísame |
| `free -m`, columna `available` | **≥ 1200** MB | **PARA.** La pila reserva ~1 GB (MySQL 400, API 350, Redis 80, video 80, TURN 64) junto a la app y la base del cliente |
| `df -h /`, columna `Avail` | ≥ 5 GB | Libera espacio antes (la imagen pesa ~100 MB, y la base de fotos crece) |
| `ufw status` | `inactive`, o permite 8554/tcp, 8189/udp y 3478 | Si está activo y no los permite, las fotos funcionan pero el **vivo** no: avísame y vemos qué abrir |
| puertos | `puertos libres` | **PARA.** El script se detendría solo, pero mejor saberlo antes |
| `aprobada_pendiente` | `f` | Espera a que se instale la versión aprobada |

## 3 · Copiar los archivos (PowerShell, en tu máquina)

Son binarios, así que el problema de CRLF de `update.sh` del 08/10 **no**
aplica.

```
ssh -i $HOME\.ssh\spaces_deploy root@142.93.113.106 "mkdir -p /root/eyes-entrega"
cd C:\Users\Server\Downloads\g500-alta-equipos-2026-10-08\g500-alta-equipos-2026-10-08
scp -i $HOME\.ssh\spaces_deploy space-eye.tar space-eye.apk spaces-repo.tar.gz root@142.93.113.106:/root/eyes-entrega/
```

## 4 · Correrlo (bash en g500)

```bash
echo ok; cd /root/eyes-entrega && sha256sum space-eye.tar space-eye.apk spaces-repo.tar.gz
```

Las tres huellas **tienen que ser exactamente** estas. Si alguna no coincide,
el archivo llegó roto o no es el revisado: **para**.

```
783db9bbdb21770e2dd0e777e9a21688ce704e59ad8a95e95d0f4a61ddef7841  space-eye.tar
894c6fb38a4aa887cd1464c815c520e3cbe3c8360e88c56b971a472c5d563cfd  space-eye.apk
7d024f456f2be86bab97b1ace9ce4752b2c3389a93e52cda0c5bf0d50577f064  spaces-repo.tar.gz
```

```bash
echo ok; mkdir -p /root/spaces-repo && tar xzf /root/eyes-entrega/spaces-repo.tar.gz -C /root/spaces-repo && cd /root/spaces-repo
bash infra/scripts/agregar-eyes.sh --dominio g500.space-os.io --owner g500 --imagen-tar /root/eyes-entrega/space-eye.tar --apk /root/eyes-entrega/space-eye.apk 2>&1 | tee /root/agregar-eyes-$(date +%Y%m%d-%H%M).log
```

Tiene que terminar en `== LISTO` y anotar la ruta del respaldo. **Copia esa
ruta.** Si termina en `FALLA:`, no reintentes: pégame el log
(`/root/agregar-eyes-*.log`).

## 5 · Comprobar que de verdad funciona (bash en g500)

El script solo mira que la app responda. Esto mira que **la app hable con su
Space Eye**:

```bash
echo ok; docker exec space-os node -e "fetch('http://127.0.0.1:4200/api/app/version').then(r=>console.log('desde la app:',r.status)).catch(e=>console.log('NO LLEGA:',e.message))"
curl -s -o /dev/null -w "dominio -> space eye: %{http_code}\n" https://g500.space-os.io/api/app/version
curl -s -o /dev/null -w "la app sigue: %{http_code}\n" https://g500.space-os.io/spaces-dooh/api/version
curl -s -o /dev/null -w "panel NO publicado: %{http_code}\n" https://g500.space-os.io/index.html
curl -s -o /dev/null -w "apk: %{http_code}\n" https://g500.space-os.io/space-eye.apk
docker ps --format '{{.Names}}  {{.Status}}' | grep -E 'space-os|space-eyes'
free -m | head -2
```

| Línea | Tiene que dar |
|---|---|
| `desde la app` | **200 o 401**. Si dice `NO LLEGA`, el módulo no funciona aunque el script dijera LISTO: avísame |
| `dominio -> space eye` | 200 o 401 |
| `la app sigue` | **200** |
| `panel NO publicado` | 404 (o la redirección de siempre), nunca la página de Space Eye |
| `apk` | 200 |
| `docker ps` | `space-os` y los contenedores `space-eyes-*` en `Up` (o `healthy`) |
| `free -m` | `available` arriba de ~200 MB |

Y en la pantalla, con un usuario Dueño de g500:

1. **Space Eyes** ya **no** muestra la demostración. Si la sigue mostrando, la
   licencia trae el módulo apagado: actívalo desde el **PADRE** (§6).
2. Space Eyes → **Agregar dispositivo → Teléfono**: sale un QR.
3. En un teléfono de prueba, instala `https://g500.space-os.io/space-eye.apk`,
   escanea el QR y comprueba que el equipo aparece en la lista a nombre de
   g500 y manda una foto.

## 6 · Solo si el módulo sale apagado (bash en el PADRE)

```bash
echo ok; cd /var/www/Spaces && node apps/flota/modulo.mjs --instancia g500 --activar space-eyes
```

La licencia nueva llega a g500 en su siguiente `--comprobar`, en 15 minutos o
menos. Después recarga Space Eyes.

## 7 · Si algo sale mal

| Qué pasa | Qué hacer |
|---|---|
| El script termina en `FALLA:` | Ya regresó solo lo que había tocado (lo dice el mensaje). **No reintentes**: pégame el log |
| `desde la app: NO LLEGA` | La app sirve igual que antes, solo Space Eyes falla. **No toques nada**: pégame la salida de §2 y §5 |
| La app de g500 no carga después del LISTO | `docker ps -a`. Si existe `space-os-antes-eyes-*`, el rescate es `docker rm -f space-os && docker rename space-os-antes-eyes-<sello> space-os && docker start space-os`, y `cp /root/respaldos/agregar-eyes-<fecha>/space-os/app.env /etc/space-os/app.env`. Avísame antes, si puedes |
| La memoria baja de ~200 MB libres | Apaga Space Eye sin tocar la app: `docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env stop` (el mismo comando que usa `update-eyes.sh:82`), y avísame |

Lo que la app ve de Space Eyes se apaga quitando de `/etc/space-os/app.env`
las tres líneas `SPACE_EYE_*` y recreando el contenedor con `update.sh`. Es
lo mismo que tenía g500 antes de esto.

## 8 · Al terminar

- [ ] Pásame la salida de §5 y la ruta del respaldo, y lo anoto en la bitácora.
- [ ] La rama del compañero **sigue sin fusionar**. Además de lo de g500, cambia
      el alta de instancias nuevas (`instalar-hijo.sh`, `provision-instancia.sh`)
      y la plantilla de nginx. Esa parte se revisa aparte antes de que entre a
      `main`.
