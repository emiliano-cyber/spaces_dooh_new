// Evidencia.kt — La foto que acompaña a una alerta, y la bitacora local.
package com.spaceeye.agent.pantalla

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * La evidencia es la foto del momento con el gabinete que fallo marcado en rojo
 * EN SU LUGAR (se dibuja con la misma geometria con la que se enderezo), y
 * reducida: 1600 px de ancho y JPEG al 75% son ~200-400 KB, contra 1.5-3.5 MB de
 * la foto completa. Es lo UNICO que pesa en todo el monitoreo, y solo viaja
 * cuando se abre o se cierra una falla.
 *
 * Todo evento se anota tambien en el telefono (bitacora + copia de la
 * evidencia), con tope de espacio: si la red falla en ese momento, queda
 * constancia, y el envio se reintenta en la siguiente vuelta.
 */
class Evidencia(ctx: Context) {
    companion object {
        private const val ANCHO_MAX = 1600
        private const val CALIDAD = 75
        private const val TOPE_EVIDENCIAS = 50L * 1024 * 1024
        private const val TOPE_BITACORA = 1L * 1024 * 1024
    }

    private val dir = File(ctx.filesDir, "pantalla/evidencia").apply { mkdirs() }
    private val bitacora = File(ctx.filesDir, "pantalla/bitacora.jsonl")

    /**
     * @param jpeg la foto ya girada como se sube.
     * @param zonas gabinetes a marcar (fila, columna); vacio = toda la pantalla.
     */
    /**
     * La misma reduccion que la evidencia, sin dibujar nada: para la foto de un
     * creativo nuevo, que antes subia a resolucion completa (3-5 MB cada una).
     */
    fun reducir(jpeg: ByteArray): ByteArray {
        return try {
            val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, medidas)
            if (medidas.outWidth <= ANCHO_MAX) return jpeg
            var muestreo = 1
            while (medidas.outWidth / (muestreo * 2) >= ANCHO_MAX) muestreo *= 2
            val base = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size,
                BitmapFactory.Options().apply { inSampleSize = muestreo }) ?: return jpeg
            val bmp = if (base.width > ANCHO_MAX) {
                Bitmap.createScaledBitmap(base, ANCHO_MAX, base.height * ANCHO_MAX / base.width, true).also { base.recycle() }
            } else base
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
            bmp.recycle()
            out.toByteArray()
        } catch (_: Throwable) { jpeg }
    }

    fun preparar(jpeg: ByteArray, geo: Geometria, zonas: List<Pair<Int, Int>>, texto: String): ByteArray {
        val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, medidas)
        var muestreo = 1
        while (medidas.outWidth / (muestreo * 2) >= ANCHO_MAX) muestreo *= 2
        val base = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size,
            BitmapFactory.Options().apply { inSampleSize = muestreo; inMutable = true }) ?: return jpeg
        val bmp = if (base.width > ANCHO_MAX) {
            Bitmap.createScaledBitmap(base, ANCHO_MAX, base.height * ANCHO_MAX / base.width, true).also { base.recycle() }
        } else base
        val lienzo = Canvas(bmp)
        val w = bmp.width.toFloat()
        val h = bmp.height.toFloat()
        val grosor = maxOf(3f, w / 300f)

        // Toda la pantalla en blanco fino, para ubicarse; lo que fallo, en rojo.
        val contornoPantalla = Paint().apply { style = Paint.Style.STROKE; strokeWidth = grosor / 2; color = Color.WHITE; isAntiAlias = true }
        val contornoFalla = Paint().apply { style = Paint.Style.STROKE; strokeWidth = grosor; color = Color.RED; isAntiAlias = true }
        lienzo.drawPath(camino(geo.esquinas, w, h), contornoPantalla)
        for ((f, c) in zonas) lienzo.drawPath(camino(geo.contorno(f, c), w, h), contornoFalla)
        if (zonas.isEmpty()) lienzo.drawPath(camino(geo.esquinas, w, h), contornoFalla)

        val letra = Paint().apply { color = Color.WHITE; textSize = w / 40f; isAntiAlias = true; setShadowLayer(4f, 0f, 0f, Color.BLACK) }
        val fondo = Paint().apply { color = Color.argb(170, 180, 0, 0) }
        val alto = letra.textSize * 1.6f
        lienzo.drawRect(0f, 0f, letra.measureText(texto) + alto, alto, fondo)
        lienzo.drawText(texto, alto / 3, letra.textSize * 1.15f, letra)

        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, CALIDAD, out)
        bmp.recycle()
        return out.toByteArray()
    }

    private fun camino(p: List<Pair<Double, Double>>, w: Float, h: Float) = Path().apply {
        moveTo((p[0].first * w).toFloat(), (p[0].second * h).toFloat())
        for (k in 1 until p.size) lineTo((p[k].first * w).toFloat(), (p[k].second * h).toFloat())
        close()
    }

    /** Guarda una copia local de la evidencia, borrando las mas viejas si se pasa del tope. */
    fun guardar(nombre: String, jpeg: ByteArray) {
        try {
            File(dir, "$nombre.jpg").writeBytes(jpeg)
            val archivos = dir.listFiles()?.sortedBy { it.lastModified() } ?: return
            var total = archivos.sumOf { it.length() }
            for (a in archivos) {
                if (total <= TOPE_EVIDENCIAS) break
                total -= a.length()
                a.delete()
            }
        } catch (_: Exception) {}
    }

    fun anotar(evento: JSONObject) {
        try {
            if (bitacora.length() > TOPE_BITACORA) {
                // Se queda con la mitad mas reciente.
                val lineas = bitacora.readLines()
                bitacora.writeText(lineas.takeLast(lineas.size / 2).joinToString("\n", postfix = "\n"))
            }
            bitacora.appendText(evento.put("ts", System.currentTimeMillis()).toString() + "\n")
        } catch (_: Exception) {}
    }
}
