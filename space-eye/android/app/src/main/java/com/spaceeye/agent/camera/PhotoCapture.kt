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

/**
 * La camara no se pudo abrir, y por que.
 *
 * Antes esto viajaba como un RuntimeException("camera_error_3") y el dashboard
 * mostraba un "capture_failed" pelado: para saber que el 3 significa "el sistema
 * te niega la camara" habia que leer la documentacion de Android con el codigo
 * en la mano. El motivo va escrito, en castellano, para que se pueda actuar
 * desde el dashboard sin ir al sitio.
 */
class CamaraNoDisponible(val codigo: Int, val motivo: String) :
    RuntimeException("camera_error_$codigo: $motivo")

class PhotoCapture(private val ctx: Context) {

    companion object {
        private const val TAG = "PhotoCapture"

        /**
         * Traduce los codigos de CameraDevice.StateCallback. Son cinco y cada uno
         * pide una accion distinta -desde "cierra la otra app" hasta "reinicia el
         * telefono"-, asi que confundirlos cuesta un viaje al sitio.
         */
        fun motivoDeError(codigo: Int): String = when (codigo) {
            CameraDevice.StateCallback.ERROR_CAMERA_IN_USE ->
                "otra app tiene tomada la camara"
            CameraDevice.StateCallback.ERROR_MAX_CAMERAS_IN_USE ->
                "el sistema ya tiene abiertas todas las camaras que permite a la vez"
            CameraDevice.StateCallback.ERROR_CAMERA_DISABLED ->
                "el sistema no permite abrir la camara: revisa el interruptor de Acceso a la camara, el permiso de la app o una politica del dispositivo"
            CameraDevice.StateCallback.ERROR_CAMERA_DEVICE ->
                "la camara devolvio un error de hardware; casi siempre se arregla reiniciando el telefono"
            CameraDevice.StateCallback.ERROR_CAMERA_SERVICE ->
                "el servicio de camara de Android se cayo; hace falta reiniciar el telefono"
            else -> "error $codigo de la camara"
        }

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
         * Cuantas veces acerca un valor del deslizador (0..1).
         *
         * ES LA MISMA CUENTA QUE HACE CameraX en setLinearZoom, y tiene que
         * seguir siendolo. Aqui estuvo la raiz de un problema que costo dias:
         * habia dos formas de tomar la foto y cada una interpretaba el MISMO
         * numero guardado de una manera distinta.
         *
         *   antes, aqui:  factor = 1 + (maxZoom - 1) x valor
         *   en CameraX:   el campo de vision se cierra de forma lineal
         *
         * En una camara de 1x a 8x, un 0.52 guardado desde el dashboard salia a
         * 1.8x en la vista en vivo y a 4.6x en la foto: la persona encuadraba
         * mirando el visor, guardaba, y la foto salia dos veces y media mas
         * cerrada, recortada de los lados y borrosa por ampliar un pedazo chico
         * del sensor. Con la misma formula, lo que se ve es lo que se guarda.
         */
        fun factorDeZoom(c: CameraCharacteristics, zoomLineal: Float): Float {
            val maxZoom = c.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1f
            val z = zoomLineal.coerceIn(0f, 1f)
            if (z <= 0f || maxZoom <= 1f) return 1f
            // Campo de vision lineal: el inverso del acercamiento se interpola.
            val inverso = 1f + z * (1f / maxZoom - 1f)
            return if (inverso <= 0f) maxZoom else (1f / inverso).coerceIn(1f, maxZoom)
        }

        /**
         * Zoom digital sobre el sensor: recorta el area activa. 0.0 = sin recorte
         * (lo mas abierto), 1.0 = el tope de arriba.
         */
        fun regionDeZoom(c: CameraCharacteristics, zoomLineal: Float): android.graphics.Rect? {
            val activo = c.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE) ?: return null
            val factor = factorDeZoom(c, zoomLineal)
            if (factor <= 1f) return null

            val ancho = (activo.width() / factor).toInt()
            val alto = (activo.height() / factor).toInt()
            val x = (activo.width() - ancho) / 2
            val y = (activo.height() - alto) / 2
            return android.graphics.Rect(x, y, x + ancho, y + alto)
        }

        /**
         * Tamaño de foto que conviene pedir cuando hay recorte.
         *
         * Aqui estaba la otra mitad del problema: se pedia SIEMPRE el tamaño mas
         * grande que soportara la camara. Al recortar el sensor, esa zona tiene
         * menos pixeles reales que el archivo pedido, asi que el telefono los
         * inventaba estirando la imagen: el archivo seguia siendo de 12 megapixeles
         * pero el detalle era el de una foto mucho mas chica, y se veia lavada.
         *
         * Ahora se pide el mayor tamaño que el recorte pueda llenar de verdad. La
         * foto sale mas chica al acercar, pero NITIDA, y de paso pesa menos, que
         * en un equipo con SIM tampoco sobra.
         */
        fun tamañoParaRecorte(
            disponibles: Array<android.util.Size>,
            recorte: android.graphics.Rect?,
        ): android.util.Size {
            val mayor = disponibles.maxByOrNull { it.width * it.height }!!
            if (recorte == null) return mayor
            return disponibles
                .filter { it.width <= recorte.width() && it.height <= recorte.height() }
                .maxByOrNull { it.width * it.height }
            // Si el recorte es mas chico que la foto mas pequeña que sabe dar la
            // camara, se usa esa: no hay nada mejor disponible.
                ?: disponibles.minByOrNull { it.width * it.height }!!
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
                IllegalStateException("el equipo no reporta ninguna camara trasera")
            )
        android.util.Log.d(TAG, "captura con lente=$lente id=$cameraId zoom=$zoomLineal")

        val characteristics = cm.getCameraCharacteristics(cameraId)
        val sizes = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)!!
            .getOutputSizes(ImageFormat.JPEG)

        // El recorte se calcula ANTES de elegir el tamaño, porque manda: pedir mas
        // pixeles de los que el recorte tiene solo los inventa.
        val recorte = regionDeZoom(characteristics, zoomLineal)
        val size = tamañoParaRecorte(sizes, recorte)
        android.util.Log.d(
            TAG,
            "zoom=$zoomLineal -> ${"%.1f".format(factorDeZoom(characteristics, zoomLineal))}x, foto ${size.width}x${size.height}"
        )

        val reader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 1)
        val handlerThread = HandlerThread("camera").apply { start() }
        val handler = Handler(handlerThread.looper)

        // Referencias para poder liberar TODO en cualquier salida. Antes la camara
        // y la sesion nunca se cerraban: la 2a captura fallaba/colgaba y podia
        // reiniciar la app por dejar la camara tomada.
        var cameraDevice: CameraDevice? = null
        var session: CameraCaptureSession? = null
        val closed = AtomicBoolean(false)

        // UNA sola respuesta, pase lo que pase.
        //
        // Aqui habia una carrera que tumbaba la app entera: cada callback hacia
        // "if (cont.isActive) cont.resume(...)", y mirar y responder no son un
        // solo paso. Con la camara negada llegaban dos avisos casi juntos (el
        // error del dispositivo y el de la sesion), los dos veian la operacion
        // viva y el segundo reventaba con "Already resumed". El fallo de camara
        // se convertia en un crash del agente -visto en TLALPAN el 26-ago-,
        // cuando lo correcto es reportarlo y seguir trabajando.
        val respondido = AtomicBoolean(false)
        fun entregar(bytes: ByteArray) {
            if (respondido.compareAndSet(false, true)) cont.resume(bytes)
        }
        fun fallar(e: Throwable) {
            if (respondido.compareAndSet(false, true)) cont.resumeWithException(e)
        }

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
            entregar(bytes)
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
                        recorte?.let { builder.set(CaptureRequest.SCALER_CROP_REGION, it) }

                        // Enfoque antes de disparar. Sin esto la camara dispara con
                        // el enfoque que traia de antes, y al acercar el sensor eso
                        // se nota mucho mas: cualquier desenfoque se amplia igual
                        // que la imagen.
                        builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_AUTO)
                        builder.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_START)

                        camera.createCaptureSession(
                            listOf(reader.surface),
                            object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(s: CameraCaptureSession) {
                                    session = s
                                    try {
                                        s.capture(builder.build(), null, handler)
                                    } catch (e: Exception) {
                                        cleanup()
                                        fallar(e)
                                    }
                                }
                                override fun onConfigureFailed(s: CameraCaptureSession) {
                                    cleanup()
                                    fallar(RuntimeException("la camara no acepto la sesion de captura"))
                                }
                            },
                            handler
                        )
                    } catch (e: Exception) {
                        cleanup()
                        fallar(e)
                    }
                }
                override fun onDisconnected(camera: CameraDevice) {
                    cleanup()
                    fallar(RuntimeException("el sistema desconecto la camara a media captura (suele ser otra app pidiendola)"))
                }
                override fun onError(camera: CameraDevice, error: Int) {
                    cleanup()
                    fallar(CamaraNoDisponible(error, motivoDeError(error)))
                }
            }, handler)
        } catch (e: Exception) {
            cleanup()
            fallar(e)
        }
    }
}
