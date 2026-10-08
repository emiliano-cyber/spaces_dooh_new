// Enderezador.kt — De varias tomas de la camara a la pantalla "de frente".
package com.spaceeye.agent.pantalla

import android.graphics.BitmapFactory
import android.media.ExifInterface
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import java.io.ByteArrayInputStream
import kotlin.math.hypot

/**
 * Un vistazo, listo para los dos analisis:
 *   - `pantalla`: la pantalla enderezada a 320 px de ancho, en gris (creativos);
 *   - `salud`: la misma a 192 px (fallas; es la medida con la que se midieron
 *     los umbrales de SaludAnalisis);
 *   - `marco`: la foto ENTERA a 320 px, para ver si la camara se movio;
 *   - `jpeg`: la ultima toma tal cual, por si hay que subirla como evidencia.
 *
 * Las tomas se PROMEDIAN antes de analizar: las franjas del LED cambian de una
 * toma a la siguiente y se borran; el anuncio, que no cambia, se queda.
 */
class Vistazo(val pantalla: Mat, val salud: SaludAnalisis.Imagen, val marco: Mat, val marcoContraste: Double, val jpeg: ByteArray) {
    fun liberar() { pantalla.release(); marco.release() }
    /** El mismo vistazo sin la foto completa (lo demas ya esta medido). */
    fun sinFoto() = Vistazo(pantalla, salud, marco, marcoContraste, ByteArray(0))
}

object Enderezador {
    const val ANCHO_PANTALLA = 320
    const val ANCHO_SALUD = 192
    const val ANCHO_MARCO = 320

    fun preparar(tomas: List<ByteArray>, geo: Geometria, giro: Int): Vistazo? {
        var sumaP: Mat? = null
        var sumaM: Mat? = null
        var n = 0
        var ultima: ByteArray? = null
        for (jpeg in tomas) {
            val gris = decodificar(jpeg, geo, giro) ?: continue
            val p = enderezar(gris, geo)
            val m = Mat()
            Imgproc.resize(gris, m, Size(ANCHO_MARCO.toDouble(), Math.round(gris.rows() * ANCHO_MARCO.toDouble() / gris.cols()).toDouble()), 0.0, 0.0, Imgproc.INTER_AREA)
            gris.release()
            sumaP = acumular(sumaP, p)
            sumaM = acumular(sumaM, m)
            p.release(); m.release()
            ultima = jpeg
            n++
        }
        val sp = sumaP ?: return null
        val sm = sumaM ?: return null
        val pantalla = Mat(); sp.convertTo(pantalla, CvType.CV_8U, 1.0 / n); sp.release()
        val marco = Mat(); sm.convertTo(marco, CvType.CV_8U, 1.0 / n); sm.release()

        val chica = Mat()
        Imgproc.resize(pantalla, chica, Size(ANCHO_SALUD.toDouble(), Math.max(8L, Math.round(pantalla.rows() * ANCHO_SALUD.toDouble() / pantalla.cols())).toDouble()), 0.0, 0.0, Imgproc.INTER_AREA)
        val salud = SaludAnalisis.Imagen(aDoubles(chica), chica.cols(), chica.rows())
        chica.release()

        val media = org.opencv.core.MatOfDouble()
        val desv = org.opencv.core.MatOfDouble()
        Core.meanStdDev(marco, media, desv)
        val contraste = desv.toArray().firstOrNull() ?: 0.0
        media.release(); desv.release()
        return Vistazo(pantalla, salud, marco, contraste, ultima!!)
    }

    private fun acumular(suma: Mat?, img: Mat): Mat? {
        val f = Mat()
        img.convertTo(f, CvType.CV_32F)
        if (suma == null) return f
        if (suma.size() == f.size()) Core.add(suma, f, suma)
        f.release()
        return suma
    }

    fun aDoubles(m: Mat): DoubleArray {
        val b = ByteArray(m.total().toInt())
        m.get(0, 0, b)
        return DoubleArray(b.size) { (b[it].toInt() and 0xff).toDouble() }
    }

    /** Grados que hay que girar este JPEG para verlo como la foto que se sube. */
    fun giroTotal(jpeg: ByteArray, giro: Int): Int {
        val exif = try {
            when (ExifInterface(ByteArrayInputStream(jpeg))
                .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
        } catch (_: Exception) { 0 }
        return (((exif + giro) % 360) + 360) % 360
    }

    /**
     * JPEG -> gris girado como la foto que se sube (en esa imagen se marcaron las
     * esquinas). Se decodifica a la resolucion justa para que la pantalla quede
     * de al menos el doble de ANCHO_PANTALLA: en un encuadre abierto la pantalla
     * puede ser el 5% de la foto, y reducir la foto entera primero la dejaria en
     * nada; decodificarla completa a 12 megapixeles seria memoria de sobra.
     */
    private fun decodificar(jpeg: ByteArray, geo: Geometria, giro: Int): Mat? {
        val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, medidas)
        if (medidas.outWidth <= 0) return null
        val total = giroTotal(jpeg, giro)
        val (w0, h0) = if (total == 90 || total == 270) medidas.outHeight to medidas.outWidth else medidas.outWidth to medidas.outHeight

        val anchoPantalla = anchoDe(geo, w0.toDouble(), h0.toDouble())
        var muestreo = 1
        while (anchoPantalla / (muestreo * 2) >= ANCHO_PANTALLA * 2) muestreo *= 2
        val bmp = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size,
            BitmapFactory.Options().apply { inSampleSize = muestreo }) ?: return null
        val w = bmp.width
        val h = bmp.height
        val px = IntArray(w * h)
        bmp.getPixels(px, 0, w, 0, 0, w, h)
        bmp.recycle()
        val gris = ByteArray(w * h)
        for (i in px.indices) {
            val c = px[i]
            // Luminancia Rec. 601, la misma de todo el sistema.
            gris[i] = ((((c shr 16) and 0xff) * 299 + ((c shr 8) and 0xff) * 587 + (c and 0xff) * 114) / 1000).toByte()
        }
        val m = Mat(h, w, CvType.CV_8UC1)
        m.put(0, 0, gris)
        if (total == 0) return m
        val r = Mat()
        Core.rotate(m, r, when (total) {
            90 -> Core.ROTATE_90_CLOCKWISE
            180 -> Core.ROTATE_180
            else -> Core.ROTATE_90_COUNTERCLOCKWISE
        })
        m.release()
        return r
    }

    private fun anchoDe(geo: Geometria, w: Double, h: Double): Double {
        val e = geo.esquinas.map { (x, y) -> x * w to y * h }
        return (hypot(e[1].first - e[0].first, e[1].second - e[0].second) +
                hypot(e[2].first - e[3].first, e[2].second - e[3].second)) / 2
    }

    private fun altoDe(geo: Geometria, w: Double, h: Double): Double {
        val e = geo.esquinas.map { (x, y) -> x * w to y * h }
        return (hypot(e[3].first - e[0].first, e[3].second - e[0].second) +
                hypot(e[2].first - e[1].first, e[2].second - e[1].second)) / 2
    }

    /** La pantalla, enderezada con sus 4 esquinas, a ANCHO_PANTALLA de ancho. */
    private fun enderezar(gris: Mat, geo: Geometria): Mat {
        val w = gris.cols().toDouble()
        val h = gris.rows().toDouble()
        val alto = Math.max(8L, Math.round(ANCHO_PANTALLA * altoDe(geo, w, h) / anchoDe(geo, w, h))).toDouble()
        val src = MatOfPoint2f(*geo.esquinas.map { (x, y) -> Point(x * w, y * h) }.toTypedArray())
        val dst = MatOfPoint2f(Point(0.0, 0.0), Point(ANCHO_PANTALLA.toDouble(), 0.0),
            Point(ANCHO_PANTALLA.toDouble(), alto), Point(0.0, alto))
        val t = Imgproc.getPerspectiveTransform(src, dst)
        val out = Mat()
        Imgproc.warpPerspective(gris, out, t, Size(ANCHO_PANTALLA.toDouble(), alto), Imgproc.INTER_LINEAR)
        t.release(); src.release(); dst.release()
        return out
    }
}
