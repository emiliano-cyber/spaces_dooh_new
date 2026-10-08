package com.spaceeye.agent.camera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.util.Log
import java.io.ByteArrayOutputStream

/**
 * Graba (quema) DENTRO de la foto la informacion de ubicacion y fecha/hora, con
 * el estilo de referencia: texto AMARILLO en negrita, alineado a la derecha, en
 * la parte superior. Queda como parte de la imagen (no depende de metadatos).
 */
object PhotoWatermark {
    private const val TAG = "PhotoWatermark"

    fun draw(jpeg: ByteArray, lines: List<String>): ByteArray {
        val clean = lines.filter { it.isNotBlank() }
        if (clean.isEmpty()) return jpeg
        return try {
            val decoded = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: return jpeg
            val bmp = decoded.copy(Bitmap.Config.ARGB_8888, true)
            decoded.recycle()

            val canvas = Canvas(bmp)
            val w = bmp.width.toFloat()
            val h = bmp.height.toFloat()
            val fontSize = maxOf(24f, w / 40f)
            val lineH = fontSize * 1.32f
            val rightMargin = fontSize * 0.7f
            val x = w - rightMargin

            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.rgb(255, 235, 0) // amarillo
                textSize = fontSize
                textAlign = Paint.Align.RIGHT
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                setShadowLayer(fontSize * 0.14f, 0f, 0f, Color.BLACK)
            }

            // Bloque de texto empezando ~22% desde arriba (como en la referencia).
            var y = h * 0.22f + fontSize
            for (line in clean) {
                canvas.drawText(line, x, y, paint)
                y += lineH
            }

            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 92, out)
            bmp.recycle()
            out.toByteArray()
        } catch (e: Exception) {
            Log.e(TAG, "watermark failed: ${e.message}")
            jpeg
        }
    }
}
