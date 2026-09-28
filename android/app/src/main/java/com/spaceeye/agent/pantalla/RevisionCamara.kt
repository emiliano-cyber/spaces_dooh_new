// RevisionCamara.kt — ¿La camara sigue viendo lo mismo que cuando se marco la pantalla?
package com.spaceeye.agent.pantalla

import android.content.Context
import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import java.io.File
import kotlin.math.hypot

/**
 * Hay que saberlo ANTES de juzgar la pantalla. Si alguien golpeo el poste o el
 * viento giro la camara, las esquinas marcadas ya no caen sobre la pantalla y
 * todo lo demas seria basura: un "gabinete apagado" que en realidad es cielo.
 *
 * Se guarda como referencia la escena ENTERA (no solo la pantalla: la pantalla
 * cambia con cada anuncio, el edificio de al lado no). En cada vuelta se busca
 * como se movio la escena respecto a la referencia, y se mide cuanto se
 * desplazaron las esquinas de la pantalla.
 *
 * La escena de dia y de noche es muy distinta, asi que se guardan hasta
 * VARIANTES referencias, igual que las variantes de luz de los creativos.
 * Si no se reconoce ninguna, la vuelta es INCONCLUSA y no se acusa a nadie:
 * solo se dice "camara movida" con evidencia clara (muchos puntos coinciden y
 * aun asi las esquinas se corrieron).
 */
class RevisionCamara(ctx: Context) {
    companion object {
        /** Puntos coincidentes para confiar en que la camara sigue en su lugar. */
        private const val PUNTOS_CONFIABLES = 25
        /**
         * Puntos que bastan para decir "se movio" si TODOS coinciden en un
         * desplazamiento grande. Con el movimiento real del 28-sep la escena
         * cambio tanto que solo coincidieron 14, todos corridos un 21%: con el
         * minimo de 25 quedaba "sin juzgar" para siempre en vez de avisar.
         * Coincidencias al azar no se ponen de acuerdo en un mismo corrimiento.
         */
        private const val PUNTOS_MOVIDA = 12
        /** Desplazamiento medio de las esquinas, en fraccion del ancho, para decir "se movio". */
        private const val MOVIDA = 0.04
        /** Por debajo de esto, la escena ya se parece poco: se guarda como otra variante. */
        private const val VARIANTE_HASTA = 60
        private const val VARIANTES = 4
        /** Escena casi lisa: lente tapada, sin luz, o todo negro. */
        private const val SIN_IMAGEN = 5.0
        private const val FRACCION_SIN_IMAGEN = 0.8
    }

    private val dir = File(ctx.filesDir, "pantalla").apply { mkdirs() }
    private val firmaArchivo = File(dir, "referencia.firma")
    private val refs = mutableListOf<Vision.Rasgos>()
    private var firma = ""

    fun abrir(firmaNueva: String) {
        if (firmaNueva == firma) return
        firma = firmaNueva
        refs.clear()
        val guardada = if (firmaArchivo.exists()) firmaArchivo.readText() else ""
        if (guardada == firmaNueva) {
            for (k in 0 until VARIANTES) Vision.leer(File(dir, "marco_$k.orb"))?.let { refs.add(it) }
        } else {
            dir.listFiles()?.forEach { if (it.name.startsWith("marco_")) it.delete() }
            firmaArchivo.writeText(firmaNueva)
        }
    }

    fun revisar(vistazos: List<Vistazo>, geo: Geometria): Seguimiento.Camara {
        if (vistazos.isEmpty()) return Seguimiento.Camara.INCONCLUSO
        if (vistazos.count { it.marcoContraste < SIN_IMAGEN }.toDouble() / vistazos.size >= FRACCION_SIN_IMAGEN) {
            return Seguimiento.Camara.SIN_IMAGEN
        }
        val marco = vistazos[vistazos.size / 2].marco
        val actual = Vision.rasgos(marco, fueraDeLaPantalla(marco, geo))
        if (refs.isEmpty()) {
            guardar(actual)
            return Seguimiento.Camara.OK
        }
        var mejor = 0
        var desplazamiento = 0.0
        for (r in refs) {
            val (n, d) = Vision.desplazamiento(r, actual)
            if (n > mejor) { mejor = n; desplazamiento = d / marco.cols() }
        }
        if (mejor >= PUNTOS_MOVIDA && desplazamiento > MOVIDA) return Seguimiento.Camara.MOVIDA
        if (mejor < PUNTOS_CONFIABLES) return Seguimiento.Camara.INCONCLUSO
        if (mejor < VARIANTE_HASTA && refs.size < VARIANTES) guardar(actual)
        return Seguimiento.Camara.OK
    }

    /**
     * Mascara de lo que esta FUERA de la pantalla (un poco agrandada, para dejar
     * fuera tambien el brillo del borde). La camara se juzga solo con lo fijo de
     * alrededor -el marco, el escritorio, los edificios-: dentro de la pantalla el
     * contenido cambia por definicion. El 28-sep, al arrastrar a un lado una
     * ventana con texto que tapaba parte del video, sus puntos se desplazaron
     * juntos y parecio que la camara entera se habia movido.
     *
     * Si la pantalla llena casi toda la foto (TLALPAN), afuera no queda con que
     * comparar: entonces se usa la foto entera, como antes.
     */
    private fun fueraDeLaPantalla(marco: Mat, geo: Geometria): Mat? {
        val w = marco.cols().toDouble()
        val h = marco.rows().toDouble()
        val cx = geo.esquinas.sumOf { it.first } / 4
        val cy = geo.esquinas.sumOf { it.second } / 4
        val puntos = geo.esquinas.map { (x, y) ->
            org.opencv.core.Point((cx + (x - cx) * 1.08) * w, (cy + (y - cy) * 1.08) * h)
        }
        // Area de la pantalla (formula del cordon) sobre el area de la foto.
        val area = Math.abs((0 until 4).sumOf { i ->
            val (x1, y1) = geo.esquinas[i]; val (x2, y2) = geo.esquinas[(i + 1) % 4]
            x1 * y2 - x2 * y1
        }) / 2
        if (area > 0.8) return null
        val m = Mat(marco.rows(), marco.cols(), org.opencv.core.CvType.CV_8UC1, org.opencv.core.Scalar(255.0))
        org.opencv.imgproc.Imgproc.fillConvexPoly(m, org.opencv.core.MatOfPoint(*puntos.toTypedArray()), org.opencv.core.Scalar(0.0))
        return m
    }

    private fun guardar(r: Vision.Rasgos) {
        Vision.escribir(File(dir, "marco_${refs.size}.orb"), r)
        refs.add(r)
    }
}
