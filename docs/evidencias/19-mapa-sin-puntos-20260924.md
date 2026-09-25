# El mapa no mostraba puntos — diagnóstico, arreglo y lo que se hizo en cada máquina

**Fecha:** 2026-09-24
**Commits:** `c542f06` (guard del mapa) · `a296438` (las dos fuentes del hueco)
**Síntoma reportado:** «el mapa no está saliendo correctamente en ninguna
pantalla» y «no sale ningún punto», **en el PADRE y en las instancias**.

---

## 1 · Lo que resultó ser, y no era una cosa sola

El síntoma era el mismo en todas las máquinas, lo que apuntaba a código. Lo era
a medias: **había un defecto de código y, debajo, un hueco de datos que el
defecto volvía invisible.**

### El defecto de código

`apps/web/lib/server/sitios-repo.ts:44-45`:

```ts
lat: n(r.lat) ?? 0,
lng: n(r.lng) ?? 0,
```

Una pantalla sin coordenadas sale de la base como `NULL` y llegaba a la interfaz
como **`0`**. Cero es un número finito, así que pasaba el filtro
`Number.isFinite` de `MapView.tsx:210` y **se dibujaba en el (0,0)** — mar
abierto en el golfo de Guinea.

**Lo caro no era el pin perdido.** `focoDensidad` (`MapView.tsx:92`) busca el
cúmulo más denso para auto-enfocar; lo encontraba en el Atlántico y
**encuadraba el mapa ahí**. Un inventario sin coordenadas no daba un mapa
vacío: daba un mapa que parecía averiado.

> La regla de descartar el `(0,0)` **ya existía** en
> `apps/web/lib/predio-cercania.ts:92-98`, escrita para validar la cercanía al
> predio. Nunca había llegado al mapa. El defecto no fue no saber la regla: fue
> tenerla en un solo sitio.

### El hueco de datos, medido

| Base | Medición | Resultado |
|---|---|---|
| `spaces_prod` (PADRE) | `select count(*) … sitios` | **1 sitio**, con coordenadas |
| `spaces_demo` (prueba) | idem | 6 sitios, **todos sin coordenadas** |

**En el PADRE el `(0,0)` nunca fue el problema**: había una sola pantalla y sí
sabía dónde estaba. El mapa dibujaba el único punto que existía. Lo que faltaba
ahí era inventario, no código — y eso solo se supo al medir, después de haber
dado por hecho lo contrario.

---

## 2 · Las tres fuentes del hueco

Una pantalla nace por tres caminos y cada uno hacía algo distinto:

| Camino | Antes | Ahora |
|---|---|---|
| Carga masiva CSV | default + **marca de pendiente** + aviso | **igual** — ya era correcto |
| Alta manual (`NuevaPantallaForm.tsx:126-127`) | `Number(lat) \|\| 19.4326` → **Zócalo en silencio** | **exige latitud y longitud** |
| `scripts/semilla-demo.mjs` | **no sembraba coordenadas** | las seis las traen |

**El alta manual era el peor de los tres.** No dejaba un hueco: dejaba una
pantalla en el Zócalo **sin marca de pendiente**, indistinguible de una que de
verdad está ahí. Un dato inventado que parece real no lo detecta nadie.

**La carga masiva sigue sin exigirlas, a propósito.** Un Excel de cien filas
rara vez las trae y bloquearlo sería fricción sin motivo; por eso ahí el default
va acompañado de `pendienteVerificacion`
(`apps/web/lib/inventario-import.ts:211-218`), que es lo que permite encontrar
la fila después. Dando de alta UNA pantalla tienes la dirección delante.

---

## 3 · El arreglo

- **`apps/web/lib/coordenadas.ts`** (nuevo) — `puntoUtil()`: la definición única
  de «esta ubicación sirve». Descarta nulos, el `(0,0)` y lo que cae fuera del
  rango terrestre. Un cero *solo* se respeta: el ecuador y Greenwich existen.
- **`MapView.tsx`** — la usa en el filtro de pines y en el auto-enfoque, y añade
  una etiqueta con **cuántas pantallas quedaron fuera por no tener ubicación**.
  El hueco se ve; antes se lo tragaba.
- **`NuevaPantallaForm.tsx`** — coordenadas obligatorias, con el mensaje en el pie.
- **`scripts/semilla-demo.mjs`** — las seis pantallas con coordenadas, y los dos
  pares que comparten predio (`PRE-VIA`, `PRE-INS`) a **~60 m**: dentro de
  `RADIO_PREDIO_M` (250 m), o la semilla generaría justo el dato que
  `pantallasFueraDelGrupo` marca como sospechoso.
- **`predio-cercania.ts`** — solo un comentario que apunta al módulo compartido.
  Unificarlo toca el reparto de la renta: no se hace de paso.

### Verificación

- `tsc --noEmit` limpio.
- **1835 pruebas en 141 archivos en verde** (eran 1831 antes de este trabajo).
- **11 pruebas nuevas**: 7 sobre `puntoUtil`, 4 sobre la semilla.
- **Dos reglas comprobadas por mutación**: quitar el descarte del `(0,0)` tumba
  su prueba; cambiar `s.lat, s.lng` por constantes tumba la del `INSERT`.

> [!warning] Una de esas pruebas nació floja y hay que contarlo
> La del `INSERT` afirmaba primero «viaja algún número», y **el mutante
> sobrevivió**: sustituir `s.lat, s.lng` por dos constantes la pasaba. Apretada
> a comparar la coordenada DE ESA pantalla, el mutante muere. Una aserción floja
> es peor que ninguna: ocupa el sitio de la que haría falta, y da verde.

---

## 4 · Lo que se hizo en cada máquina

| Máquina | Qué se hizo | Estado |
|---|---|---|
| **PADRE** (`137.184.107.53`) | `git pull` de `c542f06` y `a296438`, `npm run build`, `systemctl restart spaces-web` | **Hecho.** `active` y `/api/version/` a `200` |
| **PADRE · datos** | Carga masiva de `carga-digitales-demo.csv` y `carga-masiva-demo.csv` en `rgb`, por la aplicación | **Hecho por el dueño.** Sube de 1 a ~24 pantallas |
| **prueba / DEMO** (`spaces_demo`) | Carga del CSV de digitales | **Hecho.** El dueño confirma que el mapa ya muestra pantallas |
| **prueba · coordenadas** | `update sitios … where clave_interna = …` para las seis de la semilla | **Se entregó el comando; su ejecución NO está confirmada.** Con la semilla arreglada deja de hacer falta en bases nuevas |
| **Hijos** (g500 y demás) | **Nada.** Corren desde la imagen | **Pendiente:** necesitan versión nueva + promoción a `estable` |

> [!danger] Los hijos NO tienen el arreglo de código
> `c542f06` y `a296438` llegaron al PADRE por `git pull` porque el PADRE corre
> desde el árbol (`spaces-web.service:83`). Las instancias corren **desde la
> imagen**: les llega con `release.yml` + `promover.yml` y cuando cada una tome
> la versión (ADR 0037).
>
> **No es urgente**, y el motivo importa: el síntoma solo aparece si hay
> pantallas sin coordenadas. Donde los datos están completos, el `(0,0)` no
> existe. Lo que sí les falta desde ya es el bloqueo del alta manual, que es lo
> que impide que el hueco vuelva a abrirse.

---

## 5 · Lo que queda abierto

- **D10 en `docs/Supervision/ABIERTOS.md`** — `sitios-repo.ts:44-45` sigue
  devolviendo `0` en vez de `null`. Hoy lo tapa el guard del mapa, pero el dato
  falso se sigue produciendo y cualquier consumidor nuevo se lo creerá. La
  corrección de raíz arrastra `Sitio.lat` a `number | null` en ~16 sitios.
- **Unificar `predio-cercania.ts:92-98` con `puntoUtil`** — misma regla
  duplicada. Toca el reparto de la renta: va con las e2e delante.
- **Publicar una versión para la flota**, cuando toque.

## 6 · Lo que NO se verificó

- **Cuántas filas tienen `lat = 0 and lng = 0` grabado** en las bases de los
  hijos. Solo se midió `spaces_prod` y `spaces_demo`.
- **El resultado visual del alta manual con los campos vacíos** — el bloqueo
  está probado por tipos y por `valido`, pero nadie lo ha visto en un navegador.
- **Si el `update` de coordenadas de `spaces_demo` llegó a correrse.** El dueño
  cargó el CSV, que trae las suyas; las seis de la semilla pueden seguir sin
  ubicación en esa base.
