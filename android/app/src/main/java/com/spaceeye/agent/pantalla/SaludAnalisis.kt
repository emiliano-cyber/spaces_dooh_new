// SaludAnalisis.kt — Busca fallas en la pantalla a partir de UNA vuelta del loop.
package com.spaceeye.agent.pantalla

import kotlin.math.abs
import kotlin.math.sqrt

/**
 * LA IDEA
 * -------
 * Una falla de pantalla se distingue del contenido por una sola cosa: NO cambia
 * cuando cambia el anuncio. El loop pasa una docena de creativos de ~20 s; un
 * gabinete muerto sigue negro con todos ellos, y un anuncio oscuro, una
 * transicion o un cambio de brillo no. Por eso esto nunca juzga una foto: juzga
 * una vuelta completa (~4 min, una toma cada 15 s) y pregunta, zona por zona,
 * que no cambio cuando todo lo demas si.
 *
 * Todo es RELATIVO a como se porta una zona SANA en esa misma vuelta (el
 * percentil 75 de las zonas). Asi el sol de mediodia, que deslava la pantalla
 * entera, no dispara nada: baja a todas las zonas por igual.
 *
 * Percentil 75 y no mediana: con la mediana, si se apaga MAS DE LA MITAD de la
 * pantalla la referencia cae en lo apagado, lo apagado parece "normal" y no se
 * detecta nada. Lo destapo una prueba real el 25-sep-2026 (media pantalla
 * tapada en una cuadricula de 5x3): 0 de 8 zonas detectadas. Con el percentil
 * 75 se detecta hasta 2/3 de la pantalla apagada, sin falsas alarmas en las
 * fotos reales. Para lo que pase de ahi hay una regla absoluta: una zona casi
 * negra que no cambia en toda la vuelta esta apagada, sin comparar con nada
 * (las zonas sanas de las fotos reales nunca bajaron de brillo 86 ni de
 * actividad 5.2; una apagada queda en 6 y 0).
 *
 * Medido el 24-sep-2026 sobre vueltas reales (MANUEL DUBLAN, 7 tomas en 4 min;
 * TLALPAN, 12 fotos de dias distintos) con fallas simuladas encima: 0 falsas
 * alarmas sin falla; gabinete apagado detectado con 0.87-0.89 en tres posiciones;
 * gabinete congelado detectado; un anuncio con un recuadro negro en 3 de las
 * tomas NO alarma. Ver SaludAnalisisTest.
 *
 * Aqui no se decide si hay que avisar: eso lo hace Seguimiento, que exige que
 * la falla se repita en vueltas separadas. Esto solo dice que vio en UNA.
 *
 * Es codigo puro (sin Android ni OpenCV) para poder probarlo en la PC con fotos
 * reales, y es el mismo calculo que tendra la Raspberry: cualquier cambio aqui
 * va acompañado del mismo cambio alla y de las pruebas.
 */
object SaludAnalisis {

    enum class Pantalla { OK, APAGADA, CONGELADA, INCONCLUSO }

    /**
     * @param grupo si varios gabinetes fallan igual, UNA sola zona los agrupa
     *   (fila y columna valen -1): media pantalla apagada es una falla, no ocho.
     */
    data class Zona(val tipo: String, val fila: Int, val columna: Int, val confianza: Double,
                    val grupo: List<Pair<Int, Int>> = emptyList())

    class Resultado(
        val pantalla: Pantalla,
        val vistazos: Int,
        val cambios: Int,
        val zonas: List<Zona>,
        /** Actividad y brillo de cada zona relativos a la mediana (fila x columna). */
        val actividad: Array<DoubleArray>? = null,
        val brillo: Array<DoubleArray>? = null,
    )

    /** Una toma enderezada de la pantalla, en gris. */
    class Imagen(val px: DoubleArray, val ancho: Int, val alto: Int) {
        fun media(): Double = px.average()
        fun desviacion(): Double = std(px)
    }

    // Umbrales. Medidos, no inventados: ver la nota de arriba.
    /** Diferencia media (niveles de gris) entre tomas seguidas para contar "cambio el contenido". */
    const val CAMBIO_MINIMO = 8.0
    /** Una pantalla es "uniforme" (apagada) si su desviacion es menor que esto. */
    const val UNIFORME = 6.0
    /** Fraccion de tomas uniformes para decir "apagada". */
    const val FRACCION_APAGADA = 0.8
    /** Con menos cambios de contenido que esto, no se juzgan las zonas. */
    const val CAMBIOS_PARA_ZONAS = 4
    /** Zona apagada: brillo maximo y actividad muy por debajo del resto. */
    const val APAGADA_BRILLO = 0.35
    const val APAGADA_ACTIVIDAD = 0.25
    /** Zona congelada: tiene imagen pero casi no cambia. */
    const val CONGELADA_ACTIVIDAD = 0.15
    const val CONGELADA_TEXTURA = 3.0
    /** Margen de cada zona que no se mira (el marco del gabinete vecino). */
    private const val MARGEN = 0.15
    /** Regla absoluta de zona apagada: casi negra y sin ningun cambio. */
    const val NEGRO_BRILLO = 40.0
    const val NEGRO_ACTIVIDAD = 2.5
    /** Desde cuantos gabinetes con la misma falla se agrupan en una. */
    const val AGRUPAR_DESDE = 3

    /**
     * @param excluir zonas que no se juzgan: tapadas (una barda, un arbol) o que
     *   se sabe que no cambian. Las aprende Seguimiento en las primeras 24 h.
     */
    fun analizar(tomas: List<Imagen>, filas: Int, columnas: Int, excluir: Set<Pair<Int, Int>> = emptySet()): Resultado {
        val n = tomas.size
        if (n < 2) return Resultado(Pantalla.INCONCLUSO, n, 0, emptyList())

        var cambios = 0
        for (k in 1 until n) if (diferencia(tomas[k], tomas[k - 1], filas, columnas) > CAMBIO_MINIMO) cambios++
        val uniformes = tomas.count { it.desviacion() < UNIFORME }.toDouble() / n

        if (uniformes >= FRACCION_APAGADA) return Resultado(Pantalla.APAGADA, n, cambios, emptyList())
        if (cambios == 0 && n >= 6) return Resultado(Pantalla.CONGELADA, n, cambios, emptyList())
        if (cambios < CAMBIOS_PARA_ZONAS) return Resultado(Pantalla.INCONCLUSO, n, cambios, emptyList())

        // Por zona: brillo medio en cada toma, y la textura (desviacion) maxima.
        val medias = Array(filas) { Array(columnas) { DoubleArray(n) } }
        val textura = Array(filas) { DoubleArray(columnas) }
        for ((k, t) in tomas.withIndex()) {
            for (f in 0 until filas) for (c in 0 until columnas) {
                val (m, s) = zona(t, f, c, filas, columnas)
                medias[f][c][k] = m
                if (s > textura[f][c]) textura[f][c] = s
            }
        }
        val maximo = Array(filas) { f -> DoubleArray(columnas) { c -> medias[f][c].max() } }
        val actividad = Array(filas) { f -> DoubleArray(columnas) { c -> std(medias[f][c]) } }

        val validas = mutableListOf<Pair<Int, Int>>()
        for (f in 0 until filas) for (c in 0 until columnas) if ((f to c) !in excluir) validas.add(f to c)
        if (validas.size < 2) return Resultado(Pantalla.INCONCLUSO, n, cambios, emptyList())
        val refMax = percentil(validas.map { maximo[it.first][it.second] }, 0.75)
        val refAct = maxOf(percentil(validas.map { actividad[it.first][it.second] }, 0.75), 1e-6)

        val relAct = Array(filas) { f -> DoubleArray(columnas) { c -> actividad[f][c] / refAct } }
        val relMax = Array(filas) { f -> DoubleArray(columnas) { c -> if (refMax > 0) maximo[f][c] / refMax else 0.0 } }

        val zonas = mutableListOf<Zona>()
        for ((f, c) in validas) {
            val rMax = relMax[f][c]
            val rAct = relAct[f][c]
            if (rMax < APAGADA_BRILLO && rAct < APAGADA_ACTIVIDAD) {
                zonas.add(Zona("zona_apagada", f, c, redondea(1 - maxOf(rMax / APAGADA_BRILLO, rAct / APAGADA_ACTIVIDAD))))
            } else if (maximo[f][c] < NEGRO_BRILLO && actividad[f][c] < NEGRO_ACTIVIDAD) {
                zonas.add(Zona("zona_apagada", f, c, 0.9))
            } else if (rAct < CONGELADA_ACTIVIDAD && textura[f][c] > CONGELADA_TEXTURA) {
                zonas.add(Zona("zona_congelada", f, c, redondea(1 - rAct / CONGELADA_ACTIVIDAD)))
            }
        }
        return Resultado(Pantalla.OK, n, cambios, agrupar(zonas), relAct, relMax)
    }

    /** Tres o mas gabinetes con la misma falla son UNA falla con su lista. */
    private fun agrupar(zonas: List<Zona>): List<Zona> {
        val out = mutableListOf<Zona>()
        for ((tipo, del) in zonas.groupBy { it.tipo }) {
            if (del.size >= AGRUPAR_DESDE) {
                out.add(Zona(tipo, -1, -1, redondea(del.map { it.confianza }.average()), del.map { it.fila to it.columna }))
            } else out.addAll(del)
        }
        return out
    }

    /** Percentil con interpolacion lineal (igual que numpy.percentile). */
    fun percentil(v: List<Double>, p: Double): Double {
        val s = v.sorted()
        if (s.size == 1) return s[0]
        val pos = p * (s.size - 1)
        val k = pos.toInt()
        val frac = pos - k
        return if (k + 1 < s.size) s[k] + (s[k + 1] - s[k]) * frac else s[k]
    }

    private fun zona(t: Imagen, f: Int, c: Int, filas: Int, columnas: Int): Pair<Double, Double> {
        val y0 = ((f + MARGEN) * t.alto / filas).toInt()
        val y1 = ((f + 1 - MARGEN) * t.alto / filas).toInt()
        val x0 = ((c + MARGEN) * t.ancho / columnas).toInt()
        val x1 = ((c + 1 - MARGEN) * t.ancho / columnas).toInt()
        var suma = 0.0
        var suma2 = 0.0
        var n = 0
        for (y in y0 until maxOf(y1, y0 + 1)) for (x in x0 until maxOf(x1, x0 + 1)) {
            val v = t.px[y * t.ancho + x]
            suma += v; suma2 += v * v; n++
        }
        val m = suma / n
        return m to sqrt(maxOf(0.0, suma2 / n - m * m))
    }

    /**
     * Cuanto cambio el contenido entre dos tomas: la diferencia media de la ZONA
     * que mas cambio. No de la imagen entera: con media pantalla (o mas) apagada,
     * el cambio de anuncio solo se ve en lo que sigue vivo, y el promedio de toda
     * la imagen apenas se mueve; la vuelta quedaba "sin juzgar" justo cuando mas
     * falta hacia juzgarla.
     */
    private fun diferencia(a: Imagen, b: Imagen, filas: Int, columnas: Int): Double {
        if (a.px.size != b.px.size) return Double.MAX_VALUE
        var mayor = 0.0
        for (f in 0 until filas) for (c in 0 until columnas) {
            val y0 = f * a.alto / filas; val y1 = maxOf(y0 + 1, (f + 1) * a.alto / filas)
            val x0 = c * a.ancho / columnas; val x1 = maxOf(x0 + 1, (c + 1) * a.ancho / columnas)
            var s = 0.0
            var n = 0
            for (y in y0 until y1) for (x in x0 until x1) { val i = y * a.ancho + x; s += abs(a.px[i] - b.px[i]); n++ }
            if (n > 0 && s / n > mayor) mayor = s / n
        }
        return mayor
    }

    fun std(v: DoubleArray): Double {
        val m = v.average()
        var acc = 0.0
        for (x in v) acc += (x - m) * (x - m)
        return sqrt(acc / v.size)
    }

    fun mediana(v: List<Double>): Double {
        val s = v.sorted()
        val k = s.size / 2
        return if (s.size % 2 == 1) s[k] else (s[k - 1] + s[k]) / 2
    }

    private fun redondea(v: Double) = Math.round(v * 100) / 100.0
}
