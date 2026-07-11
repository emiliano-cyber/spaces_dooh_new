package com.spaceeye.agent.network

import android.content.Context
import android.util.Log
import com.spaceeye.agent.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Logging remoto: envia eventos/errores del agente al backend (device_logs)
 * para poder diagnosticar equipos en campo sin USB. Best-effort: si no hay red
 * o token, no interrumpe la operacion.
 */
object RemoteLog {
    private const val TAG = "RemoteLog"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private fun buildRequest(token: String, level: String, category: String, message: String): Request {
        val json = JSONObject().apply {
            put("level", level)
            put("category", category)
            put("message", message)
        }
        return Request.Builder()
            .url("${BuildConfig.SERVER_URL}/api/device/log")
            .header("Authorization", "Bearer $token")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()
    }

    /** Envio asincrono (uso normal). Tambien deja rastro en logcat. */
    fun log(ctx: Context, level: String, category: String, message: String) {
        Log.d(TAG, "[$level/$category] $message")
        val token = TokenStore(ctx).getDeviceToken() ?: return
        scope.launch {
            try {
                client.newCall(buildRequest(token, level, category, message)).execute().use { }
            } catch (e: Exception) {
                Log.w(TAG, "log post failed: ${e.message}")
            }
        }
    }

    fun info(ctx: Context, category: String, message: String) = log(ctx, "info", category, message)
    fun warn(ctx: Context, category: String, message: String) = log(ctx, "warning", category, message)
    fun error(ctx: Context, category: String, message: String) = log(ctx, "error", category, message)

    /**
     * Envio sincrono con timeout corto, para el manejador de crashes (el proceso
     * esta muriendo). Corre en un hilo aparte para no violar NetworkOnMainThread.
     */
    fun logCrashBlocking(ctx: Context, category: String, message: String) {
        val token = TokenStore(ctx).getDeviceToken() ?: return
        val t = Thread {
            try {
                client.newCall(buildRequest(token, "critical", category, message)).execute().use { }
            } catch (_: Exception) {
            }
        }
        t.start()
        try {
            t.join(1500)
        } catch (_: Exception) {
        }
    }
}
