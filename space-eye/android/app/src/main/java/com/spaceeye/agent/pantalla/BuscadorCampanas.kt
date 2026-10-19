// BuscadorCampanas.kt — Compara la pantalla con el arte de las campanas (ORB con geometria).
package com.spaceeye.agent.pantalla

import android.graphics.BitmapFactory
import com.spaceeye.agent.creativos.Reconocedor
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc

/**
 * La parte de Campanas que necesita OpenCV, aparte para que la contabilidad se
 * pruebe en la PC. Usa los mismos puntos y el mismo umbral que el Reconocedor.
 *
 * La referencia es el arte limpio y la toma es la pantalla vista por la camara;
 * cuando coincide se guarda tambien esa toma como variante (solo en memoria), y
 * las siguientes la reconocen con mas margen.
 */
class BuscadorCampanas(private val campanas: Campanas) {
    companion object {
        const val VARIANTES_MAX = 4
    }

    private data class Clave(val id: Int, val sha: String, val ancho: Int, val alto: Int)

    // La referencia y sus variantes, por campana y por tamaño de pantalla.
    private val rasgos = mutableMapOf<Clave, MutableList<Vision.Rasgos>>()

    private fun de(r: Campanas.Referencia, ancho: Int, alto: Int): MutableList<Vision.Rasgos> {
        val k = Clave(r.id, r.sha, ancho, alto)
        rasgos[k]?.let { return it }
        val lista = mutableListOf<Vision.Rasgos>()
        val gris = leerGris(r.archivo.readBytes())
        if (gris != null) {
            // La pantalla enderezada tiene la forma de la pantalla; el arte se
            // lleva a esa misma forma.
            val ref = Mat()
            Imgproc.resize(gris, ref, Size(ancho.toDouble(), alto.toDouble()), 0.0, 0.0, Imgproc.INTER_AREA)
            gris.release()
            lista.add(Vision.rasgos(ref))
            ref.release()
        }
        // Aunque no se pudiera leer se guarda vacia: no se vuelve a intentar en cada vistazo.
        rasgos[k] = lista
        return lista
    }

    /** La campana que se ve en esta pantalla enderezada (gris), o null. */
    /**
     * TODAS las campanas cuyo arte se ve, de la que mejor coincide a la que
     * menos. El mismo creativo puede estar vendido en dos campanas para la
     * misma pantalla y cada una necesita su prueba (paso en el ensayo de la
     * Raspberry del 8-oct: la segunda se quedaba sin foto).
     */
    fun buscarTodas(r: Vision.Rasgos, pantalla: Mat): List<Int> {
        val refs = campanas.referencias()
        val vigentes = refs.map { it.id to it.sha }.toSet()
        rasgos.keys.filter { (it.id to it.sha) !in vigentes }.forEach { k -> rasgos.remove(k)?.firstOrNull()?.desc?.release() }
        val ancho = pantalla.cols()
        val alto = pantalla.rows()
        val halladas = mutableListOf<Pair<Int, Int>>()
        for (ref in refs) {
            val vs = de(ref, ancho, alto)
            val p = vs.maxOfOrNull { Vision.coincidencias(r, it) } ?: 0
            if (p >= Reconocedor.UMBRAL) {
                halladas.add(ref.id to p)
                if (vs.size < VARIANTES_MAX) vs.add(r)
            }
        }
        return halladas.sortedByDescending { it.second }.map { it.first }
    }

    fun buscar(r: Vision.Rasgos, pantalla: Mat): Int? {
        val refs = campanas.referencias()
        // Lo de campanas que ya no estan (o cuyo arte cambio) se suelta.
        val vigentes = refs.map { it.id to it.sha }.toSet()
        // Solo la referencia es propia: las variantes son tomas que el Reconocedor
        // tambien puede tener en su catalogo, y soltarlas aqui se las borraria.
        rasgos.keys.filter { (it.id to it.sha) !in vigentes }.forEach { k -> rasgos.remove(k)?.firstOrNull()?.desc?.release() }
        val ancho = pantalla.cols()
        val alto = pantalla.rows()
        var mejor: MutableList<Vision.Rasgos>? = null
        var mejorId: Int? = null
        var puntos = 0
        for (ref in refs) {
            val vs = de(ref, ancho, alto)
            for (v in vs) {
                val p = Vision.coincidencias(r, v)
                if (p > puntos) { puntos = p; mejorId = ref.id; mejor = vs }
            }
        }
        if (mejorId == null || puntos < Reconocedor.UMBRAL) return null
        mejor?.let { if (it.size < VARIANTES_MAX) it.add(r) }
        return mejorId
    }

    /** El JPEG en gris (Rec. 601, como Enderezador), o null. */
    private fun leerGris(jpeg: ByteArray): Mat? {
        val bmp = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: return null
        val w = bmp.width
        val h = bmp.height
        val px = IntArray(w * h)
        bmp.getPixels(px, 0, w, 0, 0, w, h)
        bmp.recycle()
        val gris = ByteArray(w * h)
        for (i in px.indices) {
            val c = px[i]
            gris[i] = ((((c shr 16) and 0xff) * 299 + ((c shr 8) and 0xff) * 587 + (c and 0xff) * 114) / 1000).toByte()
        }
        val m = Mat(h, w, CvType.CV_8UC1)
        m.put(0, 0, gris)
        return m
    }
}
