package com.spaceeye.agent.pantalla

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalTime

class GeometriaTest {

    // Las esquinas de TLALPAN, marcadas sobre una foto real (se ve en diagonal).
    private val tlalpan = """{"esquinas":[[0.258,0.244],[0.928,0.193],[0.875,0.687],[0.298,0.957]],
        "filas":4,"columnas":6,"excluir":[[3,5]],"horario":{"inicio":"06:00","fin":"24:00"}}"""

    @Test
    fun leeLaConfiguracion() {
        val g = Geometria.deJson(JSONObject(tlalpan))!!
        assertEquals(4, g.filas)
        assertEquals(setOf(3 to 5), g.excluir)
        assertEquals(LocalTime.of(6, 0), g.inicio)
        assertEquals(LocalTime.MIDNIGHT, g.fin)
    }

    @Test
    fun sinEsquinasNoHayGeometria() {
        assertNull(Geometria.deJson(JSONObject("""{"filas":4}""")))
        assertNull(Geometria.deJson(null))
    }

    @Test
    fun lasEsquinasDelCuadradoCaenEnLasDeLaFoto() {
        val g = Geometria.deJson(JSONObject(tlalpan))!!
        val casi = { a: Pair<Double, Double>, b: Pair<Double, Double> ->
            assertEquals(a.first, b.first, 1e-9); assertEquals(a.second, b.second, 1e-9) }
        casi(g.esquinas[0], g.aFoto(0.0, 0.0))
        casi(g.esquinas[1], g.aFoto(1.0, 0.0))
        casi(g.esquinas[2], g.aFoto(1.0, 1.0))
        casi(g.esquinas[3], g.aFoto(0.0, 1.0))
        // El primer gabinete empieza en la esquina de arriba a la izquierda.
        casi(g.esquinas[0], g.contorno(0, 0)[0])
    }

    @Test
    fun numeraLosGabinetesComoUnaPersona() {
        val g = Geometria.deJson(JSONObject(tlalpan))!!
        assertEquals(1, g.numero(0, 0))
        assertEquals(6, g.numero(0, 5))
        assertEquals(7, g.numero(1, 0))
        assertEquals(24, g.numero(3, 5))
    }

    @Test
    fun horarioDe6a24() {
        val i = LocalTime.of(6, 0); val f = LocalTime.MIDNIGHT
        assertFalse(Geometria.enHorario(LocalTime.of(5, 30), i, f))
        assertFalse(Geometria.enHorario(LocalTime.of(6, 5), i, f))     // el reproductor apenas arranca
        assertTrue(Geometria.enHorario(LocalTime.of(6, 15), i, f))
        assertTrue(Geometria.enHorario(LocalTime.of(23, 45), i, f))
        assertFalse(Geometria.enHorario(LocalTime.of(23, 55), i, f))
        assertFalse(Geometria.enHorario(LocalTime.of(2, 0), i, f))
    }

    @Test
    fun horarioQueCruzaLaMedianoche() {
        val i = LocalTime.of(18, 0); val f = LocalTime.of(2, 0)
        assertTrue(Geometria.enHorario(LocalTime.of(23, 0), i, f))
        assertTrue(Geometria.enHorario(LocalTime.of(1, 0), i, f))
        assertFalse(Geometria.enHorario(LocalTime.of(3, 0), i, f))
        assertFalse(Geometria.enHorario(LocalTime.of(12, 0), i, f))
    }
}
