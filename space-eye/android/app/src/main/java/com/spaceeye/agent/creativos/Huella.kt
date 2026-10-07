// Huella.kt — Huella visual de 256 bits de lo que hay en la pantalla.
package com.spaceeye.agent.creativos

import kotlin.math.sqrt

/**
 * El MISMO calculo que pi-agent/src/huella.js, linea por linea, y tiene que
 * seguir siendolo: el servidor compara las huellas de todos los agentes con la
 * misma regla (creativos.controller.ts), y el catalogo de un sitio sobrevive a un
 * cambio de equipo solo si los dos calculan igual.
 *
 * Resumen de como se calcula (el porque de cada paso esta en huella.js):
 *   1. La imagen en gris se promedia a 64x64 y de ahi a 16x16 celdas.
 *   2. Cada celda vale 1 si es claramente mas clara que la mediana de las 256
 *      (mediana + un cuarto de la desviacion), y 0 si no.
 *   3. Si la imagen casi no tiene contraste -pantalla apagada, lente tapada,
 *      noche cerrada- no hay huella: no es un creativo y no debe gastar foto.
 */
object Huella {
    const val REJILLA = 16
    const val BITS = REJILLA * REJILLA
    private const val TRABAJO = 64
    const val CONTRASTE_MINIMO = 6.0

    /** Bits que pueden diferir para seguir siendo el mismo creativo. */
    const val TOLERANCIA = 24

    private fun rejilla(gris: DoubleArray, ancho: Int, alto: Int, lado: Int): DoubleArray {
        val salida = DoubleArray(lado * lado)
        for (y in 0 until lado) {
            val y0 = (y * alto) / lado
            val y1 = maxOf(y0 + 1, ((y + 1) * alto) / lado)
            for (x in 0 until lado) {
                val x0 = (x * ancho) / lado
                val x1 = maxOf(x0 + 1, ((x + 1) * ancho) / lado)
                var suma = 0.0
                var n = 0
                for (j in y0 until y1) for (i in x0 until x1) { suma += gris[j * ancho + i]; n++ }
                salida[y * lado + x] = if (n > 0) suma / n else 0.0
            }
        }
        return salida
    }

    private fun contraste(v: DoubleArray): Double {
        val media = v.average()
        var acc = 0.0
        for (x in v) acc += (x - media) * (x - media)
        return sqrt(acc / v.size)
    }

    /**
     * Huella en hexadecimal (64 caracteres), o null si la imagen no tiene forma
     * que reconocer. `gris` es luminancia 0..255, fila por fila.
     */
    fun calcular(gris: DoubleArray, ancho: Int, alto: Int): String? {
        if (ancho <= 0 || alto <= 0 || gris.size < ancho * alto) return null

        val media = rejilla(gris, ancho, alto, TRABAJO)
        if (contraste(media) < CONTRASTE_MINIMO) return null
        val celdas = rejilla(media, TRABAJO, TRABAJO, REJILLA)

        val ordenadas = celdas.sortedArray()
        val medio = ordenadas.size / 2
        val mediana = (ordenadas[medio - 1] + ordenadas[medio]) / 2
        val zonaMuerta = contraste(celdas) * 0.25

        val sb = StringBuilder(BITS / 4)
        var acumulado = 0
        var bits = 0
        for (v in celdas) {
            acumulado = (acumulado shl 1) or (if (v > mediana + zonaMuerta) 1 else 0)
            if (++bits == 4) { sb.append(Integer.toHexString(acumulado)); acumulado = 0; bits = 0 }
        }
        return sb.toString()
    }

    /** Bits distintos entre dos huellas. 0 = identicas. */
    fun distancia(a: String?, b: String?): Int {
        if (a == null || b == null || a.length != b.length) return BITS
        var d = 0
        for (i in a.indices) {
            d += Integer.bitCount(Character.digit(a[i], 16) xor Character.digit(b[i], 16))
        }
        return d
    }

    /** La conocida mas parecida dentro de la tolerancia, o null. */
    fun parecida(h: String, conocidas: Collection<String>, tolerancia: Int): String? {
        var mejor: String? = null
        var mejorD = tolerancia + 1
        for (c in conocidas) {
            val d = distancia(h, c)
            if (d < mejorD) { mejorD = d; mejor = c }
        }
        return mejor
    }
}
