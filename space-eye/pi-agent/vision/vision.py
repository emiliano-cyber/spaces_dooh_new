# vision.py — Puntos ORB: sacarlos, compararlos y guardarlos. Lo comparten el
# reconocedor de creativos y la revision de la camara.
#
# Port de android/.../pantalla/Vision.kt. Mismos parametros, medidos con fotos
# reales el 23-sep-2026 (ver reconocedor.py): 800 puntos, CLAHE 3.0 en 4x4,
# prueba de Lowe a 0.8, homografia RANSAC a 6 px.
import math
import struct

import cv2
import numpy as np

PUNTOS = 800


class Rasgos:
    """Puntos de una imagen en gris: posiciones (x0, y0, x1, y1...) y descriptores."""

    def __init__(self, xy, desc):
        self.xy = np.asarray(xy, dtype=np.float32).reshape(-1)
        if desc is None:
            desc = np.zeros((0, 32), dtype=np.uint8)
        self.desc = np.ascontiguousarray(desc, dtype=np.uint8).reshape(-1, 32)

    @property
    def n(self):
        return self.desc.shape[0]


# Se crean una sola vez, como los `by lazy` del telefono.
_orb = None
_emparejador = None
_clahe = None


def _herramientas():
    global _orb, _emparejador, _clahe
    if _orb is None:
        _orb = cv2.ORB_create(PUNTOS)
        _emparejador = cv2.BFMatcher(cv2.NORM_HAMMING)
        _clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    return _orb, _emparejador, _clahe


def rasgos(gris, mascara=None):
    """mascara: si se da, solo se buscan puntos donde vale 255."""
    orb, _, clahe = _herramientas()
    ecualizada = clahe.apply(gris)
    kp, desc = orb.detectAndCompute(ecualizada, mascara)
    if desc is None or not kp:
        return Rasgos(np.zeros(0, np.float32), None)
    xy = np.array([c for p in kp for c in p.pt], dtype=np.float32)
    return Rasgos(xy, desc)


def _pares(a, b):
    """Las parejas que pasan la prueba de Lowe: el mejor candidato tiene que
    ganarle claramente al segundo; si no, el punto es ambiguo (texturas
    repetidas del LED)."""
    _, emparejador, _ = _herramientas()
    src = []
    dst = []
    for d in emparejador.knnMatch(a.desc, b.desc, k=2):
        if len(d) == 2 and d[0].distance < 0.8 * d[1].distance:
            q = d[0].queryIdx
            t = d[0].trainIdx
            src.append((float(a.xy[2 * q]), float(a.xy[2 * q + 1])))
            dst.append((float(b.xy[2 * t]), float(b.xy[2 * t + 1])))
    return src, dst


def coincidencias(a, b):
    """Puntos que coinciden y guardan la misma geometria, el menor de los dos sentidos."""
    _, n1 = transformacion(a, b)
    if n1 == 0:
        return 0
    _, n2 = transformacion(b, a)
    return min(n1, n2)


def transformacion(a, b):
    """La homografia que lleva los puntos de `a` a los de `b` y cuantos puntos la
    respaldan. (None, n) si no hay suficientes coincidencias."""
    if a.n < 8 or b.n < 8:
        return None, 0
    src, dst = _pares(a, b)
    if len(src) < 8:
        # Igual que el telefono: con pocas parejas devuelve un cuarto de ellas.
        return None, len(src) // 4
    try:
        h, mascara = cv2.findHomography(np.float32(src).reshape(-1, 1, 2), np.float32(dst).reshape(-1, 1, 2),
                                        cv2.RANSAC, 6.0)
    except cv2.error:
        return None, 0
    if h is None or mascara is None:
        return None, 0
    return h, int(cv2.countNonZero(mascara))


def desplazamiento(a, b):
    """
    Cuanto se movieron de verdad los puntos que coinciden entre dos escenas: la
    mediana del desplazamiento de los que respaldan la homografia, en pixeles.
    Devuelve (puntos, desplazamiento).

    Se mide en los PUNTOS y no extrapolando la homografia a otro lugar: en la
    escena del telefono de pruebas casi todos los puntos estaban en el
    escritorio, abajo, y la pantalla arriba. Llevar la homografia hasta las
    esquinas de la pantalla convertia un 0.7% real en un 5.1% y daba "camara
    movida" sin que nadie la tocara (28-sep).
    """
    if a.n < 8 or b.n < 8:
        return 0, 0.0
    src, dst = _pares(a, b)
    if len(src) < 8:
        return 0, 0.0
    try:
        h, mascara = cv2.findHomography(np.float32(src).reshape(-1, 1, 2), np.float32(dst).reshape(-1, 1, 2),
                                        cv2.RANSAC, 6.0)
    except cv2.error:
        return 0, 0.0
    if h is None or mascara is None:
        return 0, 0.0
    dentro = mascara.reshape(-1)
    movs = sorted(math.hypot(dst[i][0] - src[i][0], dst[i][1] - src[i][1])
                  for i in range(len(src)) if dentro[i] != 0)
    if not movs:
        return 0, 0.0
    return len(movs), movs[len(movs) // 2]


# El archivo tiene el mismo formato que el del telefono (DataOutputStream de
# Java, todo big-endian): n, luego 2n floats de posiciones, luego n*32 bytes de
# descriptores. Asi un catalogo se puede llevar de un equipo a otro.

def escribir(ruta, r):
    with open(ruta, "wb") as o:
        o.write(struct.pack(">i", r.n))
        o.write(r.xy.astype(">f4").tobytes())
        o.write(r.desc.tobytes())


def leer(ruta):
    try:
        with open(ruta, "rb") as i:
            datos = i.read()
        (n,) = struct.unpack_from(">i", datos, 0)
        if n < 0:
            return None
        fin_xy = 4 + n * 8
        if len(datos) < fin_xy + n * 32:
            return None
        xy = np.frombuffer(datos, dtype=">f4", count=n * 2, offset=4).astype(np.float32)
        desc = np.frombuffer(datos, dtype=np.uint8, count=n * 32, offset=fin_xy).reshape(n, 32).copy()
        return Rasgos(xy, desc)
    except Exception:
        return None
