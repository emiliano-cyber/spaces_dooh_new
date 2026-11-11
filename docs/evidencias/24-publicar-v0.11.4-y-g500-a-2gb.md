# Publicar v0.11.4 y subir g500 a 2 GB, para correr a mano

> Preparada el 2026-10-11 para la presentación del 14/10. La corre **una
> persona**: Claude no empuja, no etiqueta y no entra a servidores. Cada
> bloque dice dónde se pega: **PowerShell** en tu máquina, o **bash** en la
> consola del PADRE o de g500.
>
> La consola web de DigitalOcean **se come el primer carácter** de cada
> pegado, por eso los bloques empiezan con `echo ok;`.

> [!success] Resultado (12/10)
> `v0.11.4` instalada en g500 a las 05:45 UTC, aprobada por el dueño y probada en
> el navegador. **El §7 no se pudo hacer:** la región de g500 no tenía
> capacidad para cambiar a 2 GB. El §6 no hizo falta: el `update.sh` de g500
> ya estaba arreglado desde el 09/10. Detalle en
> `vault/07-Agentes/diario/2026-10-11.md`.

## 0 · Qué sale

| | |
|---|---|
| **Rama** | `integra/v0-11-4`, avance rápido sobre `main` (`3954e23f`) |
| **Trae** | `fix/space-eyes-fotos-rapidas` (miniaturas y GPS como número) y `fix/space-eyes-solicitudes-en-padre` (solicitudes en el PADRE), **sin** `conectar-g500/` |
| **Migraciones** | **0** |
| **Variables nuevas** | ninguna |
| **Verificado aquí** | typecheck limpio, **3674/3674** unitarias, build OK. Las e2e se anotan en §9 |
| **No verificado** | navegador, teléfono real, las e2e de Space Eyes (se saltan sin un Space Eye real) |

**Ya se sabe y se acepta:**
- **«Tomar foto» puede parpadear** mientras espera la foto nueva. Es el
  arreglo pendiente de José; si no lo entrega antes del 14, mejor no usar ese
  botón en la demo.
- `feat/space-eyes-en-hijo-existente` **no** va en esta versión.

## 1 · Subir a `main` (PowerShell)

```
cd C:\Users\Server\spaces_doohmain_nueva\.claude\worktrees\integra-eyes
git push emiliano integra/v0-11-4:main
```

Espera a que **`ci.yml` salga en verde** en GitHub → Actions, sobre ese commit.
Si sale en rojo, **para** y pega el error.

## 2 · Etiquetar (PowerShell, solo con CI en verde)

```
git tag v0.11.4 integra/v0-11-4
git push emiliano v0.11.4
```

Espera a que `release.yml` termine en verde: publica la imagen en `beta`.

## 3 · El PADRE (bash, consola del PADRE)

```bash
echo ok; cd /var/www/Spaces && git pull && git log --oneline -1
npm install && git checkout -- package-lock.json && npm run build && echo BUILD_OK
chown -R padre:padre apps/web/.next
systemctl daemon-reload
systemctl restart spaces-web
systemctl restart flota-panel
systemctl is-active spaces-web flota-panel
```

- `git log` tiene que mostrar el mismo commit que `git log --oneline -1 integra/v0-11-4` en tu máquina: el de la guía 24.
- **Si no sale `BUILD_OK`, no reinicies:** el PADRE sigue con lo de antes.
- **`flota-panel` se reinicia esta vez** porque cambió `apps/flota/servidor.mjs`
  (la ruta de solicitudes). Las dos líneas tienen que decir `active`.
- Para comprobarlo: entra al SPACE OS del PADRE → **Space Eyes**. Arriba sale
  la caja de solicitudes de activación, aunque esté vacía.

## 4 · DEMO toma `beta` (bash, en el PADRE)

```bash
echo ok; SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh --dry-run
SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh
tail -n 20 /var/log/space-os/update.log
```

Si DEMO está en modo aprobación, apruébala desde su panel de Actualizaciones y
vuelve a correr las líneas. Comprueba que entras y que Space Eyes abre. DEMO no
tiene celulares conectados, así que la prueba real es en g500.

## 5 · Promover a `estable`

GitHub → Actions → **Promover a estable** → versión `v0.11.4`. Guarda el
resumen del run: trae el `crane copy` para volver atrás.

## 6 · g500: que su actualizador funcione (bash, consola de g500)

Esto quedó pendiente desde el 09/10. Sin esto, g500 no ve ninguna versión.

```bash
echo ok; sha256sum /opt/space-os/update.sh
```

- Si da `8672d6b797608ce2f71f538e8e261b27ec44b43b649302bd73633f15d913c816`,
  sigue al §7.
- Si da `6add877f…`, sigue con saltos de línea de Windows. Arréglalo y vuelve a
  medir:

  ```bash
  echo ok; sed -i 's/\r$//' /opt/space-os/update.sh
  sha256sum /opt/space-os/update.sh
  ```

## 7 · g500 a 2 GB (DigitalOcean + bash en g500)

**Corta g500 unos minutos.** Hazlo cuando el cliente no lo esté usando.

**7a · Antes (bash en g500):** anota lo que sale.
```bash
echo ok; free -m | head -2
docker ps --format '{{.Names}}  {{.Status}}'
```

**7b · En el panel de DigitalOcean:**
1. Droplets → **g500** → **Power** → **Turn off**.
2. **Resize** → **«CPU and RAM only»** (no el disco) → el plan de **2 GB** →
   **Resize**.
3. Cuando termine: **Power** → **Turn on**.

«CPU and RAM only» deja el disco igual, así que se puede volver a 1 GB si
hiciera falta. Si eliges también el disco, ya no se puede bajar.

**7c · Después (bash en g500):**
```bash
echo ok; free -m | head -2
docker ps --format '{{.Names}}  {{.Status}}'
curl -s -o /dev/null -w "la app: %{http_code}\n" https://g500.space-os.io/spaces-dooh/api/version
curl -s -o /dev/null -w "space eye: %{http_code}\n" https://g500.space-os.io/api/app/version
```

| Línea | Tiene que dar |
|---|---|
| `free -m`, columna `total` | ~**1,9xx** MB (antes ~9xx) |
| `docker ps` | `space-os` y los `space-eyes-*` en `Up`. Los dos tienen `restart: unless-stopped` y vuelven solos |
| `la app` | **200** |
| `space eye` | 200 o 401 |

Si los `space-eyes-*` no aparecen:
```bash
echo ok; docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env up -d
```

El swap de José (`/swapfile`) se queda: no estorba.

## 8 · g500 instala v0.11.4 (bash en g500 + panel)

```bash
echo ok; /opt/space-os/update.sh --comprobar; echo "codigo=$?"
sudo -u postgres psql -d spaces -c "select version_instalada, version_disponible, jsonb_array_length(notas_disponibles) as notas from actualizaciones_instancia;"
```

- Tiene que dar `codigo=0` (o 75) y `version_disponible = v0.11.4` con notas.
- Si g500 sigue en `v0.11.1`, salta directo a `v0.11.4` y se lleva también lo
  de `v0.11.2` y `v0.11.3`. No hay migraciones en ninguna.

En g500 → **Administración → Actualizaciones**: tienen que verse las notas.
**Aprueba.** En 15 minutos o menos se instala sola. Después:

1. El pie o Actualizaciones dice **v0.11.4**.
2. **Space Eyes** → la lista pinta las fotos al instante.
3. Abre el **celular real**: la ficha abre sin «Application error», con su
   ubicación, y sale **«En línea»**.
4. Una propuesta vieja enseña sus importes con coma y **el mismo total que
   antes**. Si venía de v0.11.1, guarda un importe y comprueba que se guardó
   igual que lo tecleaste.

## 9 · Vigilar y volver atrás

- **Vigila 1 hora** después de instalar.
- **Volver atrás si:**
  - falla el login;
  - no cargan Inicio, Propuestas o Finanzas;
  - un importe se guarda distinto de lo tecleado;
  - **Space Eyes deja de abrir**.

  Para volver: `crane copy` de `estable` a `v0.11.3` (está en el resumen del
  §5) y apruébala en g500. Sin migraciones, la base no se toca.
- **Arreglo hacia adelante (v0.11.5)** si solo es el parpadeo o algo visual.
- **Para la memoria:** si `free -m` baja de ~200 MB disponibles, apaga Space
  Eye sin tocar la app:

  ```bash
  echo ok; docker compose -p space-eyes -f /opt/space-os/eyes/docker-compose.yml --env-file /etc/space-os/eyes.env stop
  ```

**e2e de esta integración (11/10, 22:35 de México, 04:35 UTC del 12):** 938 pasan, 11 fallan. Una es `grants-rol-app`, que necesita Docker. Las otras 10 son de fechas (`codigo-promocional`, `estado-campanas` y `plazos-cobranza`) y fallan **igual en el `main` anterior** (`3954e23f`), así que no las causa esta versión. Corrieron cuando en México todavía era 11 y en UTC ya era 12.

## 10 · Al terminar

Pásame:
- la hora de instalación en g500 y quién aprobó;
- la salida del §7c y la huella del §6.

Con eso cierro el diario y el tablero.
