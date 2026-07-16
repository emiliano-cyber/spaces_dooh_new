package com.spaceeye.agent.camera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.Log
import java.io.ByteArrayOutputStream

/**
 * Graba (quema) texto DENTRO de la foto: coordenadas GPS exactas + fecha/hora.
 * Queda como parte de la imagen, por lo que se ve igual en galeria, visor y
 * descarga, sin depender de metadatos.
 */
object PhotoWatermark {
    private const val TAG = "PhotoWatermark"

    fun draw(jpeg: ByteArray, lines: List<String>): ByteArray {
        if (lines.isEmpty()) return jpeg
        return try {
            val decoded = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: return jpeg
            val bmp = decoded.copy(Bitmap.Config.ARGB_8888, true)
            decoded.recycle()

            val canvas = Canvas(bmp)
            val w = bmp.width.toFloat()
            val h = bmp.height.toFloat()
            val fontSize = maxOf(26f, w / 42f)
            val pad = fontSize * 0.6f
            val lineH = fontSize * 1.35f
            val barH = lines.size * lineH + pad * 2

            canvas.drawRect(0f, h - barH, w, h, Paint().apply { color = Color.argb(140, 0, 0, 0) })

            val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textSize = fontSize
                setShadowLayer(3f, 0f, 0f, Color.BLACK)
            }
            var baseline = h - barH + pad + fontSize
            for (line in lines) {
                canvas.drawText(line, pad, baseline, text)
                baseline += lineH
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
