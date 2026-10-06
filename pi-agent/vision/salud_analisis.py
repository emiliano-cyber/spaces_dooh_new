# salud_analisis.py — Busca fallas en la pantalla a partir de UNA vuelta del loop.
#
# Port de android/.../pantalla/SaludAnalisis.kt: el MISMO calculo, con los
# mismos umbrales. Cualquier cambio aqui va acompañado del mismo cambio en el
# telefono y de las pruebas (pruebas/test_salud_analisis.py porta las del
# telefono caso por caso, con las mismas fotos).
"""
LA IDEA
-------
Una falla de pantalla se distingue del contenido por una sola cosa: NO cambia
cuando cambia el anuncio. El loop pasa una docena de creativos de ~20 s; un
gabinete muerto sigue negro con todos ellos, y un anuncio oscuro, una
transicion o un cambio de brillo no. Por eso esto nunca juzga una foto: juzga
una vuelta completa (~4 min, una toma cada 15 s) y pregunta, zona por zona,
que no cambio cuando todo lo demas si.

Todo es RELATIVO a como se porta una zona SANA en esa misma vuelta (el
percentil 75 de las zonas). Asi el sol de mediodia, que deslava la pantalla
entera, no dispara nada: baja a todas las zonas por igual.

Percentil 75 y no mediana: con la mediana, si se apaga MAS DE LA MITAD de la
pantalla la referencia cae en lo apagado, lo apagado parece "normal" y no se
detecta nada (prueba real del 25-sep-2026: 0 de 8 zonas). Con el percentil 75
se detecta hasta 2/3 de la pantalla apagada, sin falsas alarmas en las fotos
reales. Para lo que pase de ahi hay una regla absoluta: una zona casi negra que
no cambia en toda la vuelta esta apagada, sin comparar con nada.

Aqui no se decide si hay que avisar: eso lo hace Seguimiento, que exige que la
falla se repita en vueltas separadas. Esto solo dice que vio en UNA.
"""
import math
from dataclasses import dataclass, field
from enum import Enum

import numpy as np

from json_util import redondea


class Pantalla(Enum):
    OK = "OK"
    APAGADA = "APAGADA"
    CONGELADA = "CONGELADA"
    INCONCLUSO = "INCONCLUSO"


@dataclass(frozen=True)
class Zona:
    """grupo: si varios gabinetes fallan igual, UNA sola zona los agrupa (fila y
    columna valen -1): media pantalla apagada es una falla, no ocho."""
    tipo: str
    fila: int
    columna: int
    confianza: float
    grupo: tuple = field(default_factory=tuple)


class Resultado:
    def __init__(self, pantalla, vistazos, cambios, zonas, actividad=None, brillo=None):
        self.pantalla = pantalla
        self.vistazos = vistazos
        self.cambios = cambios
        self.zonas = zonas
        # Actividad y brillo de cada zona relativos a la referencia (fila x columna).
        self.actividad = actividad
        self.brillo = brillo


class Imagen:
    """Una toma enderezada de la pantalla, en gris. `px` va fila por fila."""

    def __init__(self, px, ancho, alto):
        self.px = np.asarray(px, dtype=np.float64).reshape(-1)
        self.ancho = ancho
        self.alto = alto
        self._m = self.px[: ancho * alto].reshape(alto, ancho)

    def matriz(self):
        return self._m

    def media(self):
        return float(self.px.mean())

    def desviacion(self):
        return float(self.px.std())


# Umbrales. Medidos, no inventados: ver la nota de arriba y SaludAnalisis.kt.
CAMBIO_MINIMO = 8.0          # diferencia media entre tomas seguidas para "cambio el contenido"
UNIFORME = 6.0               # una pantalla es "uniforme" (apagada) bajo esta desviacion
FRACCION_APAGADA = 0.8       # fraccion de tomas uniformes para decir "apagada"
CAMBIOS_PARA_ZONAS = 4       # con menos cambios de contenido, no se juzgan las zonas
APAGADA_BRILLO = 0.35
APAGADA_ACTIVIDAD = 0.25
# Zona congelada o tapada: no esta oscura, pero casi no cambia mientras el resto
# si. Desde la camara no se distingue un gabinete congelado en blanco de algo
# puesto enfrente, y las dos cosas hay que verlas. Las zonas sanas reales no
# bajan de 0.26.
CONGELADA_ACTIVIDAD = 0.15
MARGEN = 0.15                # margen de cada zona que no se mira (el marco del vecino)
NEGRO_BRILLO = 40.0          # regla absoluta de zona apagada: casi negra...
NEGRO_ACTIVIDAD = 2.5        # ...y sin ningun cambio
AGRUPAR_DESDE = 3            # desde cuantos gabinetes con la misma falla se agrupan


def analizar(tomas, filas, columnas, excluir=frozenset()):
    """
    excluir: zonas que no se juzgan: tapadas (una barda, un arbol) o que se sabe
    que no cambian. Las aprende Seguimiento en las primeras vueltas.
    """
    n = len(tomas)
    if n < 2:
        return Resultado(Pantalla.INCONCLUSO, n, 0, [])

    cambios = 0
    for k in range(1, n):
        if _diferencia(tomas[k], tomas[k - 1], filas, columnas) > CAMBIO_MINIMO:
            cambios += 1
    uniformes = sum(1 for t in tomas if t.desviacion() < UNIFORME) / n

    if uniformes >= FRACCION_APAGADA:
        return Resultado(Pantalla.APAGADA, n, cambios, [])
    if cambios == 0 and n >= 6:
        return Resultado(Pantalla.CONGELADA, n, cambios, [])
    if cambios < CAMBIOS_PARA_ZONAS:
        return Resultado(Pantalla.INCONCLUSO, n, cambios, [])

    # Por zona: brillo medio en cada toma, y la textura (desviacion) maxima.
    medias = [[[0.0] * n for _ in range(columnas)] for _ in range(filas)]
    textura = [[0.0] * columnas for _ in range(filas)]
    for k, t in enumerate(tomas):
        for f in range(filas):
            for c in range(columnas):
                m, s = _zona(t, f, c, filas, columnas)
                medias[f][c][k] = m
                if s > textura[f][c]:
                    textura[f][c] = s
    maximo = [[max(medias[f][c]) for c in range(columnas)] for f in range(filas)]
    actividad = [[std(medias[f][c]) for c in range(columnas)] for f in range(filas)]

    validas = [(f, c) for f in range(filas) for c in range(columnas) if (f, c) not in excluir]
    if len(validas) < 2:
        return Resultado(Pantalla.INCONCLUSO, n, cambios, [])
    ref_max = percentil([maximo[f][c] for f, c in validas], 0.75)
    ref_act = max(percentil([actividad[f][c] for f, c in validas], 0.75), 1e-6)

    rel_act = [[actividad[f][c] / ref_act for c in range(columnas)] for f in range(filas)]
    rel_max = [[(maximo[f][c] / ref_max if ref_max > 0 else 0.0) for c in range(columnas)] for f in range(filas)]

    zonas = []
    for f, c in validas:
        r_max = rel_max[f][c]
        r_act = rel_act[f][c]
        if r_max < APAGADA_BRILLO and r_act < APAGADA_ACTIVIDAD:
            # La confianza sale de que NO cambie, que es lo que distingue una falla.
            zonas.append(Zona("zona_apagada", f, c, redondea(1 - r_act / APAGADA_ACTIVIDAD)))
        elif maximo[f][c] < NEGRO_BRILLO and actividad[f][c] < NEGRO_ACTIVIDAD:
            zonas.append(Zona("zona_apagada", f, c, 0.9))
        elif r_act < CONGELADA_ACTIVIDAD:
            zonas.append(Zona("zona_congelada", f, c, redondea(1 - r_act / CONGELADA_ACTIVIDAD)))
    return Resultado(Pantalla.OK, n, cambios, _agrupar(zonas), rel_act, rel_max)


def _agrupar(zonas):
    """Tres o mas gabinetes con la misma falla son UNA falla con su lista."""
    por_tipo = {}
    for z in zonas:
        por_tipo.setdefault(z.tipo, []).append(z)
    out = []
    for tipo, del_tipo in por_tipo.items():
        if len(del_tipo) >= AGRUPAR_DESDE:
            confianza = redondea(sum(z.confianza for z in del_tipo) / len(del_tipo))
            out.append(Zona(tipo, -1, -1, confianza, tuple((z.fila, z.columna) for z in del_tipo)))
        else:
            out.extend(del_tipo)
    return out


def tramo_mas_largo(sesiones):
    """
    El tramo seguido mas largo de una vuelta: las posiciones de los vistazos
    tomados en la MISMA sesion de camara. Si empatan, el ultimo.

    Hace falta porque la camara fija la exposicion al abrirse, y si a mitad de
    la vuelta alguien abre la vista en vivo o pide una foto, al reabrirse la
    fija a OTRO nivel. Una zona tapada que no cambia salta de brillo de un tramo
    al otro y parece "activa". Solo se juzga con el tramo mas largo; nunca se
    mezclan dos exposiciones.
    """
    if not sesiones:
        return range(0)
    mejor = range(0, 1)
    inicio = 0
    for i in range(1, len(sesiones) + 1):
        if i == len(sesiones) or sesiones[i] != sesiones[i - 1]:
            if i - inicio >= len(mejor):
                mejor = range(inicio, i)
            inicio = i
    return mejor


def percentil(v, p):
    """Percentil con interpolacion lineal (igual que numpy.percentile)."""
    s = sorted(v)
    if len(s) == 1:
        return s[0]
    pos = p * (len(s) - 1)
    k = int(pos)
    frac = pos - k
    return s[k] + (s[k + 1] - s[k]) * frac if k + 1 < len(s) else s[k]


def _zona(t, f, c, filas, columnas):
    y0 = int((f + MARGEN) * t.alto / filas)
    y1 = int((f + 1 - MARGEN) * t.alto / filas)
    x0 = int((c + MARGEN) * t.ancho / columnas)
    x1 = int((c + 1 - MARGEN) * t.ancho / columnas)
    sub = t.matriz()[y0:max(y1, y0 + 1), x0:max(x1, x0 + 1)]
    n = sub.size
    suma = float(sub.sum())
    suma2 = float((sub * sub).sum())
    m = suma / n
    return m, math.sqrt(max(0.0, suma2 / n - m * m))


def _diferencia(a, b, filas, columnas):
    """
    Cuanto cambio el contenido entre dos tomas: la diferencia media de la ZONA
    que mas cambio. No de la imagen entera: con media pantalla (o mas) apagada,
    el cambio de anuncio solo se ve en lo que sigue vivo, y el promedio de toda
    la imagen apenas se mueve.
    """
    if a.px.size != b.px.size:
        return float("inf")
    ma = a.matriz()
    mb = b.matriz()
    mayor = 0.0
    for f in range(filas):
        y0 = f * a.alto // filas
        y1 = max(y0 + 1, (f + 1) * a.alto // filas)
        for c in range(columnas):
            x0 = c * a.ancho // columnas
            x1 = max(x0 + 1, (c + 1) * a.ancho // columnas)
            d = np.abs(ma[y0:y1, x0:x1] - mb[y0:y1, x0:x1])
            if d.size > 0:
                m = float(d.mean())
                if m > mayor:
                    mayor = m
    return mayor


def std(v):
    v = list(v)
    m = sum(v) / len(v)
    return math.sqrt(sum((x - m) * (x - m) for x in v) / len(v))


def mediana(v):
    s = sorted(v)
    k = len(s) // 2
    return s[k] if len(s) % 2 == 1 else (s[k - 1] + s[k]) / 2
