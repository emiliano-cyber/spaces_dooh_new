package com.spaceeye.agent.pantalla

import com.spaceeye.agent.pantalla.SaludAnalisis.Pantalla
import com.spaceeye.agent.pantalla.SaludAnalisis.Resultado
import com.spaceeye.agent.pantalla.SaludAnalisis.Zona
import com.spaceeye.agent.pantalla.Seguimiento.Camara
import com.spaceeye.agent.pantalla.Seguimiento.Observacion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SeguimientoTest {

    private val HORA = 60 * 60_000L
    private val sana = Array(4) { DoubleArray(6) { 1.0 } }

    private fun vuelta(vararg zonas: Zona, pantalla: Pantalla = Pantalla.OK, camara: Camara = Camara.OK, actividad: Array<DoubleArray> = sana) =
        Observacion(Resultado(pantalla, 18, 12, zonas.toList(), actividad, sana), camara, 4, 6)

    private val gabinete = Zona("zona_apagada", 1, 2, 0.9)

    @Test
    fun unaSolaVueltaNoAlarma_dosSeguidasSi() {
        val s = Seguimiento()
        assertTrue(s.registrar(0, vuelta(gabinete), false).isEmpty())
        val e = s.registrar(HORA, vuelta(gabinete), false)
        assertEquals(1, e.size)
        assertEquals("abrir", e[0].accion)
        assertEquals("zona_apagada:1:2", e[0].clave)
        assertEquals(1, e[0].fila)
    }

    @Test
    fun dosVueltasMuyJuntasCuentanComoUna() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        assertTrue(s.registrar(10 * 60_000L, vuelta(gabinete), false).isEmpty())
    }

    @Test
    fun conElIntervaloDePruebasDe5MinutosAlarmaALaSegundaVuelta() {
        val s = Seguimiento()
        s.separacionMs = 4 * 60_000L          // lo que pone el Monitor con 5 min
        val cinco = 5 * 60_000L
        assertTrue(s.registrar(0, vuelta(gabinete), false).isEmpty())
        assertEquals(1, s.registrar(cinco, vuelta(gabinete), false).size)
    }

    @Test
    fun unaVueltaSanaEnMedioReiniciaLaCuenta() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        s.registrar(HORA, vuelta(), false)
        assertTrue(s.registrar(2 * HORA, vuelta(gabinete), false).isEmpty())
    }

    @Test
    fun unaVueltaInconclusaNoReinicia() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        s.registrar(HORA, vuelta(pantalla = Pantalla.INCONCLUSO), false)
        assertEquals(1, s.registrar(2 * HORA, vuelta(gabinete), false).size)
    }

    @Test
    fun noRepiteYRegistraLaRecuperacion() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        val abierta = s.registrar(HORA, vuelta(gabinete), false).single()
        s.confirmada(abierta.clave, 77)
        assertTrue(s.registrar(2 * HORA, vuelta(gabinete), false).isEmpty())
        assertTrue(s.registrar(3 * HORA, vuelta(), false).isEmpty())
        val r = s.registrar(4 * HORA, vuelta(), false).single()
        assertEquals("recuperar", r.accion)
        assertEquals(77L, r.fallaId)
    }

    @Test
    fun confianzaBajaNoAlarma() {
        val s = Seguimiento()
        val dudosa = gabinete.copy(confianza = 0.3)
        s.registrar(0, vuelta(dudosa), false)
        assertTrue(s.registrar(HORA, vuelta(dudosa), false).isEmpty())
    }

    @Test
    fun aprendiendoNoAvisaYExcluyeLoQueNuncaCambia() {
        val s = Seguimiento()
        // La esquina (3,5) esta tapada por una barda: nunca se mueve.
        val tapada = Array(4) { f -> DoubleArray(6) { c -> if (f == 3 && c == 5) 0.05 else 1.0 } }
        for (k in 0 until 4) assertTrue(s.registrar(k * HORA, vuelta(Zona("zona_congelada", 3, 5, 0.9), actividad = tapada), true).isEmpty())
        assertEquals(setOf(3 to 5), s.excluidas())
        // Ya fuera del aprendizaje, esa zona no cuenta como juzgable.
        s.registrar(5 * HORA, vuelta(Zona("zona_congelada", 3, 5, 0.9)), false)
        // (el analisis ya no la reportaria porque se le pasa como excluida)
    }

    @Test
    fun loDescartadoNoVuelveASonar() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false, silenciadas = setOf("zona_apagada:1:2"))
        assertTrue(s.registrar(HORA, vuelta(gabinete), false, silenciadas = setOf("zona_apagada:1:2")).isEmpty())
    }

    @Test
    fun elTopeDiarioDejaLaFallaPendiente() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        assertTrue(s.registrar(HORA, vuelta(gabinete), false, puedeAbrir = 0).isEmpty())
        assertEquals(1, s.registrar(2 * HORA, vuelta(gabinete), false, puedeAbrir = 1).size)
    }

    @Test
    fun conLaCamaraMovidaNoSeJuzgaLaPantalla() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        s.registrar(HORA, vuelta(camara = Camara.MOVIDA), false)
        val e = s.registrar(2 * HORA, vuelta(camara = Camara.MOVIDA), false)
        assertEquals(listOf("camara_movida"), e.map { it.tipo })
    }

    @Test
    fun pantallaApagadaSeAvisaComoUna() {
        val s = Seguimiento()
        s.registrar(0, vuelta(pantalla = Pantalla.APAGADA), false)
        val e = s.registrar(HORA, vuelta(pantalla = Pantalla.APAGADA), false)
        assertEquals(listOf("pantalla_apagada"), e.map { it.tipo })
        assertEquals(null, e[0].fila)
    }

    @Test
    fun sobreviveAUnReinicio() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        val otra = Seguimiento()
        otra.deJson(org.json.JSONObject(s.aJson().toString()))
        assertEquals(1, otra.registrar(HORA, vuelta(gabinete), false).size)
    }

    @Test
    fun loCerradoEnElServidorSeOlvida() {
        val s = Seguimiento()
        s.registrar(0, vuelta(gabinete), false)
        val a = s.registrar(HORA, vuelta(gabinete), false).single()
        s.confirmada(a.clave, 5)
        s.sincronizar(emptyMap())   // alguien la cerro en el dashboard
        s.registrar(2 * HORA, vuelta(gabinete), false)
        assertEquals(1, s.registrar(3 * HORA, vuelta(gabinete), false).size)
    }
}
