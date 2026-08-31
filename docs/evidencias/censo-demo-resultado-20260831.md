---
Para: quien siga con F2.4 y F3.5
De: el censo del 2026-08-31 en el PADRE (137.184.107.53)
Método: ocho lecturas, ninguna escribe. Tarjeta: `censo-demo-en-el-padre.txt`
---

# Censo de DEMO en el PADRE — resultado

**La revisión del 31/08 queda confirmada punto por punto**, y aparecen tres datos
que no estaban en el repositorio.

## Lo confirmado

```
spaces-demo  ExecStart=/usr/local/bin/node .../next start -p 3001
             User=demo    EnvironmentFile=/etc/space-os/demo.env
spaces-web   ExecStart=/usr/local/bin/node .../next start -p 3000
             User=padre   EnvironmentFile=/etc/space-os/padre.env
BUILD_ID     padre:padre, 29 ago 00:28  ·  uno solo, compartido
3001 /login/ -> 200      3000 /login/ -> 200
```

**Ninguno corre desde una imagen.** Los dos salen del mismo `/var/www/Spaces`. La
deducción que se hizo leyendo `infra/systemd/spaces-demo.service:77` era correcta.

## Lo nuevo

### ① Docker no está instalado

```
docker --version  ->  Command 'docker' not found
```

Contenerizar DEMO **empieza por instalar Docker en el plano de control**. Eso no es
un paso de instalación: es una decisión de arquitectura, y **merece un ADR** antes
que una tarjeta. La alternativa que el propio modelo sugiere es que DEMO deje de
vivir dentro del PADRE y sea su propio droplet, como cualquier instancia.

### ② `instancia.env` existe, pero el actualizador no

```
/etc/space-os/  ->  demo.env · flota.env · instancia.env · padre.env
/opt/space-os/  ->  no existe
/etc/cron.d/    ->  sin cron de space-os
```

`instancia.env` (178 bytes, 28 ago 22:56) está ahí **sin `update.sh` que lo lea**.
La hipótesis razonable es que lo creó `respaldo.sh` en F3.7, que lee de ahí las
llaves de Spaces. **No está comprobado**: es un cabo suelto y hay que atarlo antes
de escribir sobre ese archivo.

### ③ nginx ya sirve `demo.space-os.io` en el PADRE

Aparece en dos bloques, aunque su DNS apunta a otra máquina. Es un resto anterior al
ADR 0024. **No se toca aquí**: retirarlo es otra tarea.

## La corrección que sale de esto

Antes se escribió que **F2.4 y F3.5 eran la misma tarea**. **No lo son**, y leer
`promover.yml:241-290` entero lo deja claro:

| | Qué exige de verdad |
|---|---|
| La compuerta dura | Dos códigos 200 — `/login/` y `/api/auth/metodos/` — sobre `https`. **Ningún contenedor** |
| La comprobación de versión | Solo se activa **si `FLOTA_TOKEN` está puesto como secreto del repositorio**. Sin él, el resumen escribe *«qué versión corre DEMO: NO COMPROBADO»* |

**F2.4 necesita únicamente que DEMO tenga un nombre público con `https`.** La que
necesita Docker es F3.5.

> [!danger] Y hay una trampa, medida
> `apps/web/app/api/version/route.ts:102` devuelve
> `version: process.env.SPACE_OS_VERSION ?? 'desconocida'`. Como DEMO corre desde el
> repo y no desde la imagen, **reportaría `'desconocida'`** — que **no es vacío**,
> así que el smoke lo compararía contra la versión que se promueve y **fallaría
> siempre**.
>
> Conclusión práctica: **mientras DEMO no esté contenerizada, `FLOTA_TOKEN` no debe
> existir como secreto de GitHub.** No es un rodeo: es lo que el propio workflow
> documenta —«hoy esto es informativo y mañana se vuelve estricto solo»— y el
> resumen de cada promoción deja escrito, con todas sus letras, que la versión no se
> comprobó.

## La decisión que se tomó con esto

**DEMO pasa a llamarse `prueba.space-os.io`** (Jochelo, 2026-08-31). Nombre nuevo,
no `demo.space-os.io`: ese quedó cerrado como la demostración original, que se
elimina.

El vhost va en `infra/nginx/space-os.io.conf`, que **está versionado y enlazado**
(`/etc/nginx/sites-enabled/spaces` → `/var/www/Spaces/infra/nginx/…`), así que el
cambio de configuración es un commit y el servidor solo hace `pull` y `reload`.

> [!warning] El orden no es negociable: DNS → certificado → vhost → reload
> El HSTS del ápice lleva `includeSubDomains` (bloque 3 del `.conf`, con su motivo
> escrito), que **obliga a HTTPS a todo subdominio de `space-os.io` durante dos
> años**. Un subdominio nuevo sin certificado **no queda roto: queda inaccesible**, y
> el navegador no deja saltárselo. Y antes de eso, nginx ni siquiera arrancaría: un
> `ssl_certificate` que apunta a un archivo inexistente hace fallar `nginx -t`, y
> entonces el `reload` no ocurre.
