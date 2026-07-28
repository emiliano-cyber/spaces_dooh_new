// PhotoCapture.kt — Camera2 API photo capture
package com.spaceeye.agent.camera

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PhotoCapture(private val ctx: Context) {

    companion object {
        private const val TAG = "PhotoCapture"

        /**
         * Elige la camara trasera a usar.
         *
         * "wide" = el gran angular (el 0.5x de la app de camara). Es una camara
         * FISICA distinta de la principal, asi que no se llega a el con zoom: hay
         * que abrirla por su id. Se identifica por tener la distancia focal mas
         * corta, que es lo que le da el campo de vision mas amplio.
         *
         * Si el equipo no tiene gran angular, se cae a la principal en silencio:
         * la misma APK sirve para toda la flota.
         */
        fun elegirCamara(cm: CameraManager, lente: String): String? {
            val traseras = cm.cameraIdList.filter { id ->
                cm.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) ==
                    CameraCharacteristics.LENS_FACING_BACK
            }
            if (traseras.isEmpty()) return null
            if (lente != "wide" || traseras.size == 1) return traseras.first()

            val focalMinima = { id: String ->
                cm.getCameraCharacteristics(id)
                    .get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                    ?.minOrNull() ?: Float.MAX_VALUE
            }
            val principal = traseras.first()
            val angular = traseras.minByOrNull { focalMinima(it) } ?: principal
            // Solo se considera gran angular de verdad si abre notablemente mas que
            // la principal; si no, no vale la pena cambiar de sensor (suelen tener
            // menos resolucion y peor calidad).
            return if (focalMinima(angular) < focalMinima(principal) * 0.8f) angular else principal
        }

        /**
         * Zoom digital sobre el sensor: recorta el area activa. 0.0 = sin recorte
         * (lo mas abierto), 1.0 = el maximo que permita el equipo.
         */
        fun regionDeZoom(c: CameraCharacteristics, zoomLineal: Float): android.graphics.Rect? {
            val activo = c.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE) ?: return null
            val maxZoom = c.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1f
            val z = zoomLineal.coerceIn(0f, 1f)
            if (z <= 0f || maxZoom <= 1f) return null

            val factor = 1f + (maxZoom - 1f) * z
            val ancho = (activo.width() / factor).toInt()
            val alto = (activo.height() / factor).toInt()
            val x = (activo.width() - ancho) / 2
            val y = (activo.height() - alto) / 2
            return android.graphics.Rect(x, y, x + ancho, y + alto)
        }
    }

    @Suppress("MissingPermission")
    suspend fun captureNow(
        lente: String = "main",
        zoomLineal: Float = 0f,
    ): ByteArray = suspendCancellableCoroutine { cont ->
        val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = elegirCamara(cm, lente)
            ?: return@suspendCancellableCoroutine cont.resumeWithException(
                IllegalStateException("no_back_camera")
            )
        android.util.Log.d(TAG, "captura con lente=$lente id=$cameraId zoom=$zoomLineal")

        val characteristics = cm.getCameraCharacteristics(cameraId)
        val sizes = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)!!
            .getOutputSizes(ImageFormat.JPEG)
        val size = sizes.maxByOrNull { it.width * it.height }!!

        val reader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 1)
        val handlerThread = HandlerThread("camera").apply { start() }
        val handler = Handler(handlerThread.looper)

        // Referencias para poder liberar TODO en cualquier salida. Antes la camara
        // y la sesion nunca se cerraban: la 2a captura fallaba/colgaba y podia
        // reiniciar la app por dejar la camara tomada.
        var cameraDevice: CameraDevice? = null
        var session: CameraCaptureSession? = null
        val closed = AtomicBoolean(false)

        fun cleanup() {
            if (!closed.compareAndSet(false, true)) return
            try { session?.close() } catch (_: Exception) {}
            try { cameraDevice?.close() } catch (_: Exception) {}
            try { reader.close() } catch (_: Exception) {}
            handlerThread.quitSafely()
        }

        cont.invokeOnCancellation { cleanup() }

        reader.setOnImageAvailableListener({ r ->
            val image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            val buf = image.planes[0].buffer
            val bytes = ByteArray(buf.remaining())
            buf.get(bytes)
            image.close()
            cleanup()
            if (cont.isActive) cont.resume(bytes)
        }, handler)

        try {
            cm.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    try {
                        val builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                        builder.addTarget(reader.surface)
                        builder.set(CaptureRequest.JPEG_QUALITY, 92.toByte())
                        builder.set(
                            CaptureRequest.CONTROL_AE_MODE,
                            CaptureRequest.CONTROL_AE_MODE_ON_AUTO_FLASH
                        )
                        // El zoom configurado para el sitio. Antes esta captura
                        // ignoraba cualquier ajuste, asi que la foto por horario
                        // salia siempre al encuadre por defecto del lente.
                        regionDeZoom(characteristics, zoomLineal)?.let {
                            builder.set(CaptureRequest.SCALER_CROP_REGION, it)
                        }

                        camera.createCaptureSession(
                            listOf(reader.surface),
                            object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(s: CameraCaptureSession) {
                                    session = s
                                    try {
                                        s.capture(builder.build(), null, handler)
                                    } catch (e: Exception) {
                                        cleanup()
                                        if (cont.isActive) cont.resumeWithException(e)
                                    }
                                }
                                override fun onConfigureFailed(s: CameraCaptureSession) {
                                    cleanup()
                                    if (cont.isActive) cont.resumeWithException(RuntimeException("session_failed"))
                                }
                            },
                            handler
                        )
                    } catch (e: Exception) {
                        cleanup()
                        if (cont.isActive) cont.resumeWithException(e)
                    }
                }
                override fun onDisconnected(camera: CameraDevice) {
                    cleanup()
                    if (cont.isActive) cont.resumeWithException(RuntimeException("camera_disconnected"))
                }
                override fun onError(camera: CameraDevice, error: Int) {
                    cleanup()
                    if (cont.isActive) cont.resumeWithException(RuntimeException("camera_error_$error"))
                }
            }, handler)
        } catch (e: Exception) {
            cleanup()
            if (cont.isActive) cont.resumeWithException(e)
        }
    }
}
