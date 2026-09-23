# Space Eye V2 — subirla sin tocar la que la gente usa

La V1 está en producción y hay gente trabajando con ella. V2 se levanta **al
lado**: otros contenedores, otros volúmenes, otros puertos y otra base de datos.
Producción no se reinicia ni se modifica en ningún paso.

Al terminar:

```
http://159.203.188.58:4000        V1 — la de siempre. Los equipos en campo
                                  siguen entrando aquí, sin enterarse.
https://eyes.g500.space-os.io     V2 — lo nuevo, con una copia de los datos.
```

---

## Antes de empezar

- Nadie entra por SSH con contraseña de root para esto. Autoriza una llave.
- El respaldo **no es opcional** y el script se niega a seguir si sale mal.
- Todo se corre desde una copia del repositorio en el droplet.

## Los tres pasos

```bash
# 1. RESPALDAR. No modifica nada: solo lee.
bash infra/deploy/v2/respaldo.sh
#    -> /root/respaldos/space-eye-<fecha>/  con base, fotos, .env y MANIFIESTO

# 2. LEVANTAR V2 en paralelo, con una copia de los datos de producción.
bash infra/deploy/v2/desplegar-v2.sh /root/respaldos/space-eye-<fecha>

# 3. APUNTAR EL DOMINIO a V2 (Apache; ver el runbook de arquitectura §6)
cp infra/apache/eyes.g500.space-os.io.conf /etc/apache2/sites-available/
certbot certonly --apache -d eyes.g500.space-os.io
a2ensite eyes.g500.space-os.io
apache2ctl configtest && systemctl reload apache2
```

**`configtest` antes de recargar no es adorno**: en ese Apache vive también
`market.adavailable.com`, que es de otro cliente. Un vhost con un error deja
Apache sin arrancar y se lleva los dos por delante.

## Qué comprueba cada script, y por qué

`respaldo.sh` no se fía de que el volcado exista: cuenta las tablas, comprueba
que estén `devices`, `photos`, `commands`, `device_status` y `api_keys`, y que el
archivo termine en `Dump completed` —así se detecta un volcado cortado a la
mitad, que es como se descubre que un respaldo no servía: el día que hace falta—.

`desplegar-v2.sh` se niega a empezar si producción no está sana, comprueba que
los puertos de V2 estén libres antes de levantar nada, y al final mira **las
dos**: que V2 responda y, sobre todo, **que producción siga respondiendo**. Si
producción cayera, lo dice en rojo y te da el comando para apagar V2.

## Las migraciones se ensayan sobre la copia

V2 nace con la base vacía y el script le carga el volcado de producción; las
migraciones nuevas (015, 016, 017 y las que sigan) corren **sobre esa copia**.
Es la única forma de saber que una migración funciona con los datos de verdad
sin arriesgar los datos de verdad.

## Volver atrás

```bash
docker compose -p space-eye-v2 down          # se va V2 entera
docker compose -p space-eye-v2 down -v       # y también sus volúmenes
```

Producción no se tocó, así que no hay nada que restaurar. El respaldo está para
el caso improbable de que alguien toque V1 por error; el `MANIFIESTO.txt` de
cada respaldo lleva los comandos exactos.

## Cuando V2 pase a ser la buena

1. En el vhost, cambiar `4100` → `4000` y `8989` → `8889`.
2. `docker compose -p space-eye-v2 down -v`.
3. Desplegar el código nuevo sobre la pila de producción, con su respaldo
   delante y sus migraciones —que para entonces ya se habrán ensayado aquí—.
