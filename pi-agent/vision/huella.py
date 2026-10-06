# huella.py — Huella visual de 256 bits de lo que hay en la pantalla.
#
# Port de android/.../creativos/Huella.kt, linea por linea, y tiene que seguir
# siendolo: el servidor compara las huellas de todos los agentes con la misma
# regla (creativos.controller.ts), y el catalogo de un sitio sobrevive a un
# cambio de equipo solo si todos calculan igual. Las pruebas comparan contra
# las huellas exactas que espera el telefono.
#
# En la vigilancia sirve para dos cosas: decir si la pantalla tiene algo que
# reconocer (sin contraste no hay huella: apagada, lente tapada, noche cerrada)
# y como nombre del creativo nuevo que se sube.
#
#   1. La imagen en gris se promedia a 64x64 y de ahi a 16x16 celdas.
#   2. Cada celda vale 1 si es claramente mas clara que la mediana de las 256
#      (mediana + un cuarto de la desviacion), y 0 si no.
#   3. Si la imagen casi no tiene contraste no hay huella.
import math

import numpy as np

REJILLA = 16
BITS = REJILLA * REJILLA
TRABAJO = 64
CONTRASTE_MINIMO = 6.0
# Bits que pueden diferir para seguir siendo el mismo creativo.
TOLERANCIA = 24


def _rejilla_entera(gris, ancho, alto, lado):
    # El primer paso suma pixeles enteros (0..255): con una imagen integral la
    # suma es exacta en cualquier orden y queda igual a la del telefono, sin
    # recorrer 57 600 pixeles uno por uno en Python.
    m = np.asarray(gris, dtype=np.float64)[: ancho * alto].reshape(alto, ancho)
    integral = np.zeros((alto + 1, ancho + 1), dtype=np.float64)
    integral[1:, 1:] = m.cumsum(axis=0).cumsum(axis=1)
    salida = []
    for y in range(lado):
        y0 = (y * alto) // lado
        y1 = max(y0 + 1, ((y + 1) * alto) // lado)
        for x in range(lado):
            x0 = (x * ancho) // lado
            x1 = max(x0 + 1, ((x + 1) * ancho) // lado)
            suma = integral[y1, x1] - integral[y0, x1] - integral[y1, x0] + integral[y0, x0]
            n = (y1 - y0) * (x1 - x0)
            salida.append(float(suma) / n if n > 0 else 0.0)
    return salida


def _rejilla(gris, ancho, alto, lado):
    # El segundo paso promedia promedios (no enteros): se suma en el mismo orden
    # que el telefono para que ningun bit cambie por redondeo.
    salida = [0.0] * (lado * lado)
    for y in range(lado):
        y0 = (y * alto) // lado
        y1 = max(y0 + 1, ((y + 1) * alto) // lado)
        for x in range(lado):
            x0 = (x * ancho) // lado
            x1 = max(x0 + 1, ((x + 1) * ancho) // lado)
            suma = 0.0
            n = 0
            for j in range(y0, y1):
                fila = j * ancho
                for i in range(x0, x1):
                    suma += gris[fila + i]
                    n += 1
            salida[y * lado + x] = suma / n if n > 0 else 0.0
    return salida


def _contraste(v):
    media = sum(v) / len(v)
    acc = 0.0
    for x in v:
        acc += (x - media) * (x - media)
    return math.sqrt(acc / len(v))


def calcular(gris, ancho, alto):
    """
    Huella en hexadecimal (64 caracteres), o None si la imagen no tiene forma
    que reconocer. `gris` es luminancia 0..255, fila por fila.
    """
    if ancho <= 0 or alto <= 0 or len(gris) < ancho * alto:
        return None
    gris = np.asarray(gris, dtype=np.float64).reshape(-1)
    if np.all(gris == np.floor(gris)):
        media = _rejilla_entera(gris, ancho, alto, TRABAJO)
    else:
        media = _rejilla(gris.tolist(), ancho, alto, TRABAJO)
    if _contraste(media) < CONTRASTE_MINIMO:
        return None
    celdas = _rejilla(media, TRABAJO, TRABAJO, REJILLA)

    ordenadas = sorted(celdas)
    medio = len(ordenadas) // 2
    mediana = (ordenadas[medio - 1] + ordenadas[medio]) / 2
    zona_muerta = _contraste(celdas) * 0.25

    partes = []
    acumulado = 0
    bits = 0
    for v in celdas:
        acumulado = (acumulado << 1) | (1 if v > mediana + zona_muerta else 0)
        bits += 1
        if bits == 4:
            partes.append("%x" % acumulado)
            acumulado = 0
            bits = 0
    return "".join(partes)


def distancia(a, b):
    """Bits distintos entre dos huellas. 0 = identicas."""
    if a is None or b is None or len(a) != len(b):
        return BITS
    return sum(bin(int(x, 16) ^ int(y, 16)).count("1") for x, y in zip(a, b))


def parecida(h, conocidas, tolerancia):
    """La conocida mas parecida dentro de la tolerancia, o None."""
    mejor = None
    mejor_d = tolerancia + 1
    for c in conocidas:
        d = distancia(h, c)
        if d < mejor_d:
            mejor_d = d
            mejor = c
    return mejor
