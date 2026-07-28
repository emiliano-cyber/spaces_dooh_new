package com.spaceeye.agent.commands

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.LocationManager
import android.util.Log
import com.spaceeye.agent.camera.PhotoCapture
import com.spaceeye.agent.camera.PhotoWatermark
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.network.SocketManager
import com.spaceeye.agent.network.WebRTCClient
import com.spaceeye.agent.service.MonitorService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import org.json.JSONObject

class CommandHandler(
    private val ctx: Context,
    private val scope: CoroutineScope,
    private val socketManager: SocketManager
) {
    companion object {
        private const val TAG = "CommandHandler"
    }

    private val photoCapture = PhotoCapture(ctx)
    private val webrtc = WebRTCClient(ctx)
    private val apiClient = ApiClient(ctx)

    init {
        socketManager.onWebRTCAnswer = { data ->
            // sdp can be an object { type, sdp } or a bare string
            val sdpField = data.opt("sdp")
            val sdpJson: JSONObject? = when (sdpField) {
                is JSONObject -> sdpField
                is String -> JSONObject().put("type", "answer").put("sdp", sdpField)
                else -> null
            }
            if (sdpJson != null) {
                webrtc.onAnswerReceived(sdpJson)
            } else {
                Log.e(TAG, "Invalid webrtc_answer format: $data")
            }
        }

        socketManager.onWebRTCIceCandidate = { data ->
            val candidate = data.optJSONObject("candidate")
            if (candidate != null) {
                webrtc.onIceCandidateReceived(candidate)
            }
        }
    }

    /**
     * Control manual de camara en vivo (canal `camera_control`, tiempo real).
     * Solo tiene efecto si hay un stream activo (la camara CameraX esta abierta).
     * control = { action, ...params }.
     */
    fun handleCameraControl(control: JSONObject) {
        when (control.optString("action")) {
            "zoom" -> webrtc.setZoom(control.optDouble("value", 0.0).toFloat())
            "focus" -> webrtc.focusAt(
                control.optDouble("x", 0.5).toFloat(),
                control.optDouble("y", 0.5).toFloat(),
                lock = false
            )
            "lock_focus" -> webrtc.focusAt(
                control.optDouble("x", 0.5).toFloat(),
                control.optDouble("y", 0.5).toFloat(),
                lock = true
            )
            "unlock_focus" -> webrtc.unlockFocus()
            "exposure" -> webrtc.setExposure(control.optInt("value", 0))
            "wb" -> webrtc.setWhiteBalance(control.optString("value", "auto"))
            else -> Log.w(TAG, "Unknown camera_control action: ${control.optString("action")}")
        }
    }

    // Direccion legible a partir del GPS (geocodificacion inversa). Best-effort:
    // requiere red; si no hay servicio devuelve lista vacia (se muestra solo DMS).
    private fun reverseGeocode(lat: Double, lng: Double): List<String> {
        return try {
            @Suppress("DEPRECATION")
            val addrs = Geocoder(ctx, Locale("es", "MX")).getFromLocation(lat, lng, 1)
            val a = addrs?.firstOrNull() ?: return emptyList()
            val out = mutableListOf<String>()
            val street = listOfNotNull(a.subThoroughfare, a.thoroughfare).joinToString(" ")
            if (street.isNotBlank()) out.add(street)
            a.subLocality?.let { out.add(it) }
            a.locality?.let { out.add(it) }
            a.adminArea?.let { out.add(it) }
            out
        } catch (e: Exception) {
            Log.w(TAG, "geocode: ${e.message}")
            emptyList()
        }
    }

    // Convierte coordenadas decimales a grados/minutos/segundos (ej. 21°2'51.19"N).
    private fun toDMS(lat: Double, lng: Double): String {
        fun part(v: Double, pos: String, neg: String): String {
            val hemi = if (v >= 0) pos else neg
            val a = abs(v)
            val d = a.toInt()
            val mFull = (a - d) * 60
            val m = mFull.toInt()
            val s = (mFull - m) * 60
            return "%d°%d'%.2f\"%s".format(d, m, s, hemi)
        }
        return "${part(lat, "N", "S")} ${part(lng, "E", "W")}"
    }

    // Ubicacion actual (ultima conocida) para estampar en la foto.
    @SuppressLint("MissingPermission")
    private fun currentLatLng(): Pair<Double, Double>? {
        return try {
            val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            if (loc != null) Pair(loc.latitude, loc.longitude) else null
        } catch (e: Exception) {
            Log.w(TAG, "location: ${e.message}")
            null
        }
    }

    fun handle(cmd: JSONObject) {
        val type = cmd.optString("command_type")
        val id = cmd.optInt("id")
        val payload = cmd.optJSONObject("payload")

        scope.launch {
            try {
                when (type) {
                    "TAKE_PHOTO" -> {
                        val commandId = if (id > 0) id else null
                        val campaignId = payload?.optInt("campaign_id")?.takeIf { it > 0 }
                        val scheduleId = payload?.optInt("schedule_id")?.takeIf { it > 0 }

                        // Habilita el tipo FGS camera durante la captura (Android 14
                        // exige acceso a camara solo con ese tipo activo).
                        MonitorService.setCameraActive(true)

                        // Rotacion del visor (stream) al momento de capturar, para
                        // que la foto se guarde con esa misma orientacion.
                        val rotation = payload?.optInt("rotation", 0) ?: 0

                        // Encuadre fijo del sitio, que manda el backend en la orden.
                        // Va en TODAS las ordenes de foto (programadas incluidas):
                        // antes la foto por horario ignoraba cualquier ajuste y salia
                        // siempre al encuadre por defecto del lente principal.
                        val lente = payload?.optString("camera_lens", "main") ?: "main"
                        val zoom = (payload?.optDouble("camera_zoom", 0.0) ?: 0.0).toFloat()
                        webrtc.setEncuadre(lente, zoom)

                        // Con stream activo: tomar desde la sesion CameraX (sin
                        // conflicto de camara y con los ajustes en vivo). Sin
                        // stream: abrir la camara con Camera2.
                        val photo: ByteArray? = if (webrtc.isStreaming()) {
                            suspendCancellableCoroutine { cont ->
                                webrtc.captureStill(rotation) { bytes -> if (cont.isActive) cont.resume(bytes) }
                            }
                        } else {
                            try {
                                photoCapture.captureNow(lente, zoom)
                            } catch (e: Exception) {
                                Log.e(TAG, "photoCapture failed: ${e.message}")
                                null
                            } finally {
                                // Si no hay stream, libera el tipo camera tras la foto.
                                if (!webrtc.isStreaming()) MonitorService.setCameraActive(false)
                            }
                        }

                        if (photo != null) {
                            Log.d(TAG, "Photo captured: ${photo.size} bytes")
                            RemoteLog.info(ctx, "photo", "Foto capturada (${photo.size / 1024} KB)")

                            // v0.8.0: ya NO se quema la marca en el telefono. Se sube la
                            // foto LIMPIA (watermark_baked=false) y el dashboard dibuja la
                            // marca configurable (nombre/fecha/hora) en la posicion del
                            // dispositivo. Se conserva el GPS como metadato.
                            val ll = currentLatLng()

                            val uploaded = withContext(Dispatchers.IO) {
                                apiClient.uploadPhoto(
                                    photoBytes = photo,
                                    commandId = commandId,
                                    campaignId = campaignId,
                                    scheduleId = scheduleId,
                                    gpsLat = ll?.first,
                                    gpsLng = ll?.second,
                                    source = "on_demand",
                                    watermarkBaked = false
                                )
                            }
                            if (id > 0) {
                                withContext(Dispatchers.IO) {
                                    apiClient.reportCommandResult(
                                        commandId = id,
                                        success = uploaded,
                                        errorMessage = if (!uploaded) "upload_failed" else null
                                    )
                                }
                            }
                        } else {
                            RemoteLog.error(ctx, "photo", "Fallo al capturar la foto")
                            if (id > 0) {
                                withContext(Dispatchers.IO) {
                                    apiClient.reportCommandResult(id, false, errorMessage = "capture_failed")
                                }
                            }
                        }
                    }
                    // Actualizacion remota: evita el viaje a sitio por cada version.
                    "UPDATE_APP" -> {
                        val url = payload?.optString("url").orEmpty()
                            .ifBlank { "${com.spaceeye.agent.BuildConfig.SERVER_URL}/space-eye.apk" }
                        val sha = payload?.optString("sha256")?.ifBlank { null }
                        val vc = payload?.optInt("version_code", 0)?.takeIf { it > 0 }
                        RemoteLog.info(ctx, "update", "Actualizacion solicitada desde el dashboard")

                        val res = withContext(Dispatchers.IO) {
                            com.spaceeye.agent.update.AppUpdater(ctx).actualizar(url, sha, vc)
                        }
                        // Se responde ANTES de que el instalador mate el proceso: si
                        // no, el comando quedaria "enviado" para siempre.
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                when (res) {
                                    is com.spaceeye.agent.update.AppUpdater.Resultado.Fallo ->
                                        apiClient.reportCommandResult(id, false, errorMessage = res.motivo)
                                    else -> apiClient.reportCommandResult(id, true)
                                }
                            }
                        }
                    }

                    "START_STREAM" -> {
                        // Habilita el tipo FGS camera antes de abrir la camara.
                        MonitorService.setCameraActive(true)
                        // Mismo encuadre fijo que tendran las fotos: hay que
                        // encuadrar viendo lo que de verdad se va a recibir.
                        webrtc.setEncuadre(
                            payload?.optString("camera_lens", "main") ?: "main",
                            (payload?.optDouble("camera_zoom", 0.0) ?: 0.0).toFloat()
                        )
                        // ICE servers (STUN + TURN) del backend, para conectar en
                        // redes remotas / datos moviles.
                        val ice = withContext(Dispatchers.IO) { apiClient.getIceServers() }
                        if (ice != null) webrtc.setIceServers(ice)
                        val sessionId = payload?.optString("session_id") ?: ""
                        webrtc.startStreaming(sessionId) { event, data ->
                            socketManager.emit(event, data)
                        }
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                    }
                    "STOP_STREAM" -> {
                        webrtc.stopStreaming()
                        // Libera el tipo FGS camera al terminar el stream.
                        MonitorService.setCameraActive(false)
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                    }
                    "CHANGE_QUALITY" -> {
                        webrtc.setQuality(payload?.optString("quality") ?: "medium")
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                    }
                    "REBOOT_APP" -> {
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                        android.os.Process.killProcess(android.os.Process.myPid())
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling $type: ${e.message}", e)
                RemoteLog.error(ctx, "command", "Error en $type: ${e.message}")
                if (id > 0) {
                    try {
                        withContext(Dispatchers.IO) {
                            apiClient.reportCommandResult(id, false, errorMessage = e.message)
                        }
                    } catch (_: Exception) {}
                }
            }
        }
    }
}
