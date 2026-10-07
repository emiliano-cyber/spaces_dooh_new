"""Creativos que salen una vez, envio agrupado y aviso rapido de pantalla apagada.

Lo que pidio el dueno (oct-2026): que no se pierda un creativo que sale UNA sola
vez, que las fotos nuevas puedan llegar juntas cada 2/4/8/12 horas (una por
creativo, la mas nitida) y que una pantalla apagada avise al instante. Con el
limite de 4 GB al mes por equipo en la cabeza: mirar no gasta datos, solo las
fotos que viajan.
"""
import copy
import json
import os

import cv2
import numpy as np

from apagada_rapida import DetectorApagada
from lote import LoteCreativos
from test_monitor import (  # noqa: F401  (entorno es un fixture de pytest)
    ALTO, ANCHO, ESQUINAS, FONDO, MIN, SALUD, X0, X1, Y0, Y1,
    configuracion, entorno, fixture, foto, tlalpan, una_vuelta,
)

A = foto(fixture("tlalpan", 0, 192, 136))
B = foto(fixture("dublan", 3, 192, 155))
C = foto(fixture("dublan", 0, 192, 155))


def creativos(**extra):
    base = {"vigilar": True, "cada_min": 0, "recorrido_seg": 60, "paso_seg": 5, "aprendizaje_min": 0,
            "restantes_hoy": 6, "desde": "2026-10-01"}
    base.update(extra)
    return base


def negra():
    """La escena con la pantalla apagada: negra, y lo de alrededor iluminado."""
    return foto(np.full((136, 192), 4, dtype=np.uint8))


def de_noche():
    """Todo oscuro: la pantalla apagada Y el entorno (o la lente tapada)."""
    img = (FONDO * 0.08).astype(np.uint8)
    ok, jpg = cv2.imencode(".jpg", cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))
    return jpg.tobytes()


# --- Creativos ---------------------------------------------------------------

def test_un_creativo_que_sale_una_sola_vez_se_fotografia(entorno):
    puente, reloj, d = entorno(configuracion(creativos=creativos()))
    una_vuelta(puente, reloj, d, [A])                      # aprende A, sin foto
    # B pasa UNA sola vez por la pantalla (dos miradas) entre muchas de A.
    una_vuelta(puente, reloj, d, [A, A, A, A, B, B, A, A, A, A, A, A])
    assert len(puente.creativos) == 1
    _, h = puente.creativos[0]
    una_vuelta(puente, reloj, d, [A, B, A, B])             # vuelve a salir: ya no se fotografia
    assert len(puente.creativos) == 1, "un creativo ya conocido no se vuelve a mandar"
    assert h


def test_envio_agrupado_manda_las_nuevas_juntas_al_cumplirse_el_plazo(entorno):
    puente, reloj, d = entorno(configuracion(creativos=creativos(envio_min=120)))
    una_vuelta(puente, reloj, d, [A])
    una_vuelta(puente, reloj, d, [B, B, C, C])
    assert puente.creativos == [], "con envio agrupado no se sube al momento"
    with open(os.path.join(d, "lote", "lote.json"), encoding="utf-8") as f:
        assert len(json.load(f)["items"]) == 2, "quedan guardadas en disco (sobreviven a un reinicio)"
    una_vuelta(puente, reloj, d, [A])                      # 6 min despues: todavia no
    assert puente.creativos == []
    reloj.dormir(2 * 60 * MIN)                             # se cumple el plazo de 2 h
    una_vuelta(puente, reloj, d, [A])
    assert len(puente.creativos) == 2, "salen juntas, una por creativo"
    assert len({h for _, h in puente.creativos}) == 2
    assert any("Envio agrupado: 2 foto(s)" in l["texto"] for l in puente.logs)


def test_envio_agrupado_respeta_el_tope_del_dia(entorno):
    puente, reloj, d = entorno(configuracion(creativos=creativos(envio_min=120, restantes_hoy=1)))
    una_vuelta(puente, reloj, d, [A])
    una_vuelta(puente, reloj, d, [B, B, C, C])
    reloj.dormir(2 * 60 * MIN)
    una_vuelta(puente, reloj, d, [A])
    assert len(puente.creativos) == 1, "el tope diario manda: 1 foto"
    with open(os.path.join(d, "lote", "lote.json"), encoding="utf-8") as f:
        assert len(json.load(f)["items"]) == 1, "la otra espera"


def test_volver_a_al_momento_vacia_lo_que_esperaba(entorno):
    cfg = configuracion(creativos=creativos(envio_min=480))
    puente, reloj, d = entorno(cfg)
    una_vuelta(puente, reloj, d, [A])
    una_vuelta(puente, reloj, d, [B, B])
    assert puente.creativos == []
    puente.config["creativos"]["envio_min"] = 0            # se cambia a "al momento" en el panel
    una_vuelta(puente, reloj, d, [A])
    assert len(puente.creativos) == 1


def test_el_lote_se_queda_con_la_foto_mas_nitida(tmp_path):
    ahora = [1_000]
    lote = LoteCreativos(str(tmp_path), lambda: ahora[0])
    lote.agregar("h1", b"borrosa", 10.0)
    assert lote.mejorar("h1", b"peor", 5.0) is False
    assert lote.mejorar("h1", b"nitida", 30.0) is True
    assert lote.mejorar("h2", b"x", 99.0) is False, "solo mejora las que esperan"
    assert lote.pendientes() == [("h1", b"nitida")]
    # Y sobrevive a un reinicio, con su plazo
    otra = LoteCreativos(str(tmp_path), lambda: ahora[0])
    assert otra.pendientes() == [("h1", b"nitida")]
    assert otra.toca_enviar(120) is False
    ahora[0] += 120 * MIN
    assert otra.toca_enviar(120) is True


# --- Pantalla apagada: aviso rapido ------------------------------------------

def salud(**extra):
    # Copia PROFUNDA: el servidor falso anota las fallas en `abiertas`, y una
    # lista compartida con SALUD se colaria en las pruebas de test_monitor.
    s = copy.deepcopy(SALUD)
    s.update({"cada_min": 30, "recorrido_seg": 60, "paso_seg": 5})
    s.update(extra)
    return s


def fallas_rapidas(puente):
    return [c for c, _ in puente.fallas if c["tipo"] == "pantalla_apagada" and c["evento"] == "abrir"]


def test_pantalla_apagada_avisa_en_menos_de_un_minuto_y_una_sola_vez(entorno):
    puente, reloj, d = entorno(configuracion(salud=salud()))
    una_vuelta(puente, reloj, d, tlalpan())                # la ve funcionando (aprende)
    assert fallas_rapidas(puente) == []
    reloj.dormir(30 * MIN)
    inicio = reloj.ms
    una_vuelta(puente, reloj, d, [negra()])
    (campos,) = fallas_rapidas(puente)
    detalle = json.loads(campos["detalle"])
    assert detalle["rapido"] is True and detalle["texto"] == "Pantalla apagada en horario"
    assert puente.fallas[-1][1], "con su foto de evidencia"
    # Cuando salio: a los 3 vistazos (paso de 5 s + 3 tomas), muy por debajo del minuto.
    assert len(puente.fallas) == 1
    assert reloj.ms - inicio >= 0
    reloj.dormir(30 * MIN)
    una_vuelta(puente, reloj, d, [negra()])
    assert len(fallas_rapidas(puente)) == 1, "un apagon es UNA alerta, no una por vuelta"


def test_la_falla_rapida_se_cierra_sola_cuando_vuelve(entorno):
    puente, reloj, d = entorno(configuracion(salud=salud()))
    una_vuelta(puente, reloj, d, tlalpan())
    reloj.dormir(30 * MIN)
    una_vuelta(puente, reloj, d, [negra()])
    for _ in range(3):
        reloj.dormir(30 * MIN)
        una_vuelta(puente, reloj, d, tlalpan())
    recuperadas = [c for c, _ in puente.fallas if c["evento"] == "recuperar" and c["tipo"] == "pantalla_apagada"]
    assert len(recuperadas) == 1 and recuperadas[0]["falla_id"] == "41"


def test_de_noche_o_con_la_lente_tapada_no_hay_aviso_rapido(entorno):
    puente, reloj, d = entorno(configuracion(salud=salud()))
    una_vuelta(puente, reloj, d, tlalpan())
    reloj.dormir(30 * MIN)
    una_vuelta(puente, reloj, d, [de_noche()])
    assert fallas_rapidas(puente) == [], "todo oscuro lo decide la revision de siempre, con confirmacion"


def test_sin_haber_visto_la_pantalla_funcionando_no_avisa(entorno):
    puente, reloj, d = entorno(configuracion(salud=salud()))
    una_vuelta(puente, reloj, d, [negra()])               # recien instalada, apagada
    assert fallas_rapidas(puente) == []


def test_el_aviso_rapido_se_puede_apagar(entorno):
    puente, reloj, d = entorno(configuracion(salud=salud(aviso_rapido=False)))
    una_vuelta(puente, reloj, d, tlalpan())
    reloj.dormir(30 * MIN)
    una_vuelta(puente, reloj, d, [negra()])
    assert fallas_rapidas(puente) == [], "sin aviso rapido, espera su segunda confirmacion"


def test_detector_cuenta_miradas_seguidas_y_se_reinicia_con_luz():
    det = DetectorApagada()
    negra_g = np.full((80, 120), 4, dtype=np.uint8)
    marco = cv2.resize(FONDO, (320, 213))
    sana = cv2.resize(fixture("tlalpan", 0, 192, 136), (120, 80))
    assert [det.observar(negra_g, marco, ESQUINAS) for _ in range(2)] == [False, False]
    assert det.observar(sana, marco, ESQUINAS) is False, "una mirada con luz reinicia la cuenta"
    assert [det.observar(negra_g, marco, ESQUINAS) for _ in range(4)] == [False, False, True, False], \
        "avisa UNA vez, en la tercera seguida"
