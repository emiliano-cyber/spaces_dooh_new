package com.spaceeye.agent.commands

import android.content.Context
import android.util.Log
import com.spaceeye.agent.camera.PhotoCapture
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

                        // Con stream activo: tomar desde la sesion CameraX (sin
                        // conflicto de camara y con los ajustes en vivo). Sin
                        // stream: abrir la camara con Camera2.
                        val photo: ByteArray? = if (webrtc.isStreaming()) {
                            suspendCancellableCoroutine { cont ->
                                webrtc.captureStill { bytes -> if (cont.isActive) cont.resume(bytes) }
                            }
                        } else {
                            try {
                                photoCapture.captureNow()
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
                            val uploaded = withContext(Dispatchers.IO) {
                                apiClient.uploadPhoto(
                                    photoBytes = photo,
                                    commandId = commandId,
                                    campaignId = campaignId,
                                    scheduleId = scheduleId,
                                    source = "on_demand"
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
                    "START_STREAM" -> {
                        // Habilita el tipo FGS camera antes de abrir la camara.
                        MonitorService.setCameraActive(true)
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
