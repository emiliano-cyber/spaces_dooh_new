// Vision.kt — Puntos ORB: sacarlos, compararlos y guardarlos. Lo comparten el
// reconocedor de creativos y la revision de la camara.
package com.spaceeye.agent.pantalla

import android.util.Log
import org.opencv.android.OpenCVLoader
import org.opencv.calib3d.Calib3d
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfDMatch
import org.opencv.core.MatOfKeyPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Size
import org.opencv.features2d.BFMatcher
import org.opencv.features2d.ORB
import org.opencv.imgproc.Imgproc
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File

/**
 * Parametros medidos con fotos reales el 23-sep-2026 (ver Reconocedor.kt): 800
 * puntos, CLAHE 3.0 en 4x4, prueba de Lowe a 0.8, homografia RANSAC a 6 px.
 */
object Vision {
    private const val TAG = "Vision"
    private const val PUNTOS = 800

    @Volatile private var cargado = false
    fun cargar(): Boolean {
        if (!cargado) cargado = try { OpenCVLoader.initLocal() } catch (e: Throwable) {
            Log.e(TAG, "OpenCV no cargo: ${e.message}"); false
        }
        return cargado
    }

    /** Puntos de una imagen en gris: posiciones y descriptores. */
    class Rasgos(val xy: FloatArray, val desc: Mat) {
        val n get() = desc.rows()
    }

    private val orb by lazy { ORB.create(PUNTOS) }
    private val emparejador by lazy { BFMatcher.create(Core.NORM_HAMMING) }
    private val clahe by lazy { Imgproc.createCLAHE(3.0, Size(4.0, 4.0)) }

    fun rasgos(gris: Mat): Rasgos {
        val ecualizada = Mat()
        clahe.apply(gris, ecualizada)
        val kp = MatOfKeyPoint()
        val desc = Mat()
        orb.detectAndCompute(ecualizada, Mat(), kp, desc)
        ecualizada.release()
        val pts = kp.toArray()
        kp.release()
        val xy = FloatArray(pts.size * 2)
        pts.forEachIndexed { i, p -> xy[2 * i] = p.pt.x.toFloat(); xy[2 * i + 1] = p.pt.y.toFloat() }
        return Rasgos(xy, desc)
    }

    /** Puntos que coinciden y guardan la misma geometria, el menor de los dos sentidos. */
    fun coincidencias(a: Rasgos, b: Rasgos): Int {
        val (h1, n1) = transformacion(a, b)
        h1?.release()
        if (n1 == 0) return 0
        val (h2, n2) = transformacion(b, a)
        h2?.release()
        return minOf(n1, n2)
    }

    /**
     * La homografia que lleva los puntos de `a` a los de `b` y cuantos puntos la
     * respaldan. null si no hay suficientes coincidencias.
     */
    fun transformacion(a: Rasgos, b: Rasgos): Pair<Mat?, Int> {
        if (a.n < 8 || b.n < 8) return null to 0
        val pares = mutableListOf<MatOfDMatch>()
        emparejador.knnMatch(a.desc, b.desc, pares, 2)
        val src = ArrayList<Point>()
        val dst = ArrayList<Point>()
        for (m in pares) {
            val d = m.toArray()
            m.release()
            // Prueba de Lowe: el mejor candidato tiene que ganarle claramente al
            // segundo; si no, el punto es ambiguo (texturas repetidas del LED).
            if (d.size == 2 && d[0].distance < 0.8f * d[1].distance) {
                src.add(Point(a.xy[2 * d[0].queryIdx].toDouble(), a.xy[2 * d[0].queryIdx + 1].toDouble()))
                dst.add(Point(b.xy[2 * d[0].trainIdx].toDouble(), b.xy[2 * d[0].trainIdx + 1].toDouble()))
            }
        }
        if (src.size < 8) return null to src.size / 4
        val mascara = Mat()
        val ps = MatOfPoint2f(*src.toTypedArray())
        val pd = MatOfPoint2f(*dst.toTypedArray())
        return try {
            val h = Calib3d.findHomography(ps, pd, Calib3d.RANSAC, 6.0, mascara)
            if (h.empty()) null to 0 else h to Core.countNonZero(mascara)
        } catch (e: Exception) { null to 0 } finally { mascara.release(); ps.release(); pd.release() }
    }

    /**
     * Cuanto se movieron de verdad los puntos que coinciden entre dos escenas: la
     * mediana del desplazamiento de los que respaldan la homografia, en pixeles.
     * Devuelve (puntos, desplazamiento).
     *
     * Se mide en los PUNTOS y no extrapolando la homografia a otro lugar: en la
     * escena del telefono de pruebas casi todos los puntos estaban en el
     * escritorio, abajo, y la pantalla arriba. Llevar la homografia hasta las
     * esquinas de la pantalla convertia un 0.7% real en un 5.1% y daba "camara
     * movida" sin que nadie la tocara (28-sep).
     */
    fun desplazamiento(a: Rasgos, b: Rasgos): Pair<Int, Double> {
        if (a.n < 8 || b.n < 8) return 0 to 0.0
        val pares = mutableListOf<MatOfDMatch>()
        emparejador.knnMatch(a.desc, b.desc, pares, 2)
        val src = ArrayList<Point>()
        val dst = ArrayList<Point>()
        for (m in pares) {
            val d = m.toArray()
            m.release()
            if (d.size == 2 && d[0].distance < 0.8f * d[1].distance) {
                src.add(Point(a.xy[2 * d[0].queryIdx].toDouble(), a.xy[2 * d[0].queryIdx + 1].toDouble()))
                dst.add(Point(b.xy[2 * d[0].trainIdx].toDouble(), b.xy[2 * d[0].trainIdx + 1].toDouble()))
            }
        }
        if (src.size < 8) return 0 to 0.0
        val mascara = Mat()
        val ps = MatOfPoint2f(*src.toTypedArray())
        val pd = MatOfPoint2f(*dst.toTypedArray())
        return try {
            val h = Calib3d.findHomography(ps, pd, Calib3d.RANSAC, 6.0, mascara)
            if (h.empty()) return 0 to 0.0
            h.release()
            val dentro = ByteArray(src.size)
            mascara.get(0, 0, dentro)
            val movs = src.indices.filter { dentro[it].toInt() != 0 }
                .map { Math.hypot(dst[it].x - src[it].x, dst[it].y - src[it].y) }.sorted()
            if (movs.isEmpty()) 0 to 0.0 else movs.size to movs[movs.size / 2]
        } catch (e: Exception) { 0 to 0.0 } finally { mascara.release(); ps.release(); pd.release() }
    }

    fun escribir(f: File, r: Rasgos) {
        val bytes = ByteArray(r.n * 32)
        if (r.n > 0) r.desc.get(0, 0, bytes)
        DataOutputStream(f.outputStream().buffered()).use { o ->
            o.writeInt(r.n)
            for (v in r.xy) o.writeFloat(v)
            o.write(bytes)
        }
    }

    fun leer(f: File): Rasgos? = try {
        DataInputStream(f.inputStream().buffered()).use { i ->
            val n = i.readInt()
            val xy = FloatArray(n * 2) { i.readFloat() }
            val bytes = ByteArray(n * 32)
            i.readFully(bytes)
            val d = Mat(n, 32, CvType.CV_8UC1)
            if (n > 0) d.put(0, 0, bytes)
            Rasgos(xy, d)
        }
    } catch (e: Exception) { null }
}
