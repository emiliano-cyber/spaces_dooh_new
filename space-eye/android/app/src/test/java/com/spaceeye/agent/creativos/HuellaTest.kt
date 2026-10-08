package com.spaceeye.agent.creativos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * La huella de la APK tiene que ser IDENTICA a la de pi-agent/src/huella.js: el
 * servidor compara las de todos los agentes con la misma regla.
 *
 * Las imagenes son dos fotos reales del espectacular de MANUEL DUBLAN (equipo
 * 13, 23-sep-2026), el mismo creativo con 53 segundos de diferencia, en gris a
 * 320x180. Las huellas esperadas las calculo huella.js sobre esos mismos bytes.
 */
class HuellaTest {

    private fun gris(nombre: String): DoubleArray {
        val bytes = javaClass.classLoader!!.getResourceAsStream(nombre)!!.readBytes()
        return DoubleArray(bytes.size) { (bytes[it].toInt() and 0xff).toDouble() }
    }

    @Test
    fun calculaLoMismoQueLaRaspberry() {
        assertEquals(
            "1d60dd00fa00fe70fe00fc44fc40f830f000f000f000f011f300e300fb00f900",
            Huella.calcular(gris("pantalla_a_320x180.gris"), 320, 180)
        )
        assertEquals(
            "1d60d900fa00fe70fe00fc44fc40f810f000f000f000f031f300e300fb00f900",
            Huella.calcular(gris("pantalla_b_320x180.gris"), 320, 180)
        )
    }

    @Test
    fun elMismoCreativoQuedaDentroDeLaTolerancia() {
        val a = Huella.calcular(gris("pantalla_a_320x180.gris"), 320, 180)
        val b = Huella.calcular(gris("pantalla_b_320x180.gris"), 320, 180)
        assertEquals(3, Huella.distancia(a, b))
        assertTrue(Huella.distancia(a, b) <= Huella.TOLERANCIA)
    }

    @Test
    fun unaImagenLisaNoEsUnCreativo() {
        // Pantalla apagada o lente tapada: no debe gastar una foto.
        assertNull(Huella.calcular(DoubleArray(320 * 180) { 40.0 }, 320, 180))
    }

    @Test
    fun distanciaCuentaBits() {
        assertEquals(0, Huella.distancia("0f", "0f"))
        assertEquals(4, Huella.distancia("0f", "00"))
        assertEquals(Huella.BITS, Huella.distancia("0f", null))
    }
}
