"""Campanas de SPACE OS: reconocer su arte en la pantalla y mandar una prueba al dia.

Lo que pidio el dueno (oct-2026): lo que se sube en Operaciones tiene que
reconocerse en la pantalla y fotografiarse, aparte de lo programatico (cualquier
imagen nueva). Aqui solo el modulo; el recorrido completo esta en test_monitor.
"""
import json
import os

import cv2
import numpy as np

import vision
from campanas import REINTENTO_MS, Campanas
from conftest import gris_gz

DIA = 24 * 3600 * 1000


def pantalla(nombre, w, h):
    """Una pantalla de un sitio real (las fotos de las pruebas de fallas), al
    tamano de la pantalla enderezada (320 de ancho)."""
    g = np.frombuffer(gris_gz("salud/%s_00.gris.gz" % nombre)[: w * h], dtype=np.uint8).reshape(h, w)
    return cv2.resize(g, (320, round(h * 320 / w)), interpolation=cv2.INTER_CUBIC)


# Dos creativos distintos: lo que salia en TLALPAN y en MANUEL DUBLAN.
A = pantalla("tlalpan", 192, 136)
B = pantalla("dublan", 192, 155)


def jpeg(gris, ancho=640):
    """Como la manda el servidor: el arte limpio, reducido a 640 de ancho."""
    alto = round(gris.shape[0] * ancho / gris.shape[1])
    ok, buf = cv2.imencode(".jpg", cv2.resize(gris, (ancho, alto), interpolation=cv2.INTER_CUBIC))
    return buf.tobytes()


def vista_por_la_camara(gris):
    """El arte como lo ve la camara: un poco torcido, mas oscuro y con ruido."""
    h, w = gris.shape
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[6, 4], [w - 3, 0], [w - 8, h - 5], [2, h - 2]])
    m = cv2.getPerspectiveTransform(src, dst)
    img = cv2.warpPerspective(gris, m, (w, h), borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    img = img * 0.8 + 12 + np.random.default_rng(7).normal(0, 4, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


class Servidor:
    def __init__(self):
        self.artes = {}
        self.pedidas = []

    def descargar(self, id_):
        self.pedidas.append(id_)
        return self.artes.get(id_)


def armar(tmp_path, ahora=None):
    reloj = ahora or [1_760_000_000_000]
    srv = Servidor()
    return Campanas(str(tmp_path), srv.descargar, lambda: reloj[0]), srv, reloj


def test_reconoce_el_arte_de_su_campana_en_la_pantalla(tmp_path):
    c, srv, _ = armar(tmp_path)
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "a" * 64, "foto_hoy": False}])
    vista = vista_por_la_camara(A)
    id_, puntos = c.buscar(vision.rasgos(vista), vista)
    assert id_ == 7, puntos
    otra = vista_por_la_camara(B)
    assert c.buscar(vision.rasgos(otra), otra)[0] is None, "otro creativo no es la campana"


def test_baja_la_referencia_una_sola_vez_y_la_cambia_si_cambia_el_arte(tmp_path):
    c, srv, _ = armar(tmp_path)
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    assert srv.pedidas == [7]
    srv.artes[7] = jpeg(B)
    c.actualizar([{"id": 7, "sha": "2" * 64}])
    assert srv.pedidas == [7, 7]
    assert len([n for n in os.listdir(c.dir) if n.endswith(".jpg")]) == 1, "la vieja se borra"
    vista = vista_por_la_camara(B)
    assert c.buscar(vision.rasgos(vista), vista)[0] == 7, "reconoce el arte NUEVO"


def test_la_que_ya_no_viene_se_olvida(tmp_path):
    c, srv, _ = armar(tmp_path)
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    c.actualizar([])
    assert len(c) == 0 and not [n for n in os.listdir(c.dir) if n.endswith(".jpg")], "su referencia se borra"
    vista = vista_por_la_camara(A)
    assert c.buscar(vision.rasgos(vista), vista)[0] is None


def test_sin_red_reintenta_pero_no_en_cada_vuelta(tmp_path):
    c, srv, reloj = armar(tmp_path)
    c.actualizar([{"id": 7, "sha": "1" * 64}])          # el servidor no la tiene
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    assert srv.pedidas == [7]
    reloj[0] += REINTENTO_MS
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    assert srv.pedidas == [7, 7] and len(c) == 1


def test_una_prueba_por_campana_al_dia_y_sobrevive_a_un_reinicio(tmp_path):
    c, srv, reloj = armar(tmp_path)
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    assert c.pendiente(7)
    c.marcar(7)
    assert not c.pendiente(7)
    otra, _, _ = armar(tmp_path, reloj)                   # se reinicia la Pi
    otra.actualizar([{"id": 7, "sha": "1" * 64}])
    assert not otra.pendiente(7), "ya se mando hoy"
    reloj[0] += DIA
    assert otra.pendiente(7), "al dia siguiente toca otra"


def test_si_el_servidor_ya_tiene_la_de_hoy_no_se_repite(tmp_path):
    c, srv, _ = armar(tmp_path)
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "1" * 64, "foto_hoy": True}])
    assert not c.pendiente(7)
    with open(os.path.join(c.dir, "campanas.json"), encoding="utf-8") as f:
        assert json.load(f)["hechas"] == [7]


def test_aprende_como_la_ve_la_camara(tmp_path):
    c, srv, _ = armar(tmp_path)
    srv.artes[7] = jpeg(A)
    c.actualizar([{"id": 7, "sha": "1" * 64}])
    vista = vista_por_la_camara(A)
    _, primera = c.buscar(vision.rasgos(vista), vista)
    _, segunda = c.buscar(vision.rasgos(vista), vista)
    assert segunda > primera, "la toma de la camara queda como variante"


# --- El recorrido completo ---------------------------------------------------

from test_monitor import (  # noqa: E402,F401  (entorno es un fixture de pytest)
    MIN, configuracion, entorno, fixture, foto, una_vuelta,
)
import monitor  # noqa: E402

T = foto(fixture("tlalpan", 0, 192, 136))       # lo que ya estaba en el loop
D = foto(fixture("dublan", 0, 192, 155))        # el arte de la campana vendida
P = foto(fixture("dublan", 3, 192, 155))        # algo programatico, nuevo


def con_campana(**extra):
    base = {"vigilar": True, "cada_min": 0, "recorrido_seg": 60, "paso_seg": 5, "aprendizaje_min": 0,
            "restantes_hoy": 6, "desde": "2026-10-01",
            "campanas": [{"id": 41, "sha": "d" * 64, "foto_hoy": False}]}
    base.update(extra)
    return base


def arte_limpio():
    """La referencia que manda el servidor: el arte tal cual, sin camara."""
    g = fixture("dublan", 0, 192, 155)
    ok, buf = cv2.imencode(".jpg", cv2.resize(g, (640, round(155 * 640 / 192)), interpolation=cv2.INTER_CUBIC))
    return buf.tobytes()


def test_la_campana_se_fotografia_al_verla_y_no_cuenta_como_nueva(entorno):
    puente, reloj, d = entorno(configuracion(creativos=con_campana()))
    puente.artes[41] = arte_limpio()
    una_vuelta(puente, reloj, d, [T])                     # aprende el loop
    assert puente.pruebas == []
    una_vuelta(puente, reloj, d, [T, T, D, D, T, T])
    assert [c for _, c in puente.pruebas] == [41], "su prueba, ligada a la campana"
    assert puente.creativos == [], "no gasta el tope de lo programatico"
    una_vuelta(puente, reloj, d, [D, T, D, T])
    assert len(puente.pruebas) == 1, "una por campana al dia"
    assert puente.creativos == [], "ni vuelve como nueva"


def test_lo_programatico_sigue_aparte(entorno):
    puente, reloj, d = entorno(configuracion(creativos=con_campana()))
    puente.artes[41] = arte_limpio()
    una_vuelta(puente, reloj, d, [T])
    una_vuelta(puente, reloj, d, [T, D, D, P, P, T])
    assert [c for _, c in puente.pruebas] == [41]
    assert len(puente.creativos) == 1, "lo nuevo que no es campana sube como siempre"


def test_la_prueba_sale_aun_aprendiendo(entorno):
    puente, reloj, d = entorno(configuracion(creativos=con_campana(aprendizaje_min=600)))
    puente.artes[41] = arte_limpio()
    una_vuelta(puente, reloj, d, [D, D, T])
    assert [c for _, c in puente.pruebas] == [41]


def test_al_dia_siguiente_otra_prueba(entorno):
    puente, reloj, d = entorno(configuracion(creativos=con_campana()))
    puente.artes[41] = arte_limpio()
    una_vuelta(puente, reloj, d, [T])
    una_vuelta(puente, reloj, d, [D, D])
    reloj.dormir(DIA)
    una_vuelta(puente, reloj, d, [D, D])
    assert [c for _, c in puente.pruebas] == [41, 41]


def test_si_el_servidor_ya_la_tiene_de_hoy_no_la_repite(entorno):
    puente, reloj, d = entorno(configuracion(creativos=con_campana(
        campanas=[{"id": 41, "sha": "d" * 64, "foto_hoy": True}])))
    puente.artes[41] = arte_limpio()
    una_vuelta(puente, reloj, d, [T])
    una_vuelta(puente, reloj, d, [D, D])
    assert puente.pruebas == []


class ApiFalsa:
    def __init__(self):
        self.version_ = "v1"
        self.pedidas = 0

    def version(self):
        return self.version_

    def monitoreo(self):
        self.pedidas += 1
        return configuracion(creativos=con_campana())

    def referencia_campana(self, id_):
        return None


def test_en_continuo_vuelve_a_pedir_la_configuracion_solo_si_cambia_la_huella(tmp_path):
    api = ApiFalsa()
    reloj = [1_760_000_000_000]

    class Reloj:
        def ahora_ms(self):
            return reloj[0]

    m = monitor.Monitor(str(tmp_path), api, None, Reloj())
    m.configuracion()
    m.configuracion()
    assert api.pedidas == 1, "misma huella: se reutiliza (no gasta datos)"
    api.version_ = "v2"                                   # un ajuste en el panel
    m.configuracion()
    assert api.pedidas == 2, "huella nueva: se pide en la siguiente vuelta"
    reloj[0] += 16 * MIN
    m.configuracion()
    assert api.pedidas == 3, "y aunque no cambie, cada 15 min como antes"


def test_cuando_termina_la_campana_su_arte_no_vuelve_como_nuevo(entorno):
    puente, reloj, d = entorno(configuracion(creativos=con_campana()))
    puente.artes[41] = arte_limpio()
    una_vuelta(puente, reloj, d, [T])
    una_vuelta(puente, reloj, d, [D, D, T])
    puente.config["creativos"]["campanas"] = []          # vencio o se cancelo
    una_vuelta(puente, reloj, d, [D, D, T, D, D])
    assert puente.creativos == [], "ya era conocido: no gasta foto de lo programatico"
