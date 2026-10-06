# evidencia.py — La foto que acompaña a una alerta, y la bitacora local.
#
# Port de android/.../pantalla/Evidencia.kt. El dibujo se hace con OpenCV en
# vez del Canvas de Android: mismo contenido (contorno blanco de la pantalla,
# lo que fallo en rojo, el texto sobre una franja roja), trazo un poco distinto.
"""
La evidencia es la foto del momento con el gabinete que fallo marcado en rojo
EN SU LUGAR (se dibuja con la misma geometria con la que se enderezo), y
reducida: 1600 px de ancho y JPEG al 75% son ~200-400 KB, contra varios MB de la
foto completa. Es lo UNICO que pesa en todo el monitoreo, y solo viaja cuando
se abre o se cierra una falla.

Todo evento se anota tambien en el equipo (bitacora + copia de la evidencia),
con tope de espacio: si la red falla en ese momento, queda constancia, y el
envio se reintenta en la siguiente vuelta.
"""
import json
import os
import time
import unicodedata

import cv2
import numpy as np

from enderezador import cabecera, decodificar_reducida

ANCHO_MAX = 1600
CALIDAD = 75
TOPE_EVIDENCIAS = 50 * 1024 * 1024
TOPE_BITACORA = 1 * 1024 * 1024


def _sin_acentos(texto):
    # Las letras de OpenCV (Hershey) solo tienen ASCII: "cámara" saldria con
    # signos raros. Se quitan los acentos solo en el dibujo; el texto que viaja
    # en `detalle` los conserva.
    texto = texto.replace("·", "-")
    return "".join(c for c in unicodedata.normalize("NFKD", texto) if ord(c) < 128)


class Evidencia:
    def __init__(self, dir_pantalla, ahora_ms=None):
        self._dir = os.path.join(dir_pantalla, "evidencia")
        os.makedirs(self._dir, exist_ok=True)
        self._bitacora = os.path.join(dir_pantalla, "bitacora.jsonl")
        self._ahora_ms = ahora_ms or (lambda: int(time.time() * 1000))

    def directorio(self):
        return self._dir

    def _base(self, jpeg):
        """La foto decodificada con el mismo muestreo del telefono, y llevada a
        ANCHO_MAX si aun se pasa. None si no se puede leer."""
        ancho, _, _ = cabecera(jpeg)
        muestreo = 1
        while ancho // (muestreo * 2) >= ANCHO_MAX:
            muestreo *= 2
        img = decodificar_reducida(jpeg, muestreo)
        if img is None:
            return None
        h, w = img.shape[:2]
        if w > ANCHO_MAX:
            img = cv2.resize(img, (ANCHO_MAX, h * ANCHO_MAX // w), interpolation=cv2.INTER_LINEAR)
        return img

    def reducir(self, jpeg):
        """
        La misma reduccion que la evidencia, sin dibujar nada: para la foto de un
        creativo nuevo, que si no subiria a resolucion completa.
        """
        try:
            ancho, _, _ = cabecera(jpeg)
            if ancho <= ANCHO_MAX:
                return jpeg
            img = self._base(jpeg)
            if img is None:
                return jpeg
            ok, out = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return out.tobytes() if ok else jpeg
        except Exception:
            return jpeg

    def preparar(self, jpeg, geo, zonas, texto):
        """
        jpeg: la foto ya girada como se sube.
        zonas: gabinetes a marcar (fila, columna); vacio = toda la pantalla.
        """
        img = self._base(jpeg)
        if img is None:
            return jpeg
        h, w = img.shape[:2]
        grosor = max(3.0, w / 300.0)

        def camino(p):
            return np.array([[int(round(x * w)), int(round(y * h))] for x, y in p], dtype=np.int32)

        # Toda la pantalla en blanco fino, para ubicarse; lo que fallo, en rojo.
        cv2.polylines(img, [camino(geo.esquinas)], True, (255, 255, 255),
                      max(1, int(round(grosor / 2))), cv2.LINE_AA)
        for f, c in zonas:
            cv2.polylines(img, [camino(geo.contorno(f, c))], True, (0, 0, 255), max(1, int(round(grosor))), cv2.LINE_AA)
        if not zonas:
            cv2.polylines(img, [camino(geo.esquinas)], True, (0, 0, 255), max(1, int(round(grosor))), cv2.LINE_AA)

        # El texto arriba a la izquierda sobre una franja roja translucida.
        letra = cv2.FONT_HERSHEY_SIMPLEX
        dibujo = _sin_acentos(texto)
        tamano = w / 40.0
        (_, alto_base), _ = cv2.getTextSize("Hg", letra, 1.0, 1)
        escala = tamano / max(1, alto_base) * 0.75
        trazo = max(1, int(round(escala * 2)))
        (ancho_texto, _), _ = cv2.getTextSize(dibujo, letra, escala, trazo)
        alto = tamano * 1.6
        x1 = min(w, int(ancho_texto + alto))
        y1 = min(h, int(alto))
        if x1 > 0 and y1 > 0:
            franja = img[0:y1, 0:x1].astype(np.float32)
            rojo = np.array([0, 0, 180], dtype=np.float32)
            a = 170 / 255.0
            img[0:y1, 0:x1] = np.clip(franja * (1 - a) + rojo * a, 0, 255).astype(np.uint8)
        origen = (int(alto / 3), int(tamano * 1.15))
        cv2.putText(img, dibujo, origen, letra, escala, (0, 0, 0), trazo + 2, cv2.LINE_AA)
        cv2.putText(img, dibujo, origen, letra, escala, (255, 255, 255), trazo, cv2.LINE_AA)

        ok, out = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, CALIDAD])
        return out.tobytes() if ok else jpeg

    def guardar(self, nombre, jpeg):
        """Guarda una copia local de la evidencia, borrando las mas viejas si se pasa del tope."""
        try:
            with open(os.path.join(self._dir, nombre + ".jpg"), "wb") as f:
                f.write(jpeg)
            archivos = sorted((os.path.join(self._dir, a) for a in os.listdir(self._dir)), key=os.path.getmtime)
            total = sum(os.path.getsize(a) for a in archivos)
            for a in archivos:
                if total <= TOPE_EVIDENCIAS:
                    break
                total -= os.path.getsize(a)
                os.remove(a)
        except Exception:
            pass

    def anotar(self, evento):
        try:
            if os.path.exists(self._bitacora) and os.path.getsize(self._bitacora) > TOPE_BITACORA:
                # Se queda con la mitad mas reciente.
                with open(self._bitacora, encoding="utf-8") as f:
                    lineas = f.read().splitlines()
                with open(self._bitacora, "w", encoding="utf-8") as f:
                    f.write("\n".join(lineas[len(lineas) - len(lineas) // 2:]) + "\n")
            linea = dict(evento)
            linea["ts"] = self._ahora_ms()
            with open(self._bitacora, "a", encoding="utf-8") as f:
                f.write(json.dumps(linea, ensure_ascii=False, separators=(",", ":")) + "\n")
        except Exception:
            pass
