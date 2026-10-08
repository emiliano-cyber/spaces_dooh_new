package com.spaceeye.agent.pantalla

import com.spaceeye.agent.pantalla.LoteCreativos.Destino
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Envio agrupado de creativos nuevos y el tope del dia. Espejo de
 * pi-agent/vision/pruebas/test_lote_y_apagada.py (la parte de creativos).
 */
class LoteCreativosTest {

    @get:Rule val tmp = TemporaryFolder()

    private val MIN = 60_000L
    private var ahora = 1_000L
    private fun lote() = LoteCreativos(tmp.root) { ahora }
    private fun indice() = JSONObject(File(tmp.root, "lote/lote.json").readText()).getJSONObject("items")

    @Test
    fun conEnvioAgrupadoNoSeSubeAlMomento() {
        assertEquals(Destino.LOTE, LoteCreativos.destino(aprendiendo = false, envioMin = 120, restantes = 6))
        assertEquals(Destino.SUBIR, LoteCreativos.destino(aprendiendo = false, envioMin = 0, restantes = 6))
    }

    @Test
    fun enAprendizajeNoSeGuardaNiSeSubeNada() {
        assertEquals(Destino.NINGUNO, LoteCreativos.destino(aprendiendo = true, envioMin = 120, restantes = 6))
        assertEquals(Destino.NINGUNO, LoteCreativos.destino(aprendiendo = true, envioMin = 0, restantes = 6))
    }

    @Test
    fun unaVueltaPuedeUsarTodoElTopeDelDia() {
        // Antes: `fotos < restantes` con cada foto sumando a una y restando a la
        // otra. Con tope 5 y 5 creativos nuevos solo subian 3.
        var restantes = 5
        var fotos = 0
        repeat(5) {
            if (LoteCreativos.destino(false, 0, restantes) == Destino.SUBIR) { fotos++; restantes-- }
        }
        assertEquals(5, fotos)
        assertEquals(0, restantes)
        assertEquals(Destino.NINGUNO, LoteCreativos.destino(false, 0, restantes))
    }

    @Test
    fun seGuardanEnDiscoYSalenJuntasAlCumplirseElPlazo() {
        val l = lote()
        l.agregar("hB", byteArrayOf(1), 10.0)
        ahora += MIN
        l.agregar("hC", byteArrayOf(2), 10.0)
        assertEquals("quedan guardadas en disco (sobreviven a un reinicio)", 2, indice().length())
        ahora += 6 * MIN
        assertFalse("6 min despues: todavia no", l.debeEnviar(120))
        ahora += 2 * 60 * MIN
        assertTrue(l.debeEnviar(120))

        val subidas = mutableListOf<String>()
        val e = l.enviar(6) { h, _ -> subidas.add(h); true }
        assertEquals("salen juntas, una por creativo, en el orden en que aparecieron", listOf("hB", "hC"), subidas)
        assertEquals(LoteCreativos.Envio(2, 4, 0), e)
        assertEquals(0, indice().length())
        assertFalse(l.debeEnviar(120))
    }

    @Test
    fun elEnvioRespetaElTopeDelDia() {
        val l = lote()
        l.agregar("hB", byteArrayOf(1), 10.0)
        l.agregar("hC", byteArrayOf(2), 10.0)
        ahora += 120 * MIN
        val subidas = mutableListOf<String>()
        val e = l.enviar(1) { h, _ -> subidas.add(h); true }
        assertEquals("el tope diario manda: 1 foto", 1, subidas.size)
        assertEquals(1, e.quedan)
        assertEquals("la otra espera", 1, indice().length())
        // La siguiente ventana cuenta desde este envio.
        assertFalse(l.debeEnviar(120))
    }

    @Test
    fun laQueNoSePudoSubirEspera() {
        val l = lote()
        l.agregar("hB", byteArrayOf(1), 10.0)
        ahora += 120 * MIN
        val e = l.enviar(6) { _, _ -> false }
        assertEquals(0, e.enviadas)
        assertTrue(l.tiene("hB"))
    }

    @Test
    fun volverAlMomentoVaciaLoQueEsperaba() {
        val l = lote()
        l.agregar("hB", byteArrayOf(1), 10.0)
        assertFalse(l.debeEnviar(480))
        assertTrue("se cambio a \"al momento\" en el panel", l.debeEnviar(0))
        assertFalse("sin nada esperando no hay envio", lote().also { it.enviar(6) { _, _ -> true } }.debeEnviar(0))
    }

    @Test
    fun seQuedaConLaFotoMasNitidaYSobreviveAUnReinicio() {
        val l = lote()
        l.agregar("h1", "borrosa".toByteArray(), 10.0)
        assertFalse(l.mejoraria("h1", 5.0))
        assertFalse(l.mejorar("h1", "peor".toByteArray(), 5.0))
        assertTrue(l.mejorar("h1", "nitida".toByteArray(), 30.0))
        assertFalse("solo mejora las que esperan", l.mejorar("h2", "x".toByteArray(), 99.0))
        assertEquals(listOf("h1" to "nitida"), l.pendientes().map { it.first to String(it.second) })

        val otra = lote()
        assertEquals(listOf("h1" to "nitida"), otra.pendientes().map { it.first to String(it.second) })
        assertFalse(otra.tocaEnviar(120))
        ahora += 120 * MIN
        assertTrue(otra.tocaEnviar(120))
    }
}
