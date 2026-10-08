# enderezador.py — De varias tomas de la camara a la pantalla "de frente".
#
# Port de android/.../pantalla/Enderezador.kt.
"""
Un vistazo, listo para los dos analisis:
  - `pantalla`: la pantalla enderezada a 320 px de ancho, en gris (creativos);
  - `salud`: la misma a 192 px (fallas; es la medida con la que se midieron
    los umbrales de SaludAnalisis);
  - `marco`: la foto ENTERA a 320 px, para ver si la camara se movio;
  - `jpeg`: la ultima toma tal cual, por si hay que subirla como evidencia.

Las tomas se PROMEDIAN antes de analizar: las franjas del LED cambian de una
toma a la siguiente y se borran; el anuncio, que no cambia, se queda.
"""
import math
import struct

import cv2
import numpy as np

from json_util import redondea_entero
from salud_analisis import Imagen

ANCHO_PANTALLA = 320
ANCHO_SALUD = 192
ANCHO_MARCO = 320

# El telefono decodifica con BitmapFactory, que NO aplica la orientacion EXIF:
# la aplica el codigo a mano (giro_total). OpenCV si la aplicaria por su cuenta,
# y la foto quedaria girada dos veces; por eso se le pide que la ignore.
_SIN_EXIF = cv2.IMREAD_IGNORE_ORIENTATION


class Vistazo:
    def __init__(self, pantalla, salud, marco, marco_contraste, jpeg):
        self.pantalla = pantalla
        self.salud = salud
        self.marco = marco
        self.marco_contraste = marco_contraste
        self.jpeg = jpeg

    def sin_foto(self):
        """El mismo vistazo sin la foto completa (lo demas ya esta medido)."""
        return Vistazo(self.pantalla, self.salud, self.marco, self.marco_contraste, b"")


def preparar(tomas, geo, giro):
    suma_p = None
    suma_m = None
    n = 0
    ultima = None
    for jpeg in tomas:
        gris = _decodificar(jpeg, geo, giro)
        if gris is None:
            continue
        p = _enderezar(gris, geo)
        alto_marco = redondea_entero(gris.shape[0] * ANCHO_MARCO / gris.shape[1])
        m = cv2.resize(gris, (ANCHO_MARCO, alto_marco), interpolation=cv2.INTER_AREA)
        suma_p = _acumular(suma_p, p)
        suma_m = _acumular(suma_m, m)
        ultima = jpeg
        n += 1
    if suma_p is None or suma_m is None:
        return None
    pantalla = _a_bytes(suma_p, n)
    marco = _a_bytes(suma_m, n)

    alto_salud = max(8, redondea_entero(pantalla.shape[0] * ANCHO_SALUD / pantalla.shape[1]))
    chica = cv2.resize(pantalla, (ANCHO_SALUD, alto_salud), interpolation=cv2.INTER_AREA)
    salud = Imagen(chica.astype(np.float64).reshape(-1), chica.shape[1], chica.shape[0])

    _, desv = cv2.meanStdDev(marco)
    contraste = float(desv[0][0]) if desv is not None and desv.size else 0.0
    return Vistazo(pantalla, salud, marco, contraste, ultima)


def _acumular(suma, img):
    f = img.astype(np.float32)
    if suma is None:
        return f
    # Igual que el telefono: una toma de otro tamaño no se suma, pero si cuenta
    # en el promedio (ver el reporte del port: eso oscurece la imagen).
    if suma.shape == f.shape:
        suma += f
    return suma


def _a_bytes(suma, n):
    # convertTo(CV_8U, 1/n): redondea al mas cercano y satura en 0..255.
    return np.clip(np.rint(suma * np.float32(1.0 / n)), 0, 255).astype(np.uint8)


def a_doubles(m):
    return np.asarray(m, dtype=np.float64).reshape(-1)


# --- La cabecera del JPEG: medidas y orientacion, sin decodificarlo ----------

def cabecera(jpeg):
    """(ancho, alto, orientacion EXIF 1..8) leyendo solo los marcadores del JPEG.
    (0, 0, 1) si no es un JPEG que se entienda."""
    ancho = alto = 0
    orientacion = 1
    try:
        b = jpeg
        if len(b) < 4 or b[0] != 0xFF or b[1] != 0xD8:
            return 0, 0, 1
        i = 2
        while i + 4 <= len(b):
            if b[i] != 0xFF:
                i += 1
                continue
            marca = b[i + 1]
            if marca == 0xFF:
                i += 1
                continue
            if marca in (0xD8, 0x01) or 0xD0 <= marca <= 0xD7:
                i += 2
                continue
            if marca in (0xD9, 0xDA):
                break
            (largo,) = struct.unpack_from(">H", b, i + 2)
            datos = b[i + 4:i + 2 + largo]
            if marca == 0xE1 and datos[:6] == b"Exif\x00\x00":
                orientacion = _orientacion_exif(datos[6:]) or orientacion
            elif 0xC0 <= marca <= 0xCF and marca not in (0xC4, 0xC8, 0xCC) and len(datos) >= 5:
                alto, ancho = struct.unpack_from(">HH", datos, 1)
            i += 2 + largo
    except Exception:
        pass
    return ancho, alto, orientacion


def _orientacion_exif(tiff):
    if len(tiff) < 8:
        return None
    orden = {b"II": "<", b"MM": ">"}.get(bytes(tiff[:2]))
    if orden is None:
        return None
    (ifd,) = struct.unpack_from(orden + "I", tiff, 4)
    if ifd + 2 > len(tiff):
        return None
    (n,) = struct.unpack_from(orden + "H", tiff, ifd)
    for k in range(n):
        e = ifd + 2 + 12 * k
        if e + 12 > len(tiff):
            break
        etiqueta, tipo = struct.unpack_from(orden + "HH", tiff, e)
        if etiqueta == 0x0112 and tipo == 3:
            (v,) = struct.unpack_from(orden + "H", tiff, e + 8)
            return v
    return None


def giro_total(jpeg, giro):
    """Grados que hay que girar este JPEG para verlo como la foto que se sube."""
    exif = {6: 90, 3: 180, 8: 270}.get(cabecera(jpeg)[2], 0)
    return (((exif + giro) % 360) + 360) % 360


def girar(img, total):
    if total == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if total == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    if total == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def decodificar_reducida(jpeg, muestreo, color=True):
    """Como inSampleSize de Android: decodifica a 1/muestreo (potencia de 2).
    libjpeg reduce directo a 1/2, 1/4 y 1/8; mas alla se termina con INTER_AREA."""
    banderas = {1: cv2.IMREAD_COLOR, 2: cv2.IMREAD_REDUCED_COLOR_2,
                4: cv2.IMREAD_REDUCED_COLOR_4, 8: cv2.IMREAD_REDUCED_COLOR_8}
    if not color:
        banderas = {1: cv2.IMREAD_GRAYSCALE, 2: cv2.IMREAD_REDUCED_GRAYSCALE_2,
                    4: cv2.IMREAD_REDUCED_GRAYSCALE_4, 8: cv2.IMREAD_REDUCED_GRAYSCALE_8}
    directo = min(muestreo, 8)
    datos = np.frombuffer(jpeg, dtype=np.uint8)
    if datos.size == 0:
        return None
    img = cv2.imdecode(datos, banderas[directo] | _SIN_EXIF)
    if img is None:
        return None
    resto = muestreo // directo
    if resto > 1:
        img = cv2.resize(img, (max(1, img.shape[1] // resto), max(1, img.shape[0] // resto)),
                         interpolation=cv2.INTER_AREA)
    return img


def _decodificar(jpeg, geo, giro):
    """
    JPEG -> gris girado como la foto que se sube (en esa imagen se marcaron las
    esquinas). Se decodifica a la resolucion justa para que la pantalla quede de
    al menos el doble de ANCHO_PANTALLA: en un encuadre abierto la pantalla
    puede ser el 5% de la foto, y reducir la foto entera primero la dejaria en
    nada; decodificarla completa seria memoria de sobra.
    """
    ancho, alto, _ = cabecera(jpeg)
    if ancho <= 0:
        return None
    total = giro_total(jpeg, giro)
    w0, h0 = (alto, ancho) if total in (90, 270) else (ancho, alto)

    ancho_pantalla = _ancho_de(geo, float(w0), float(h0))
    muestreo = 1
    while ancho_pantalla / (muestreo * 2) >= ANCHO_PANTALLA * 2:
        muestreo *= 2
    bgr = decodificar_reducida(jpeg, muestreo)
    if bgr is None:
        return None
    if bgr.ndim == 2:
        gris = bgr
    else:
        # Luminancia Rec. 601 en enteros, la misma de todo el sistema.
        b = bgr[:, :, 0].astype(np.uint32)
        g = bgr[:, :, 1].astype(np.uint32)
        r = bgr[:, :, 2].astype(np.uint32)
        gris = ((r * 299 + g * 587 + b * 114) // 1000).astype(np.uint8)
    return girar(gris, total)


def _ancho_de(geo, w, h):
    e = [(x * w, y * h) for x, y in geo.esquinas]
    return (math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) +
            math.hypot(e[2][0] - e[3][0], e[2][1] - e[3][1])) / 2


def _alto_de(geo, w, h):
    e = [(x * w, y * h) for x, y in geo.esquinas]
    return (math.hypot(e[3][0] - e[0][0], e[3][1] - e[0][1]) +
            math.hypot(e[2][0] - e[1][0], e[2][1] - e[1][1])) / 2


def _enderezar(gris, geo):
    """La pantalla, enderezada con sus 4 esquinas, a ANCHO_PANTALLA de ancho."""
    h, w = gris.shape[:2]
    alto = max(8, redondea_entero(ANCHO_PANTALLA * _alto_de(geo, w, h) / _ancho_de(geo, w, h)))
    src = np.float32([(x * w, y * h) for x, y in geo.esquinas])
    dst = np.float32([(0, 0), (ANCHO_PANTALLA, 0), (ANCHO_PANTALLA, alto), (0, alto)])
    t = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(gris, t, (ANCHO_PANTALLA, alto), flags=cv2.INTER_LINEAR)


def enderezar_jpeg(jpeg, grados):
    """
    Gira el JPEG como las demas fotos del sitio, para subirlo (bakeRotation del
    telefono): orientacion EXIF + giro del encuadre, horneado en los pixeles y
    reescrito al 92%. Se reescribe aunque no haya giro, como alla: asi la foto
    pierde la etiqueta EXIF y nadie la vuelve a girar despues.
    """
    try:
        total = giro_total(jpeg, grados)
        img = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR | _SIN_EXIF)
        if img is None:
            return jpeg
        ok, out = cv2.imencode(".jpg", girar(img, total), [cv2.IMWRITE_JPEG_QUALITY, 92])
        return out.tobytes() if ok else jpeg
    except Exception:
        return jpeg
