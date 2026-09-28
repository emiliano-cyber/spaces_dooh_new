package com.spaceeye.agent.pantalla

import com.spaceeye.agent.pantalla.SaludAnalisis.Imagen
import com.spaceeye.agent.pantalla.SaludAnalisis.Pantalla
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random
import java.util.zip.GZIPInputStream

/**
 * Fotos REALES, enderezadas a 192 px de ancho:
 *   - dublan_*: una vuelta real de MANUEL DUBLAN (equipo 13), 7 tomas entre las
 *     10:59 y las 11:03 del 23-sep-2026, con las franjas del LED muy marcadas.
 *   - tlalpan_*: 12 fotos de TLALPAN (equipo 6) de dias y horas distintos: un
 *     caso mas dificil que una vuelta real, porque la luz cambia entre fotos.
 * Las fallas se simulan encima. Los resultados esperados son los del prototipo
 * en Python con el que se midieron los umbrales.
 */
class SaludAnalisisTest {

    // Gris crudo (un byte por pixel, fila por fila) comprimido con gzip.
    private fun vuelta(nombre: String, n: Int, w: Int, h: Int): List<Imagen> = (0 until n).map { k ->
        val bytes = GZIPInputStream(javaClass.classLoader!!.getResourceAsStream("salud/${nombre}_%02d.gris.gz".format(k))).readBytes()
        Imagen(DoubleArray(w * h) { i -> (bytes[i].toInt() and 0xff).toDouble() }, w, h)
    }

    private val dublan by lazy { vuelta("dublan", 7, 192, 155) }
    private val tlalpan by lazy { vuelta("tlalpan", 12, 192, 136) }

    /** Pinta una zona con un valor fijo (gabinete apagado) en las tomas indicadas. */
    private fun conZona(base: List<Imagen>, f: Int, c: Int, en: Set<Int>? = null, valor: (Int) -> Double = { 6.0 }): List<Imagen> =
        base.mapIndexed { k, t ->
            if (en != null && k !in en) return@mapIndexed t
            val px = t.px.copyOf()
            for (y in (f * t.alto / 4) until ((f + 1) * t.alto / 4))
                for (x in (c * t.ancho / 6) until ((c + 1) * t.ancho / 6)) px[y * t.ancho + x] = valor(y * t.ancho + x)
            Imagen(px, t.ancho, t.alto)
        }

    @Test
    fun unaVueltaNormalNoAlarma() {
        for (base in listOf(dublan, tlalpan)) {
            val r = SaludAnalisis.analizar(base, 4, 6)
            assertEquals(Pantalla.OK, r.pantalla)
            assertTrue("no debe haber zonas: ${r.zonas}", r.zonas.isEmpty())
        }
    }

    @Test
    fun detectaElGabineteApagado() {
        for (base in listOf(dublan, tlalpan)) for ((f, c) in listOf(1 to 2, 3 to 0, 0 to 5)) {
            val r = SaludAnalisis.analizar(conZona(base, f, c), 4, 6)
            assertEquals(Pantalla.OK, r.pantalla)
            assertEquals(1, r.zonas.size)
            val z = r.zonas[0]
            assertEquals("zona_apagada", z.tipo)
            assertEquals(f, z.fila)
            assertEquals(c, z.columna)
            assertTrue(z.confianza > 0.8)
        }
    }

    @Test
    fun detectaElGabineteCongelado() {
        for (base in listOf(dublan, tlalpan)) {
            val parche = base[1]
            val r = SaludAnalisis.analizar(conZona(base, 2, 1) { i -> parche.px[i] }, 4, 6)
            assertEquals(listOf("zona_congelada" to (2 to 1)), r.zonas.map { it.tipo to (it.fila to it.columna) })
        }
    }

    @Test
    fun unAnuncioConUnRecuadroNegroNoEsUnaFalla() {
        // El negro esta en 3 tomas y en las demas la zona cambia con el anuncio.
        val r = SaludAnalisis.analizar(conZona(tlalpan, 1, 2, en = setOf(2, 3, 4)), 4, 6)
        assertTrue(r.zonas.isEmpty())
    }

    @Test
    fun zonaExcluidaNoSeJuzga() {
        val r = SaludAnalisis.analizar(conZona(tlalpan, 1, 2), 4, 6, excluir = setOf(1 to 2))
        assertTrue(r.zonas.isEmpty())
    }

    @Test
    fun pantallaApagadaYCongelada() {
        val rnd = Random(1)
        val apagada = tlalpan.map { t -> Imagen(DoubleArray(t.px.size) { 8 + rnd.nextGaussian() * 1.5 }, t.ancho, t.alto) }
        assertEquals(Pantalla.APAGADA, SaludAnalisis.analizar(apagada, 4, 6).pantalla)
        val fija = tlalpan.map { Imagen(DoubleArray(tlalpan[3].px.size) { i -> tlalpan[3].px[i] + rnd.nextGaussian() * 1.5 }, it.ancho, it.alto) }
        assertEquals(Pantalla.CONGELADA, SaludAnalisis.analizar(fija, 4, 6).pantalla)
    }

    /** Apaga varias zonas de una cuadricula filas x columnas. */
    private fun apagar(base: List<Imagen>, filas: Int, columnas: Int, zonas: List<Pair<Int, Int>>): List<Imagen> =
        base.map { t ->
            val px = t.px.copyOf()
            for ((f, c) in zonas)
                for (y in (f * t.alto / filas) until ((f + 1) * t.alto / filas))
                    for (x in (c * t.ancho / columnas) until ((c + 1) * t.ancho / columnas)) px[y * t.ancho + x] = 6.0
            Imagen(px, t.ancho, t.alto)
        }

    private val todas5x3 = (0 until 5).flatMap { f -> (0 until 3).map { c -> f to c } }

    @Test
    fun mediaPantallaApagadaSeDetectaComoUnaSolaFalla() {
        // El caso real del 25-sep: media pantalla tapada en una cuadricula de 5x3.
        // Con la mediana como referencia daba 0 de 8.
        for (base in listOf(dublan, tlalpan)) {
            val mitad = todas5x3.take(8)
            val r = SaludAnalisis.analizar(apagar(base, 5, 3, mitad), 5, 3)
            assertEquals(1, r.zonas.size)
            val z = r.zonas[0]
            assertEquals("zona_apagada", z.tipo)
            assertEquals(mitad.toSet(), z.grupo.toSet())
        }
    }

    @Test
    fun dosTerciosYCasiTodaLaPantallaApagada() {
        for (base in listOf(dublan, tlalpan)) for (k in listOf(10, 12)) {
            val muertas = todas5x3.take(k)
            val r = SaludAnalisis.analizar(apagar(base, 5, 3, muertas), 5, 3)
            assertEquals("con $k de 15 apagadas", muertas.toSet(), r.zonas.single().grupo.toSet())
        }
    }

    @Test
    fun dosGabinetesApagadosSonDosFallas() {
        val r = SaludAnalisis.analizar(apagar(tlalpan, 5, 3, listOf(0 to 0, 4 to 2)), 5, 3)
        assertEquals(setOf(0 to 0, 4 to 2), r.zonas.map { it.fila to it.columna }.toSet())
        assertTrue(r.zonas.all { it.grupo.isEmpty() })
    }

    /** Tapa zonas con algo claro y liso (como el bloc de notas de la prueba real). */
    private fun tapar(base: List<Imagen>, filas: Int, columnas: Int, zonas: List<Pair<Int, Int>>): List<Imagen> {
        val rnd = Random(4)
        return base.map { t ->
            val px = t.px.copyOf()
            for ((f, c) in zonas)
                for (y in (f * t.alto / filas) until ((f + 1) * t.alto / filas))
                    for (x in (c * t.ancho / columnas) until ((c + 1) * t.ancho / columnas))
                        px[y * t.ancho + x] = 190 + rnd.nextGaussian() * 1.5 - (if (y % 9 == 0) 6 else 0)
            Imagen(px, t.ancho, t.alto)
        }
    }

    @Test
    fun mediaPantallaTapadaConAlgoClaroSeDetecta() {
        // El caso real del 28-sep: un bloc de notas delante de la mitad de arriba.
        for (base in listOf(dublan, tlalpan)) {
            val arriba = todas5x3.take(6)
            val r = SaludAnalisis.analizar(tapar(base, 5, 3, arriba), 5, 3)
            val z = r.zonas.single()
            assertEquals("zona_congelada", z.tipo)
            assertEquals(arriba.toSet(), z.grupo.toSet())
        }
    }

    @Test
    fun unGabinetePegadoEnUnColorFijoSeDetecta() {
        val r = SaludAnalisis.analizar(tapar(tlalpan, 5, 3, listOf(2 to 1)), 5, 3)
        assertEquals(listOf("zona_congelada" to (2 to 1)), r.zonas.map { it.tipo to (it.fila to it.columna) })
    }

    @Test
    fun enCuadricula5x3SinFallaNoAlarma() {
        for (base in listOf(dublan, tlalpan)) assertTrue(SaludAnalisis.analizar(base, 5, 3).zonas.isEmpty())
    }

    @Test
    fun pocasTomasEsInconcluso() {
        assertEquals(Pantalla.INCONCLUSO, SaludAnalisis.analizar(dublan.take(3), 4, 6).pantalla)
    }
}
