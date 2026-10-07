# revision_camara.py — ¿La camara sigue viendo lo mismo que cuando se marco la pantalla?
#
# Port de android/.../pantalla/RevisionCamara.kt.
"""
Hay que saberlo ANTES de juzgar la pantalla. Si alguien golpeo el poste o el
viento giro la camara, las esquinas marcadas ya no caen sobre la pantalla y
todo lo demas seria basura: un "gabinete apagado" que en realidad es cielo.

Se guarda como referencia la escena ENTERA (no solo la pantalla: la pantalla
cambia con cada anuncio, el edificio de al lado no). En cada vuelta se busca
como se movio la escena respecto a la referencia, y se mide cuanto se
desplazaron los puntos.

La escena de dia y de noche es muy distinta, asi que se guardan hasta
VARIANTES referencias. Si no se reconoce ninguna, la vuelta es INCONCLUSA y no
se acusa a nadie: solo se dice "camara movida" con evidencia clara.
"""
import os

import cv2
import numpy as np

import vision
from seguimiento import Camara

# Puntos coincidentes para confiar en que la camara sigue en su lugar.
PUNTOS_CONFIABLES = 25
# Puntos que bastan para decir "se movio" si TODOS coinciden en un
# desplazamiento grande. Con el movimiento real del 28-sep solo coincidieron 14,
# todos corridos un 21%. Coincidencias al azar no se ponen de acuerdo en un
# mismo corrimiento.
PUNTOS_MOVIDA = 12
# Desplazamiento, en fraccion del ancho, para decir "se movio".
MOVIDA = 0.04
# Por debajo de esto, la escena ya se parece poco: se guarda como otra variante.
VARIANTE_HASTA = 60
VARIANTES = 4
# Escena casi lisa: lente tapada, sin luz, o todo negro.
SIN_IMAGEN = 5.0
FRACCION_SIN_IMAGEN = 0.8


class RevisionCamara:
    def __init__(self, dir_pantalla):
        self._dir = dir_pantalla
        os.makedirs(self._dir, exist_ok=True)
        self._firma_archivo = os.path.join(self._dir, "referencia.firma")
        self._refs = []
        self._firma = ""

    def abrir(self, firma_nueva):
        if firma_nueva == self._firma:
            return
        self._firma = firma_nueva
        self._refs = []
        guardada = ""
        if os.path.exists(self._firma_archivo):
            with open(self._firma_archivo, encoding="utf-8") as f:
                guardada = f.read()
        if guardada == firma_nueva:
            for k in range(VARIANTES):
                r = vision.leer(os.path.join(self._dir, "marco_%d.orb" % k))
                if r is not None:
                    self._refs.append(r)
        else:
            for nombre in os.listdir(self._dir):
                if nombre.startswith("marco_"):
                    try:
                        os.remove(os.path.join(self._dir, nombre))
                    except OSError:
                        pass
            with open(self._firma_archivo, "w", encoding="utf-8") as f:
                f.write(firma_nueva)

    def revisar(self, vistazos, geo):
        if not vistazos:
            return Camara.INCONCLUSO
        if sum(1 for v in vistazos if v.marco_contraste < SIN_IMAGEN) / len(vistazos) >= FRACCION_SIN_IMAGEN:
            return Camara.SIN_IMAGEN
        marco = vistazos[len(vistazos) // 2].marco
        mascara = _fuera_de_la_pantalla(marco, geo)
        actual = vision.rasgos(marco, mascara)
        if not self._refs:
            self._guardar(actual)
            return Camara.OK
        mejor = 0
        corrimiento = 0.0
        for r in self._refs:
            n, d = vision.desplazamiento(r, actual)
            if n > mejor:
                mejor = n
                corrimiento = d / marco.shape[1]
        if mejor >= PUNTOS_MOVIDA and corrimiento > MOVIDA:
            return Camara.MOVIDA
        if mejor < PUNTOS_CONFIABLES:
            return Camara.INCONCLUSO
        if mejor < VARIANTE_HASTA and len(self._refs) < VARIANTES:
            self._guardar(actual)
        return Camara.OK

    def _guardar(self, r):
        vision.escribir(os.path.join(self._dir, "marco_%d.orb" % len(self._refs)), r)
        self._refs.append(r)


def _fuera_de_la_pantalla(marco, geo):
    """
    Mascara de lo que esta FUERA de la pantalla (un poco agrandada, para dejar
    fuera tambien el brillo del borde). La camara se juzga solo con lo fijo de
    alrededor; dentro de la pantalla el contenido cambia por definicion. El
    28-sep, al arrastrar a un lado una ventana con texto que tapaba parte del
    video, sus puntos se desplazaron juntos y parecio que la camara entera se
    habia movido.

    Si la pantalla llena casi toda la foto (TLALPAN), afuera no queda con que
    comparar: entonces se usa la foto entera (None).
    """
    h, w = marco.shape[:2]
    cx = sum(x for x, _ in geo.esquinas) / 4
    cy = sum(y for _, y in geo.esquinas) / 4
    puntos = [((cx + (x - cx) * 1.08) * w, (cy + (y - cy) * 1.08) * h) for x, y in geo.esquinas]
    # Area de la pantalla (formula del cordon) sobre el area de la foto.
    area = abs(sum(geo.esquinas[i][0] * geo.esquinas[(i + 1) % 4][1] -
                   geo.esquinas[(i + 1) % 4][0] * geo.esquinas[i][1] for i in range(4))) / 2
    if area > 0.8:
        return None
    m = np.full((h, w), 255, dtype=np.uint8)
    # MatOfPoint de Java trunca las coordenadas a enteros; aqui igual.
    contorno = np.array([[int(x), int(y)] for x, y in puntos], dtype=np.int32)
    cv2.fillConvexPoly(m, contorno, 0)
    return m
