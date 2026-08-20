"""
SPACE EYE — Verificador de creatividades.

Responde una sola pregunta: ¿la foto que mando el equipo muestra la creatividad
que la campana espera?

POR QUE NO BASTA CON PARECERSE (medido el 17-ago-2026 con fotos reales)
----------------------------------------------------------------------
La primera version comparaba la foto ENTERA contra el archivo original,
redimensionada, con SSIM + histograma + pHash. Con la creatividad correcta
delante de la camara daba 0.34 de confianza y la marcaba INCORRECTA.

No era cuestion de umbrales. Estos son los cuatro casos medidos:

    caso                                   confianza    SSIM
    creatividad correcta, foto completa       0.337     0.353
    creatividad correcta, recortada            0.465     0.590
    creatividad EQUIVOCADA                     0.291     0.270
    camara TAPADA (gris uniforme)              0.539     0.882   <-- la mejor

Una foto en blanco sacaba la nota mas alta de todas. El SSIM premia las
imagenes planas: sin detalle que contradecir, "se parece" a cualquier cosa. Y al
bajar el umbral para que pasaran las fotos buenas, la primera en pasar era la
camara ciega, que es justo el caso que esto existe para atrapar.

El problema de fondo: una FOTO de una pantalla nunca se parece, pixel a pixel, a
su archivo original. Hay perspectiva, reflejo, moire, otra exposicion, y todo lo
que rodea al anuncio dentro del cuadro.

QUE SE HACE AHORA
-----------------
Se buscan PUNTOS CARACTERISTICOS de la creatividad dentro de la foto (esquinas,
cruces de trazos, bordes de letra) y se exige que los que coinciden encajen
TODOS en una misma perspectiva. Eso es robusto a lo que antes estorbaba: da
igual que el anuncio ocupe un tercio del cuadro, que se vea de lado o que la luz
sea otra. Con las mismas cuatro fotos:

    creatividad correcta, foto completa        24 puntos encajan
    creatividad correcta, recortada           123
    creatividad EQUIVOCADA                      7
    camara TAPADA                               0

SSIM, histograma y pHash se siguen calculando y guardando -son utiles para
revisar un caso a mano y ya viven en la base de datos- pero solo suman al
margen. La decision la toman los puntos.
"""
import io
import os
import time

import cv2
import imagehash
import numpy as np
import pytesseract
from PIL import Image
from skimage.metrics import structural_similarity as ssim

# Cuantos puntos tienen que encajar para dar por buena la creatividad.
#
# Medido: la correcta da 24 con el anuncio ocupando un tercio del cuadro y 123
# recortada; una creatividad equivocada da 7. 15 separa los dos mundos con
# margen por ambos lados. Se puede mover sin tocar codigo con MIN_PUNTOS_CREATIVO.
MIN_PUNTOS = int(os.getenv("MIN_PUNTOS_CREATIVO", "15"))

# Por debajo de esto la foto no tiene NADA que mirar: la camara esta tapada, con
# el protector de la lente puesto o apuntando a una pared a un palmo. Medido: una
# foto ciega da desviacion tipica 3.5 y CERO puntos; la peor foto real da 26.8 y
# 1479 puntos. El margen es enorme, no hay riesgo de confundirlas.
MIN_DESVIACION = 8.0
MIN_PUNTOS_FOTO = 50

# Si la creatividad misma casi no tiene detalle (un fondo liso con un logo
# pequeno), no hay puntos que buscar y este metodo no aplica: se vuelve al de
# antes en vez de reprobar a todo el mundo.
MIN_PUNTOS_CREATIVIDAD = 50


class Verifier:
    def __init__(self, min_ssim=0.7, max_phash_distance=10, min_puntos=None):
        self.min_ssim = min_ssim
        self.max_phash_distance = max_phash_distance
        self.min_puntos = min_puntos or MIN_PUNTOS

    def verify(self, field_image_bytes: bytes, creative_image_bytes: bytes,
               expected_text: str = None) -> dict:
        """Compara la foto del sitio contra la creatividad esperada."""
        start = time.time()

        field_img = cv2.imdecode(
            np.frombuffer(field_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        creative_img = cv2.imdecode(
            np.frombuffer(creative_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )

        if field_img is None or creative_img is None:
            return {
                "is_correct": False,
                "confidence": 0.0,
                "reason": "no_pude_leer_las_imagenes",
                "processing_ms": int((time.time() - start) * 1000),
            }

        gris_foto = cv2.cvtColor(field_img, cv2.COLOR_BGR2GRAY)
        gris_creativo = cv2.cvtColor(creative_img, cv2.COLOR_BGR2GRAY)

        # --- La foto no muestra nada -------------------------------------------
        # Se corta aqui: no tiene sentido puntuar el parecido de una imagen vacia,
        # y era exactamente por donde se colaba una camara tapada.
        vacia, detalle = self._sin_contenido(gris_foto)
        if vacia:
            return {
                "ssim_score": None,
                "histogram_score": None,
                "phash_distance": None,
                "ocr_text": None,
                "ocr_match": None,
                "ocr_confidence": None,
                "is_correct": False,
                "confidence": 0.0,
                "reason": f"la foto no muestra nada ({detalle}): revisa si la camara "
                          f"esta tapada o apuntando a una pared",
                "processing_ms": int((time.time() - start) * 1000),
            }

        # --- Capa principal: donde esta la creatividad dentro de la foto --------
        puntos, emparejados, hay_donde_buscar, cuadro = self._puntos_que_encajan(
            gris_creativo, gris_foto
        )

        # --- Capas de apoyo (las de siempre) ------------------------------------
        alto, ancho = creative_img.shape[:2]
        field_resized = cv2.resize(field_img, (ancho, alto))
        ssim_score = self._compute_ssim(field_resized, creative_img)
        hist_score = self._compute_histogram(field_resized, creative_img)
        phash_distance = self._compute_phash(field_image_bytes, creative_image_bytes)

        ocr_result = None
        if expected_text:
            ocr_result = self._check_ocr(field_img, expected_text)

        is_correct, confidence, reason = self._decide(
            puntos, cuadro, hay_donde_buscar,
            ssim_score, hist_score, phash_distance, ocr_result
        )

        return {
            "ssim_score": round(ssim_score, 4),
            "histogram_score": round(hist_score, 4),
            "phash_distance": phash_distance,
            "ocr_text": ocr_result["text"] if ocr_result else None,
            "ocr_match": ocr_result["match"] if ocr_result else None,
            "ocr_confidence": ocr_result["confidence"] if ocr_result else None,
            "is_correct": is_correct,
            "confidence": round(confidence, 3),
            "reason": reason,
            "processing_ms": int((time.time() - start) * 1000),
            # No se guardan en la base (el backend solo toma los campos que
            # conoce), pero salen en el registro del worker y en el PDF de
            # evidencia, que es donde se revisa un caso dudoso.
            "puntos_encajan": puntos,
            "puntos_emparejados": emparejados,
            "area_creatividad": cuadro["area"] if cuadro else None,
            "esquinas_creatividad": cuadro["esquinas"] if cuadro else None,
        }

    # ------------------------------------------------------------------ capas --

    def _sin_contenido(self, gris):
        """¿La foto esta vacia? (camara tapada, lente con el protector puesto)"""
        desviacion = float(gris.std())
        if desviacion < MIN_DESVIACION:
            return True, f"imagen casi plana, desviacion {desviacion:.1f}"

        puntos = cv2.ORB_create(nfeatures=1000).detect(gris, None)
        if len(puntos) < MIN_PUNTOS_FOTO:
            return True, f"sin detalle, solo {len(puntos)} puntos"

        return False, ""

    def _puntos_que_encajan(self, gris_creativo, gris_foto):
        """Localiza la creatividad dentro de la foto.

        Devuelve (encajan, emparejados, hay_donde_buscar, cuadro). `cuadro` es
        donde quedo la creatividad dentro de la foto, o None si no se pudo
        localizar. `hay_donde_buscar` es False cuando la propia creatividad no
        tiene detalle suficiente: ahi este metodo no puede opinar y manda el de
        antes.
        """
        orb = cv2.ORB_create(nfeatures=4000)
        kp_creativo, des_creativo = orb.detectAndCompute(gris_creativo, None)
        if des_creativo is None or len(kp_creativo) < MIN_PUNTOS_CREATIVIDAD:
            return 0, 0, False, None

        kp_foto, des_foto = orb.detectAndCompute(gris_foto, None)
        if des_foto is None or len(kp_foto) < 10:
            return 0, 0, True, None

        # Criterio de Lowe: un punto solo cuenta si su mejor pareja es claramente
        # mejor que la segunda. Sin esto, en una foto con mucha textura (una
        # fachada, un arbol) todo empareja con todo.
        parejas = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(des_creativo, des_foto, k=2)
        buenas = [
            m for m, n in (p for p in parejas if len(p) == 2)
            if m.distance < 0.75 * n.distance
        ]
        if len(buenas) < 8:  # la homografia necesita al menos cuatro; ocho da margen
            return 0, len(buenas), True, None

        # Y tienen que encajar TODOS en la misma transformacion. Esto es lo que
        # separa "la creatividad esta ahi, vista en perspectiva" de "coincidieron
        # unas cuantas esquinas por casualidad".
        origen = np.float32([kp_creativo[m.queryIdx].pt for m in buenas]).reshape(-1, 1, 2)
        destino = np.float32([kp_foto[m.trainIdx].pt for m in buenas]).reshape(-1, 1, 2)
        H, mascara = cv2.findHomography(origen, destino, cv2.RANSAC, 5.0)
        if H is None or mascara is None:
            return 0, len(buenas), True, None

        return int(mascara.sum()), len(buenas), True, self._donde_quedo(H, gris_creativo, gris_foto)

    def _donde_quedo(self, H, gris_creativo, gris_foto):
        """Proyecta las esquinas de la creatividad sobre la foto.

        Es la comprobacion que de verdad separa lo bueno de la casualidad, mas
        que el numero de puntos. Cuando la creatividad esta ahi de verdad, sus
        cuatro esquinas caen formando un rectangulo en perspectiva -convexo y de
        un tamano razonable-, y ademas dicen DONDE quedo, que es util para
        revisar el caso a mano.

        Cuando los puntos coincidieron por casualidad, la transformacion es
        degenerada y las cuatro esquinas colapsan a un punto. Medido con fotos
        reales: la buena da un cuadro convexo del 34% de la foto y cae justo
        sobre la pantalla; un primer plano del borde de una laptop -que llegaba a
        16 puntos, mas que la foto buena vista de lejos- colapsa a area cero.
        """
        alto_c, ancho_c = gris_creativo.shape[:2]
        esquinas = np.float32([
            [0, 0], [ancho_c, 0], [ancho_c, alto_c], [0, alto_c]
        ]).reshape(-1, 1, 2)

        try:
            proyectadas = cv2.perspectiveTransform(esquinas, H).reshape(-1, 2)
        except cv2.error:
            return None

        if not np.all(np.isfinite(proyectadas)):
            return None

        contorno = proyectadas.astype(np.float32)
        area = abs(cv2.contourArea(contorno))
        area_foto = float(gris_foto.shape[0] * gris_foto.shape[1])
        relativa = area / area_foto if area_foto else 0.0

        return {
            "convexo": bool(cv2.isContourConvex(contorno)),
            "area": round(relativa, 4),
            "esquinas": [[int(x), int(y)] for x, y in proyectadas],
        }

    def _cuadro_creible(self, cuadro):
        """¿La creatividad quedo donde podria estar un anuncio de verdad?"""
        if not cuadro or not cuadro["convexo"]:
            return False
        # Por debajo del 0.5% del cuadro no hay imagen que reconocer (seria un
        # anuncio de 130x75 px); por encima de 4 veces la foto, la
        # transformacion no tiene sentido.
        return 0.005 <= cuadro["area"] <= 4.0

    def _compute_ssim(self, img1, img2) -> float:
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        score, _ = ssim(gray1, gray2, full=True)
        return float(score)

    def _compute_histogram(self, img1, img2) -> float:
        hist1 = cv2.calcHist([img1], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        hist2 = cv2.calcHist([img2], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        cv2.normalize(hist1, hist1)
        cv2.normalize(hist2, hist2)
        return float(cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL))

    def _compute_phash(self, bytes1: bytes, bytes2: bytes) -> int:
        img1 = Image.open(io.BytesIO(bytes1))
        img2 = Image.open(io.BytesIO(bytes2))
        return int(imagehash.phash(img1) - imagehash.phash(img2))

    def _check_ocr(self, img, expected_text: str) -> dict:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        try:
            data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT,
                                              lang='spa+eng')
            texts = [t for t, c in zip(data['text'], data['conf'])
                     if int(c) > 30 and t.strip()]
            full_text = ' '.join(texts).lower()
            expected_lower = expected_text.lower().strip()

            keywords = expected_lower.split()
            matched = sum(1 for kw in keywords if kw in full_text)
            match_ratio = matched / len(keywords) if keywords else 0

            return {
                "text": full_text[:500],
                "match": match_ratio >= 0.5,
                "confidence": round(match_ratio, 3),
            }
        except Exception as e:
            return {
                "text": f"OCR error: {str(e)}",
                "match": False,
                "confidence": 0.0,
            }

    # --------------------------------------------------------------- veredicto --

    def _decide(self, puntos, cuadro, hay_donde_buscar, ssim_score, hist_score,
                phash_distance, ocr_result):
        if not hay_donde_buscar:
            # Creatividad sin detalle: no hay puntos que localizar. Se decide con
            # el metodo de antes, avisando en el motivo de que fue asi.
            correcta, confianza, motivo = self._decide_por_parecido(
                ssim_score, hist_score, phash_distance, ocr_result
            )
            return correcta, confianza, f"{motivo} (creatividad sin detalle: por parecido)"

        # Dos condiciones, y las dos hacen falta: que coincidan suficientes
        # puntos, y que al proyectar la creatividad quede un cuadro creible.
        creible = self._cuadro_creible(cuadro)
        correcta = puntos >= self.min_puntos and creible

        # El parecido global no decide; solo mueve el numero dentro de su banda,
        # para distinguir un "si, clarisimo" de un "si, pero justito".
        apoyo = min(1.0,
                    0.5 * min(ssim_score / self.min_ssim, 1.0)
                    + 0.25 * max(0.0, hist_score)
                    + 0.25 * max(0.0, 1 - phash_distance / (self.max_phash_distance * 2)))
        holgura = min(1.0, max(0.0, (puntos / self.min_puntos - 1) / 2))

        # La confianza NUNCA puede contradecir al veredicto: por encima de 0.60
        # solo las correctas, por debajo solo las que no lo son. Si no, en el
        # dashboard aparecia "incorrecta, confianza 0.73" y no habia forma de
        # entender que queria decir.
        if correcta:
            confianza = 0.60 + 0.40 * (0.8 * holgura + 0.2 * apoyo)
            motivo = (f"coincide ({puntos} puntos encajan; la creatividad ocupa el "
                      f"{cuadro['area'] * 100:.0f}% de la foto)")
            if ocr_result and not ocr_result["match"]:
                # No tumba el veredicto: el texto se lee mal de noche o de lejos y
                # los puntos ya dijeron que la imagen es la correcta.
                motivo += "; el texto esperado no se leyo"
        else:
            confianza = 0.55 * (0.8 * min(puntos / self.min_puntos, 1.0) + 0.2 * apoyo)
            if puntos >= self.min_puntos and not creible:
                motivo = (f"los puntos que coinciden ({puntos}) no forman un anuncio: "
                          f"parecen coincidencias sueltas, no la creatividad")
            else:
                motivo = (f"no encuentro la creatividad en la foto "
                          f"({puntos} puntos encajan, hacen falta {self.min_puntos})")

        return correcta, round(confianza, 3), motivo[:500]

    def _decide_por_parecido(self, ssim_score, hist_score, phash_distance, ocr_result):
        """El criterio original, ya solo para creatividades sin detalle."""
        scores = []
        reasons = []

        ssim_pass = ssim_score >= self.min_ssim
        scores.append(min(ssim_score / self.min_ssim, 1.0) * 0.4)
        if not ssim_pass:
            reasons.append(f"ssim_bajo({ssim_score:.3f})")

        hist_pass = hist_score >= 0.5
        scores.append(min(hist_score, 1.0) * 0.2)
        if not hist_pass:
            reasons.append(f"histograma_bajo({hist_score:.3f})")

        phash_pass = phash_distance <= self.max_phash_distance
        scores.append(max(0, 1 - phash_distance / (self.max_phash_distance * 2)) * 0.25)
        if not phash_pass:
            reasons.append(f"phash_alto({phash_distance})")

        if ocr_result:
            scores.append(ocr_result["confidence"] * 0.15)
            if not ocr_result["match"]:
                reasons.append("el texto esperado no coincide")
        else:
            scores.append(0.15)

        confidence = sum(scores)
        is_correct = confidence >= 0.6 and (ssim_pass or phash_pass)
        return is_correct, confidence, "coincide" if is_correct else "; ".join(reasons)
