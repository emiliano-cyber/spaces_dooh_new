package com.spaceeye.agent.commands

import android.content.Context
import android.util.Log
import com.spaceeye.agent.camera.PhotoCapture
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.SocketManager
import com.spaceeye.agent.network.WebRTCClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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

    fun handle(cmd: JSONObject) {
        val type = cmd.optString("command_type")
        val id = cmd.optInt("id")
        val payload = cmd.optJSONObject("payload")

        scope.launch {
            try {
                when (type) {
                    "TAKE_PHOTO" -> {
                        val photo = photoCapture.captureNow()
                        Log.d(TAG, "Photo captured: ${photo.size} bytes")

                        // Upload photo to backend
                        val commandId = if (id > 0) id else null
                        val campaignId = payload?.optInt("campaign_id")?.takeIf { it > 0 }
                        val scheduleId = payload?.optInt("schedule_id")?.takeIf { it > 0 }

                        val uploaded = withContext(Dispatchers.IO) {
                            apiClient.uploadPhoto(
                                photoBytes = photo,
                                commandId = commandId,
                                campaignId = campaignId,
                                scheduleId = scheduleId,
                                source = "on_demand"
                            )
                        }

                        // Report command result
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(
                                    commandId = id,
                                    success = uploaded,
                                    errorMessage = if (!uploaded) "upload_failed" else null
                                )
                            }
                        }
                    }
                    "START_STREAM" -> {
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
