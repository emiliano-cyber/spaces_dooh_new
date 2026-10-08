package com.spaceeye.agent.pantalla

import com.spaceeye.agent.pantalla.SaludAnalisis.Pantalla
import com.spaceeye.agent.pantalla.SaludAnalisis.Resultado
import com.spaceeye.agent.pantalla.Seguimiento.Camara
import com.spaceeye.agent.pantalla.Seguimiento.Observacion
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * Aviso rapido de pantalla COMPLETA apagada. Espejo de
 * pi-agent/vision/pruebas/test_lote_y_apagada.py (la parte de pantalla apagada).
 */
class ApagadaRapidaTest {

    // El marco (foto entera reducida) y la pantalla enderezada, en gris.
    private val W = 320
    private val H = 213
    private val esquinas = listOf(0.3 to 0.3, 0.7 to 0.3, 0.7 to 0.7, 0.3 to 0.7)

    private fun marco(fuera: Int, dentro: Int): ByteArray = ByteArray(W * H) { i ->
        val x = (i % W + 0.5) / W; val y = (i / W + 0.5) / H
        (if (x in 0.3..0.7 && y in 0.3..0.7) dentro else fuera).toByte()
    }
    private val pantallaNegra = ByteArray(120 * 80) { 4 }
    private val pantallaSana = Random(7).let { r -> ByteArray(120 * 80) { r.nextInt(256).toByte() } }

    private val dia = marco(fuera = 120, dentro = 4)
    private val noche = marco(fuera = 10, dentro = 4)

    private fun mirar(d: DetectorApagada, pantalla: ByteArray, m: ByteArray = dia) =
        d.observar(d.medir(pantalla, m, W, H, esquinas))

    @Test
    fun cuentaMiradasSeguidasYSeReiniciaConLuz() {
        val d = DetectorApagada()
        assertEquals(listOf(false, false), List(2) { mirar(d, pantallaNegra) })
        assertFalse("una mirada con luz reinicia la cuenta", mirar(d, pantallaSana))
        assertEquals("avisa UNA vez, en la tercera seguida",
            listOf(false, false, true, false), List(4) { mirar(d, pantallaNegra) })
    }

    @Test
    fun deNocheOConLaLenteTapadaNoHayAvisoRapido() {
        val d = DetectorApagada()
        val m = d.medir(pantallaNegra, noche, W, H, esquinas)
        assertTrue(m.oscura)
        assertFalse("todo oscuro lo decide la revision de siempre, con confirmacion", m.fueraIluminada)
        assertEquals(listOf(false, false, false, false), List(4) { mirar(d, pantallaNegra, noche) })
    }

    @Test
    fun loDeAlrededorNoIncluyeLaPantalla() {
        // Con la pantalla negra dentro del marco, lo de fuera mide solo el entorno.
        val m = DetectorApagada().medir(pantallaNegra, dia, W, H, esquinas)
        assertEquals(120.0, m.fuera, 0.5)
    }

    @Test
    fun camaraOcupadaOReabiertaReiniciaLaCuenta() {
        val d = DetectorApagada()
        mirar(d, pantallaNegra); mirar(d, pantallaNegra)
        d.reiniciar()
        assertFalse(mirar(d, pantallaNegra))
        assertFalse(mirar(d, pantallaNegra))
        assertTrue(mirar(d, pantallaNegra))
    }

    @Test
    fun cuandoSePuedeAvisar() {
        assertTrue(DetectorApagada.puedeAvisar(vueltasSalud = 1, yaAbierta = false, silenciada = false, restantesHoy = 6))
        assertFalse("sin haber visto la pantalla funcionando no avisa",
            DetectorApagada.puedeAvisar(0, false, false, 6))
        assertFalse(DetectorApagada.puedeAvisar(1, yaAbierta = true, silenciada = false, restantesHoy = 6))
        assertFalse(DetectorApagada.puedeAvisar(1, false, silenciada = true, restantesHoy = 6))
        assertFalse(DetectorApagada.puedeAvisar(1, false, false, restantesHoy = 0))
    }

    @Test
    fun seEnciendePorOmisionYSePuedeApagar() {
        assertTrue(DetectorApagada.activo(JSONObject("""{"vigilar":true}""")))
        assertFalse(DetectorApagada.activo(JSONObject("""{"vigilar":true,"aviso_rapido":false}""")))
        assertFalse("sin vigilar la salud no hay aviso", DetectorApagada.activo(JSONObject("""{"vigilar":false}""")))
        assertFalse(DetectorApagada.activo(null))
        assertTrue(DetectorApagada.silenciada(JSONObject("""{"silenciadas":["pantalla_apagada"]}""")))
        assertFalse(DetectorApagada.silenciada(JSONObject("""{"silenciadas":["sin_imagen"]}""")))
    }

    // --- El recorrido completo con Seguimiento, como lo hace el Monitor ---------

    private val HORA = 60 * 60_000L
    private val sana = Array(2) { DoubleArray(3) { 1.0 } }
    private fun vuelta(p: Pantalla) = Observacion(Resultado(p, 18, 12, emptyList(), sana, sana), Camara.OK, 2, 3)

    /** Lo que hace Monitor.salud con las abiertas del servidor antes de registrar. */
    private fun sincronizar(s: Seguimiento, cfg: JSONObject) {
        val m = mutableMapOf<String, Long>()
        cfg.optJSONArray("abiertas")?.let { a -> for (i in 0 until a.length()) a.getJSONObject(i).let { o ->
            m[Seguimiento.claveDelServidor(o.getString("tipo"), null, null)] = o.getLong("id")
        } }
        s.sincronizar(m)
    }

    /** Un vistazo del recorrido: si el detector completa el apagon y se puede, se avisa. */
    private fun vistazo(d: DetectorApagada, s: Seguimiento, cfg: JSONObject, vueltasSalud: Int, pantalla: ByteArray,
                        avisos: MutableList<Long?>, id: Long?) {
        if (DetectorApagada.activo(cfg) && mirar(d, pantalla) &&
            DetectorApagada.puedeAvisar(vueltasSalud, s.estaAbierta(DetectorApagada.CLAVE), DetectorApagada.silenciada(cfg),
                cfg.optInt("restantes_hoy", 6))) {
            avisos.add(id)
            DetectorApagada.anotar(s, cfg, id)
        }
    }

    @Test
    fun avisaEnLaMismaVueltaUnaSolaVezYSeCierraSoloConElMismoNumero() {
        val d = DetectorApagada()
        val s = Seguimiento()
        val avisos = mutableListOf<Long?>()
        // La vuelta 1 la vio funcionando.
        var t = 0L
        s.registrar(t, vuelta(Pantalla.OK), aprendiendo = true)
        val vueltasSalud = 1

        // Vuelta 2: apagada. La configuracion se pidio antes del aviso.
        t += HORA
        var cfg = JSONObject("""{"vigilar":true,"restantes_hoy":6,"abiertas":[]}""")
        repeat(3) { vistazo(d, s, cfg, vueltasSalud, pantallaNegra, avisos, 41L) }
        assertEquals("a los 3 vistazos, dentro de la vuelta", listOf<Long?>(41L), avisos)
        assertEquals(5, cfg.getInt("restantes_hoy"))
        // La revision de la MISMA vuelta no la olvida (esta anotada en `abiertas`).
        sincronizar(s, cfg)
        assertTrue(s.estaAbierta("pantalla_apagada"))
        assertTrue("la revision de siempre no la abre otra vez", s.registrar(t, vuelta(Pantalla.APAGADA), false).isEmpty())

        // Vuelta 3: sigue apagada; el servidor ya la tiene abierta. Un apagon es UNA alerta.
        t += HORA
        cfg = JSONObject("""{"vigilar":true,"restantes_hoy":5,"abiertas":[{"id":41,"tipo":"pantalla_apagada"}]}""")
        d.reiniciar()   // la camara se reabre en cada vuelta
        repeat(6) { vistazo(d, s, cfg, vueltasSalud, pantallaNegra, avisos, 42L) }
        assertEquals(1, avisos.size)
        sincronizar(s, cfg)
        assertTrue(s.registrar(t, vuelta(Pantalla.APAGADA), false).isEmpty())

        // Vuelve: tras `recuperacion` (2) vueltas sanas se cierra con el mismo numero.
        val cerradas = (1..3).flatMap {
            t += HORA
            sincronizar(s, cfg)
            s.registrar(t, vuelta(Pantalla.OK), false)
        }.filter { it.accion == "recuperar" }
        assertEquals(1, cerradas.size)
        assertEquals("pantalla_apagada", cerradas[0].tipo)
        assertEquals(41L, cerradas[0].fallaId)
    }

    @Test
    fun sinAnotarlaEnAbiertasLaRevisionDeEsaVueltaLaOlvidaria() {
        // El error que cazaron las pruebas de la Raspberry: por eso anotar() la
        // agrega a la configuracion de la vuelta.
        val s = Seguimiento()
        s.abrirExterna("pantalla_apagada", 41L)
        s.sincronizar(emptyMap())
        assertFalse(s.estaAbierta("pantalla_apagada"))
    }

    @Test
    fun sinRedQuedaAbiertaSinNumeroYNoSeRepite() {
        val d = DetectorApagada()
        val s = Seguimiento()
        val avisos = mutableListOf<Long?>()
        val cfg = JSONObject("""{"vigilar":true,"restantes_hoy":6}""")
        repeat(3) { vistazo(d, s, cfg, 1, pantallaNegra, avisos, null) }
        assertEquals(listOf<Long?>(null), avisos)
        sincronizar(s, cfg)
        assertTrue("sin numero aguanta la sincronizacion (va en la cola)", s.estaAbierta("pantalla_apagada"))
        d.reiniciar()
        repeat(3) { vistazo(d, s, cfg, 1, pantallaNegra, avisos, null) }
        assertEquals(1, avisos.size)
    }

    @Test
    fun noAvisaDeNocheNiSinHaberlaVistoNiApagado() {
        val avisos = mutableListOf<Long?>()
        val s = Seguimiento()
        // De noche
        val d1 = DetectorApagada()
        val cfg = JSONObject("""{"vigilar":true,"restantes_hoy":6}""")
        repeat(4) {
            if (mirar(d1, pantallaNegra, noche)) avisos.add(1)
        }
        // Recien instalada, apagada
        val d2 = DetectorApagada()
        repeat(4) { vistazo(d2, s, cfg, 0, pantallaNegra, avisos, 1) }
        // Aviso rapido apagado en el panel
        val d3 = DetectorApagada()
        val apagado = JSONObject("""{"vigilar":true,"aviso_rapido":false,"restantes_hoy":6}""")
        repeat(4) { vistazo(d3, s, apagado, 1, pantallaNegra, avisos, 1) }
        assertTrue(avisos.isEmpty())
    }
}
