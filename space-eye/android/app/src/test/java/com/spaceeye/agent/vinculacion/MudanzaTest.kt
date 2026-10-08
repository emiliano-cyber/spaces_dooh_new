package com.spaceeye.agent.vinculacion

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MudanzaTest {

    private val viejo = "http://159.203.188.58:4000"
    private val nuevo = "https://eyes.miempresa.com"
    private val ahora = 1_800_000_000_000L
    private val min = 60_000L

    private val estadoViejo = Mudanza.Estado(viejo, "llave-vieja", viejo, null)

    /** El TokenStore de las pruebas: memoria. */
    private class Memoria(var estado: Mudanza.Estado) : Mudanza.Almacen {
        var escrituras = 0
        override fun leer() = estado
        override fun guardar(estado: Mudanza.Estado) { this.estado = estado; escrituras++ }
    }

    private fun orden(json: String) = Mudanza.leerOrden(JSONObject(json))

    // --- Leer la orden ---

    @Test
    fun ordenValidaSinCodigo() {
        val l = orden("""{"mudanza":{"servidor":"https://eyes.miempresa.com/"}}""")
        assertEquals(Mudanza.Lectura.Valida(Mudanza.Orden(nuevo, null, 30)), l)
    }

    @Test
    fun ordenConCodigoYEspera() {
        val l = orden("""{"mudanza":{"servidor":"https://eyes.miempresa.com","codigo":"abcd-2345","mudanza_espera_min":10}}""")
        assertEquals(Mudanza.Lectura.Valida(Mudanza.Orden(nuevo, "ABCD2345", 10)), l)
        // La espera tambien puede venir junto a la mudanza.
        val l2 = orden("""{"mudanza":{"servidor":"https://eyes.miempresa.com"},"mudanza_espera_min":5}""")
        assertEquals(5, (l2 as Mudanza.Lectura.Valida).orden.esperaMin)
    }

    @Test
    fun ordenConCodigoNuloOVacioEsSinCodigo() {
        assertNull((orden("""{"mudanza":{"servidor":"https://eyes.x.com","codigo":null}}""") as Mudanza.Lectura.Valida).orden.codigo)
        assertNull((orden("""{"mudanza":{"servidor":"https://eyes.x.com","codigo":""}}""") as Mudanza.Lectura.Valida).orden.codigo)
    }

    @Test
    fun otrosUpdateConfigNoSonMudanza() {
        assertEquals(Mudanza.Lectura.NoEsMudanza, orden("""{"calidad":"alta"}"""))
        assertEquals(Mudanza.Lectura.NoEsMudanza, orden("{}"))
        assertEquals(Mudanza.Lectura.NoEsMudanza, Mudanza.leerOrden(null))
    }

    @Test
    fun ordenInvalida() {
        assertTrue(orden("""{"mudanza":{}}""") is Mudanza.Lectura.Invalida)
        assertTrue(orden("""{"mudanza":{"servidor":"ftp://eyes.x.com"}}""") is Mudanza.Lectura.Invalida)
        assertTrue(orden("""{"mudanza":{"servidor":"https://eyes.x.com","codigo":"ABCD1234"}}""") is Mudanza.Lectura.Invalida)
    }

    // --- Prepararse antes de moverse ---

    @Test
    fun altaFallidaNoTocaNadaYDiceElMotivo() {
        val casos = mapOf(
            Mudanza.Alta.Rechazada("vinculacion_requerida", 403) to
                "el servidor nuevo no conoce este equipo y la orden no trae codigo de vinculacion",
            Mudanza.Alta.Rechazada("codigo_invalido", 403) to
                "el servidor nuevo rechazo el codigo (vencido, usado o cancelado)",
            Mudanza.Alta.SinRed("timeout") to "no pude hablar con el servidor nuevo (timeout)",
        )
        for ((alta, motivo) in casos) {
            val mem = Memoria(estadoViejo)
            var avisado = false
            val r = Mudanza.intentar(Mudanza.Orden(nuevo, null, 30), mem, ahora, { _, _ -> alta }) { avisado = true }
            assertEquals(Mudanza.Resultado.Fallo(motivo), r)
            assertEquals(estadoViejo, mem.estado)
            assertEquals(0, mem.escrituras)
            assertEquals(false, avisado)
        }
    }

    @Test
    fun mismoServidorNoSeMuda() {
        val mem = Memoria(estadoViejo)
        var llamado = false
        val r = Mudanza.intentar(Mudanza.Orden(viejo, null, 30), mem, ahora, { _, _ -> llamado = true; Mudanza.Alta.Lista("x", 1) }) {}
        assertTrue(r is Mudanza.Resultado.Fallo)
        assertEquals(false, llamado)
        assertEquals(0, mem.escrituras)
    }

    @Test
    fun altaBuenaAvisaConElEstadoViejoYLuegoCambia() {
        val mem = Memoria(estadoViejo)
        var enviado: Pair<String, String?>? = null
        var estadoAlAvisar: Mudanza.Estado? = null
        val r = Mudanza.intentar(Mudanza.Orden(nuevo, "ABCD2345", 15), mem, ahora, { s, c ->
            enviado = s to c
            Mudanza.Alta.Lista("llave-nueva", 77)
        }) { estadoAlAvisar = mem.estado }

        assertEquals(nuevo to "ABCD2345", enviado)
        // Se le contesto al viejo ANTES de cambiar.
        assertEquals(estadoViejo, estadoAlAvisar)
        assertEquals(77L, (r as Mudanza.Resultado.Lista).deviceIdNuevo)
        assertEquals(
            Mudanza.Estado(nuevo, "llave-nueva", nuevo, Mudanza.Pendiente(viejo, "llave-vieja", ahora, 15)),
            mem.estado,
        )
    }

    @Test
    fun laLlaveDeOtroServidorNoSeGuardaParaVolver() {
        val raro = Mudanza.Estado(viejo, "llave-de-otro", "https://otro", null)
        val r = Mudanza.preparar(Mudanza.Orden(nuevo, null, 30), raro, ahora) { _, _ -> Mudanza.Alta.Lista("n", null) }
        assertNull((r as Mudanza.Resultado.Lista).estado.pendiente!!.tokenAnterior)
    }

    // --- Confirmar o regresar ---

    private val pendiente = Mudanza.Pendiente(viejo, "llave-vieja", ahora, 30)

    @Test
    fun sinMudanzaNoHayNadaQueHacer() {
        assertEquals(Mudanza.Accion.NADA, Mudanza.decidir(null, true, ahora))
        assertEquals(Mudanza.Accion.NADA, Mudanza.decidir(null, false, ahora + 999 * min))
    }

    @Test
    fun reporteBuenoConfirma() {
        assertEquals(Mudanza.Accion.CONFIRMAR, Mudanza.decidir(pendiente, true, ahora + 1 * min))
        // Aunque ya hubiera pasado la espera: si reporto, se quedo.
        assertEquals(Mudanza.Accion.CONFIRMAR, Mudanza.decidir(pendiente, true, ahora + 90 * min))
    }

    @Test
    fun sinReporteEsperaYLuegoRegresa() {
        assertEquals(Mudanza.Accion.ESPERAR, Mudanza.decidir(pendiente, false, ahora + 29 * min))
        assertEquals(Mudanza.Accion.ESPERAR, Mudanza.decidir(pendiente, false, ahora + 30 * min))
        assertEquals(Mudanza.Accion.REGRESAR, Mudanza.decidir(pendiente, false, ahora + 30 * min + 1))
    }

    @Test
    fun esperaPersonalizada() {
        val corta = pendiente.copy(esperaMin = 5)
        assertEquals(Mudanza.Accion.ESPERAR, Mudanza.decidir(corta, false, ahora + 4 * min))
        assertEquals(Mudanza.Accion.REGRESAR, Mudanza.decidir(corta, false, ahora + 6 * min))
    }

    @Test
    fun relojHaciaAtrasMasQueLaEsperaRegresa() {
        assertEquals(Mudanza.Accion.ESPERAR, Mudanza.decidir(pendiente, false, ahora - 1 * min))
        assertEquals(Mudanza.Accion.REGRESAR, Mudanza.decidir(pendiente, false, ahora - 365 * 24 * 60 * min))
    }

    @Test
    fun confirmarYRegresar() {
        val mudado = Mudanza.Estado(nuevo, "llave-nueva", nuevo, pendiente)
        assertEquals(Mudanza.Estado(nuevo, "llave-nueva", nuevo, null), Mudanza.confirmar(mudado))
        assertEquals(estadoViejo, Mudanza.regresar(mudado))
        // Sin llave de antes: vuelve al servidor (nunca a la pantalla de vincular) y sin llave.
        val sinLlave = mudado.copy(pendiente = pendiente.copy(tokenAnterior = null))
        assertEquals(Mudanza.Estado(viejo, null, null, null), Mudanza.regresar(sinLlave))
    }
}
