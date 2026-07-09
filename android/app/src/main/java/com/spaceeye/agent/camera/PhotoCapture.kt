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

    @Suppress("MissingPermission")
    suspend fun captureNow(): ByteArray = suspendCancellableCoroutine { cont ->
        val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = cm.cameraIdList.firstOrNull { id ->
            cm.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) ==
                CameraCharacteristics.LENS_FACING_BACK
        } ?: return@suspendCancellableCoroutine cont.resumeWithException(
            IllegalStateException("no_back_camera")
        )

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
