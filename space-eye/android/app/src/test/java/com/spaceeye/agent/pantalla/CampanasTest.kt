package com.spaceeye.agent.pantalla

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.ZoneOffset

/**
 * La contabilidad de las campanas de SPACE OS (referencias en disco, una prueba
 * al dia) y la huella de la configuracion. Espejo de
 * pi-agent/vision/pruebas/test_campanas.py (la parte sin OpenCV).
 */
class CampanasTest {

    @get:Rule val tmp = TemporaryFolder()

    private val MIN = 60_000L
    private val DIA = 24 * 60 * MIN
    // 2026-10-06 12:00 UTC
    private var ahora = 1_791_288_000_000L
    private val bajadas = mutableListOf<Int>()
    private var sinRed = false

    private fun campanas() = Campanas(tmp.root, { id ->
        bajadas.add(id)
        if (sinRed) null else byteArrayOf(0xFF.toByte(), 0xD8.toByte(), id.toByte())
    }, { ahora }, ZoneOffset.UTC)

    private fun lista(vararg c: Triple<Int, String, Boolean>) =
        JSONArray(c.map { JSONObject().put("id", it.first).put("sha", it.second).put("foto_hoy", it.third) })

    private fun jpgs() = File(tmp.root, "campanas").listFiles()!!.map { it.name }.filter { it.endsWith(".jpg") }.sorted()

    @Test
    fun laReferenciaSeBajaUnaSolaVez() {
        val c = campanas()
        c.actualizar(lista(Triple(7, "abc", false)))
        c.actualizar(lista(Triple(7, "abc", false)))
        assertEquals(listOf(7), bajadas)
        assertEquals(listOf("7_abc.jpg"), jpgs())
        assertEquals(1, c.tamaño)
        // Otro arranque con el archivo ya en disco tampoco la baja.
        campanas().actualizar(lista(Triple(7, "abc", false)))
        assertEquals(listOf(7), bajadas)
    }

    @Test
    fun siCambiaElArteSeBajaElNuevoYSeBorraElViejo() {
        val c = campanas()
        c.actualizar(lista(Triple(7, "abc", false)))
        c.actualizar(lista(Triple(7, "def", false)))
        assertEquals(listOf(7, 7), bajadas)
        assertEquals(listOf("7_def.jpg"), jpgs())
        assertEquals("def", c.referencias().single().sha)
    }

    @Test
    fun laCampanaQueYaNoVieneSeOlvida() {
        val c = campanas()
        c.actualizar(lista(Triple(7, "abc", false), Triple(8, "xyz", false)))
        c.actualizar(lista(Triple(8, "xyz", false)))
        assertEquals(listOf("8_xyz.jpg"), jpgs())
        assertFalse(c.pendiente(7))
        assertTrue(c.pendiente(8))
        c.actualizar(JSONArray())
        assertEquals(0, c.tamaño)
        assertTrue(jpgs().isEmpty())
    }

    @Test
    fun laQueNoSePudoBajarSeReintentaCadaDiezMinutos() {
        val c = campanas()
        sinRed = true
        c.actualizar(lista(Triple(7, "abc", false)))
        ahora += 5 * MIN
        c.actualizar(lista(Triple(7, "abc", false)))
        assertEquals("a los 5 minutos no se reintenta", listOf(7), bajadas)
        assertEquals(0, c.tamaño)
        sinRed = false
        ahora += 5 * MIN
        c.actualizar(lista(Triple(7, "abc", false)))
        assertEquals(listOf(7, 7), bajadas)
        assertEquals(1, c.tamaño)
    }

    @Test
    fun unaPruebaPorCampanaAlDiaAunTrasReiniciar() {
        val c = campanas()
        c.actualizar(lista(Triple(7, "abc", false)))
        assertTrue(c.pendiente(7))
        c.marcar(7)
        assertFalse(c.pendiente(7))
        // Reinicio: lo de hoy se lee de disco.
        val otra = campanas()
        otra.actualizar(lista(Triple(7, "abc", false)))
        assertFalse(otra.pendiente(7))
        // Al dia siguiente vuelve a tocar.
        ahora += DIA
        assertTrue(otra.pendiente(7))
        otra.actualizar(lista(Triple(7, "abc", false)))
        assertTrue(otra.pendiente(7))
    }

    @Test
    fun loQueElServidorYaTieneDeHoyCuentaComoHecho() {
        val c = campanas()
        c.actualizar(lista(Triple(7, "abc", true), Triple(8, "xyz", false)))
        assertFalse(c.pendiente(7))
        assertTrue(c.pendiente(8))
        // Y se guarda: un reinicio sin red no la repite.
        val otra = campanas()
        otra.actualizar(lista(Triple(7, "abc", false)))
        assertFalse(otra.pendiente(7))
    }

    @Test
    fun laHuellaDecideSiSeReusaLaConfiguracion() {
        val t0 = 1_000_000L
        assertTrue("misma huella y reciente: se reusa", HuellaConfig.reusar("a1", "a1", t0, t0 + 5 * MIN))
        assertFalse("la huella cambio: se pide de nuevo", HuellaConfig.reusar("b2", "a1", t0, t0 + 5 * MIN))
        assertTrue("servidor viejo, sin huella: vale el plazo", HuellaConfig.reusar(null, null, t0, t0 + 5 * MIN))
        assertTrue("sin huella ahora aunque la hubo al pedirla", HuellaConfig.reusar(null, "a1", t0, t0 + 5 * MIN))
        assertFalse("pasados los 15 minutos se pide igual", HuellaConfig.reusar("a1", "a1", t0, t0 + 15 * MIN))
        assertFalse(HuellaConfig.reusar(null, null, t0, t0 + 16 * MIN))
    }
}
