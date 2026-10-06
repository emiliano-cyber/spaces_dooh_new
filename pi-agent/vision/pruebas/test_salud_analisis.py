# Port de SaludAnalisisTest.kt, caso por caso y con las mismas fotos.
#
# Fotos REALES, enderezadas a 192 px de ancho:
#   - dublan_*: una vuelta real de MANUEL DUBLAN (equipo 13), 7 tomas entre las
#     10:59 y las 11:03 del 23-sep-2026, con las franjas del LED muy marcadas.
#   - tlalpan_*: 12 fotos de TLALPAN (equipo 6) de dias y horas distintos: un
#     caso mas dificil que una vuelta real, porque la luz cambia entre fotos.
# Las fallas se simulan encima, con el mismo ruido (java.util.Random) que en el
# telefono.
import functools

import numpy as np
import pytest

import salud_analisis as sa
from conftest import JavaRandom, gris_gz
from salud_analisis import Imagen, Pantalla


def _vuelta(nombre, n, w, h):
    out = []
    for k in range(n):
        b = gris_gz("salud/%s_%02d.gris.gz" % (nombre, k))
        out.append(Imagen(np.frombuffer(b[: w * h], dtype=np.uint8).astype(np.float64), w, h))
    return out


@functools.lru_cache(maxsize=None)
def dublan():
    return tuple(_vuelta("dublan", 7, 192, 155))


@functools.lru_cache(maxsize=None)
def tlalpan():
    return tuple(_vuelta("tlalpan", 12, 192, 136))


def ambas():
    return [list(dublan()), list(tlalpan())]


def con_zona(base, f, c, en=None, valor=None):
    """Pinta una zona con un valor fijo (gabinete apagado) en las tomas indicadas."""
    out = []
    for k, t in enumerate(base):
        if en is not None and k not in en:
            out.append(t)
            continue
        px = t.px.copy()
        for y in range(f * t.alto // 4, (f + 1) * t.alto // 4):
            for x in range(c * t.ancho // 6, (c + 1) * t.ancho // 6):
                i = y * t.ancho + x
                px[i] = 6.0 if valor is None else valor(i)
        out.append(Imagen(px, t.ancho, t.alto))
    return out


def test_una_vuelta_normal_no_alarma():
    for base in ambas():
        r = sa.analizar(base, 4, 6)
        assert r.pantalla == Pantalla.OK
        assert r.zonas == [], "no debe haber zonas: %s" % r.zonas


def test_detecta_el_gabinete_apagado():
    for base in ambas():
        for f, c in [(1, 2), (3, 0), (0, 5)]:
            r = sa.analizar(con_zona(base, f, c), 4, 6)
            assert r.pantalla == Pantalla.OK
            assert len(r.zonas) == 1
            z = r.zonas[0]
            assert z.tipo == "zona_apagada"
            assert z.fila == f
            assert z.columna == c
            assert z.confianza > 0.8


def test_detecta_el_gabinete_congelado():
    for base in ambas():
        parche = base[1]
        r = sa.analizar(con_zona(base, 2, 1, valor=lambda i: parche.px[i]), 4, 6)
        assert [(z.tipo, (z.fila, z.columna)) for z in r.zonas] == [("zona_congelada", (2, 1))]


def test_un_anuncio_con_un_recuadro_negro_no_es_una_falla():
    # El negro esta en 3 tomas y en las demas la zona cambia con el anuncio.
    r = sa.analizar(con_zona(list(tlalpan()), 1, 2, en={2, 3, 4}), 4, 6)
    assert r.zonas == []


def test_zona_excluida_no_se_juzga():
    r = sa.analizar(con_zona(list(tlalpan()), 1, 2), 4, 6, excluir={(1, 2)})
    assert r.zonas == []


def test_pantalla_apagada_y_congelada():
    rnd = JavaRandom(1)
    t3 = tlalpan()[3]
    apagada = [Imagen([8 + rnd.next_gaussian() * 1.5 for _ in range(t.px.size)], t.ancho, t.alto) for t in tlalpan()]
    assert sa.analizar(apagada, 4, 6).pantalla == Pantalla.APAGADA
    fija = [Imagen([t3.px[i] + rnd.next_gaussian() * 1.5 for i in range(t3.px.size)], t.ancho, t.alto)
            for t in tlalpan()]
    assert sa.analizar(fija, 4, 6).pantalla == Pantalla.CONGELADA


def apagar(base, filas, columnas, zonas):
    """Apaga varias zonas de una cuadricula filas x columnas."""
    out = []
    for t in base:
        m = t.px.copy().reshape(t.alto, t.ancho)
        for f, c in zonas:
            m[f * t.alto // filas:(f + 1) * t.alto // filas, c * t.ancho // columnas:(c + 1) * t.ancho // columnas] = 6.0
        out.append(Imagen(m.reshape(-1), t.ancho, t.alto))
    return out


TODAS_5X3 = [(f, c) for f in range(5) for c in range(3)]


def test_media_pantalla_apagada_se_detecta_como_una_sola_falla():
    # El caso real del 25-sep: media pantalla tapada en una cuadricula de 5x3.
    # Con la mediana como referencia daba 0 de 8.
    for base in ambas():
        mitad = TODAS_5X3[:8]
        r = sa.analizar(apagar(base, 5, 3, mitad), 5, 3)
        assert len(r.zonas) == 1
        z = r.zonas[0]
        assert z.tipo == "zona_apagada"
        assert set(z.grupo) == set(mitad)


@pytest.mark.parametrize("k", [10, 12])
def test_dos_tercios_y_casi_toda_la_pantalla_apagada(k):
    for base in ambas():
        muertas = TODAS_5X3[:k]
        r = sa.analizar(apagar(base, 5, 3, muertas), 5, 3)
        (z,) = r.zonas
        assert set(z.grupo) == set(muertas), "con %d de 15 apagadas" % k


def test_dos_gabinetes_apagados_son_dos_fallas():
    r = sa.analizar(apagar(list(tlalpan()), 5, 3, [(0, 0), (4, 2)]), 5, 3)
    assert {(z.fila, z.columna) for z in r.zonas} == {(0, 0), (4, 2)}
    assert all(not z.grupo for z in r.zonas)


def tapar(base, filas, columnas, zonas):
    """Tapa zonas con algo claro y liso (como el bloc de notas de la prueba real)."""
    rnd = JavaRandom(4)
    out = []
    for t in base:
        px = t.px.copy()
        for f, c in zonas:
            for y in range(f * t.alto // filas, (f + 1) * t.alto // filas):
                for x in range(c * t.ancho // columnas, (c + 1) * t.ancho // columnas):
                    px[y * t.ancho + x] = 190 + rnd.next_gaussian() * 1.5 - (6 if y % 9 == 0 else 0)
        out.append(Imagen(px, t.ancho, t.alto))
    return out


def test_media_pantalla_tapada_con_algo_claro_se_detecta():
    # El caso real del 28-sep: un bloc de notas delante de la mitad de arriba.
    for base in ambas():
        arriba = TODAS_5X3[:6]
        r = sa.analizar(tapar(base, 5, 3, arriba), 5, 3)
        (z,) = r.zonas
        assert z.tipo == "zona_congelada"
        assert set(z.grupo) == set(arriba)


def test_un_gabinete_pegado_en_un_color_fijo_se_detecta():
    r = sa.analizar(tapar(list(tlalpan()), 5, 3, [(2, 1)]), 5, 3)
    assert [(z.tipo, (z.fila, z.columna)) for z in r.zonas] == [("zona_congelada", (2, 1))]


def _columna_gris(base, ganancia=None, sesiones=None):
    derecha = [(f, 2) for f in range(5)]
    out = []
    for k, t in enumerate(base):
        g = 1.0 if ganancia is None else ganancia(sesiones[k])
        m = np.minimum(255.0, t.px * g).reshape(t.alto, t.ancho) if ganancia else t.px.copy().reshape(t.alto, t.ancho)
        for f, c in derecha:
            m[f * t.alto // 5:(f + 1) * t.alto // 5, c * t.ancho // 3:(c + 1) * t.ancho // 3] = 45.0 * g
        out.append(Imagen(m.reshape(-1), t.ancho, t.alto))
    return derecha, out


def test_una_zona_gris_oscura_quieta_tiene_confianza_alta():
    # Lo que se vio el 28-sep: la ventana del Bloc de notas, gris oscuro y
    # quieta, sobre la columna derecha. Debe pasar el umbral de 0.6.
    for base in ambas():
        derecha, gris = _columna_gris(base)
        (z,) = sa.analizar(gris, 5, 3).zonas
        assert set(z.grupo) == set(derecha)
        assert z.confianza >= 0.6, "confianza %s" % z.confianza


def test_el_tramo_mas_largo():
    assert sa.tramo_mas_largo([1, 1, 1, 2, 2, 2, 2, 3]) == range(3, 7)
    assert sa.tramo_mas_largo([1, 1, 1, 1]) == range(0, 4)
    assert sa.tramo_mas_largo([1, 1, 2, 2]) == range(2, 4)   # empate: el ultimo
    assert len(sa.tramo_mas_largo([])) == 0


def test_una_vuelta_interrumpida_se_juzga_con_su_tramo_mas_largo():
    # Lo que paso el 28-sep a las 16:42: a mitad de la vuelta se abrio la vista
    # en vivo; al volver, la camara fijo la exposicion un 35% mas alta. La
    # columna tapada (gris quieto) salta de brillo entre los dos tramos.
    base = list(tlalpan())
    sesiones = [1 if k < 5 else 2 for k in range(len(base))]
    derecha, vuelta = _columna_gris(base, ganancia=lambda s: 1.35 if s == 2 else 1.0, sesiones=sesiones)
    tramo = sa.tramo_mas_largo(sesiones)
    (z,) = sa.analizar([vuelta[i] for i in tramo], 5, 3).zonas
    assert set(z.grupo) == set(derecha)
    assert z.confianza >= 0.6, "confianza %s" % z.confianza


def test_en_cuadricula_5x3_sin_falla_no_alarma():
    for base in ambas():
        assert sa.analizar(base, 5, 3).zonas == []


def test_pocas_tomas_es_inconcluso():
    assert sa.analizar(list(dublan())[:3], 4, 6).pantalla == Pantalla.INCONCLUSO
