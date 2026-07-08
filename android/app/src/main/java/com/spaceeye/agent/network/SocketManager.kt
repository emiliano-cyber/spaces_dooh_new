package com.spaceeye.agent.network

import android.content.Context
import android.util.Log
import com.spaceeye.agent.BuildConfig
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

class SocketManager(private val ctx: Context) {

    companion object {
        private const val TAG = "SocketManager"
    }

    private var socket: Socket? = null
    private val tokenStore = TokenStore(ctx)

    var onCommand: ((JSONObject) -> Unit)? = null
    var onWebRTCAnswer: ((JSONObject) -> Unit)? = null
    var onWebRTCIceCandidate: ((JSONObject) -> Unit)? = null

    fun connect() {
        val token = tokenStore.getDeviceToken() ?: return

        val opts = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .setReconnectionAttempts(Int.MAX_VALUE)
            .setReconnectionDelay(2_000)
            .setReconnectionDelayMax(30_000)
            .setRandomizationFactor(0.5)
            .setTransports(arrayOf("websocket"))
            .build()

        socket = IO.socket("${BuildConfig.SERVER_URL}/devices", opts).apply {
            on("command") { args ->
                val cmd = args[0] as? JSONObject ?: return@on
                onCommand?.invoke(cmd)
                emit("command_ack", JSONObject().put("command_id", cmd.optInt("id")))
            }

            on("webrtc_answer") { args ->
                val data = args[0] as? JSONObject ?: return@on
                Log.d(TAG, "Received webrtc_answer")
                onWebRTCAnswer?.invoke(data)
            }

            on("webrtc_ice_candidate") { args ->
                val data = args[0] as? JSONObject ?: return@on
                Log.d(TAG, "Received webrtc_ice_candidate")
                onWebRTCIceCandidate?.invoke(data)
            }

            connect()
        }
    }

    fun emit(event: String, data: JSONObject) {
        socket?.emit(event, data)
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}
