package com.spaceeye.agent.network

import android.content.Context
import android.util.Log
import com.spaceeye.agent.BuildConfig
import com.spaceeye.agent.telemetry.DeviceStatus
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.PeerConnection
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class ApiClient(ctx: Context) {

    companion object {
        private const val TAG = "ApiClient"
    }

    private val tokenStore = TokenStore(ctx)
    private val baseUrl = BuildConfig.SERVER_URL

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    fun uploadPhoto(
        photoBytes: ByteArray,
        commandId: Int? = null,
        scheduleId: Int? = null,
        campaignId: Int? = null,
        gpsLat: Double? = null,
        gpsLng: Double? = null,
        source: String = "on_demand"
    ): Boolean {
        val token = tokenStore.getDeviceToken() ?: return false

        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        val builder = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "photo", "capture.jpg",
                photoBytes.toRequestBody("image/jpeg".toMediaType())
            )
            .addFormDataPart("taken_at", isoFormat.format(Date()))
            .addFormDataPart("source", source)

        commandId?.let { builder.addFormDataPart("command_id", it.toString()) }
        scheduleId?.let { builder.addFormDataPart("schedule_id", it.toString()) }
        campaignId?.let { builder.addFormDataPart("campaign_id", it.toString()) }
        gpsLat?.let { builder.addFormDataPart("gps_lat", it.toString()) }
        gpsLng?.let { builder.addFormDataPart("gps_lng", it.toString()) }

        val request = Request.Builder()
            .url("$baseUrl/api/device/upload-photo")
            .header("Authorization", "Bearer $token")
            .post(builder.build())
            .build()

        return try {
            val response = http.newCall(request).execute()
            val success = response.isSuccessful
            if (success) {
                Log.d(TAG, "Photo uploaded: ${photoBytes.size} bytes")
            } else {
                Log.e(TAG, "Photo upload failed: ${response.code} ${response.body?.string()}")
            }
            response.close()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Photo upload error: ${e.message}")
            false
        }
    }

    /**
     * Obtiene los ICE servers (STUN + TURN) del backend para WebRTC. En redes
     * remotas / datos moviles el TURN es imprescindible. Devuelve null si falla
     * (el llamador cae a STUN por defecto).
     */
    fun getIceServers(): List<PeerConnection.IceServer>? {
        val token = tokenStore.getDeviceToken() ?: return null
        val request = Request.Builder()
            .url("$baseUrl/api/device/ice-servers")
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        return try {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val arr = JSONObject(response.body!!.string()).getJSONArray("iceServers")
                val list = mutableListOf<PeerConnection.IceServer>()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val urls = mutableListOf<String>()
                    when (val u = o.get("urls")) {
                        is JSONArray -> for (j in 0 until u.length()) urls.add(u.getString(j))
                        else -> urls.add(u.toString())
                    }
                    val builder = PeerConnection.IceServer.builder(urls)
                    if (o.has("username")) builder.setUsername(o.getString("username"))
                    if (o.has("credential")) builder.setPassword(o.getString("credential"))
                    list.add(builder.createIceServer())
                }
                list
            }
        } catch (e: Exception) {
            Log.e(TAG, "getIceServers error: ${e.message}")
            null
        }
    }

    fun reportStatus(status: DeviceStatus): Boolean {
        val token = tokenStore.getDeviceToken() ?: return false

        val json = JSONObject().apply {
            put("battery_pct", status.batteryPct)
            status.batteryTemp?.let { put("battery_temp", it) }
            put("battery_charging", status.batteryCharging)
            status.signalDbm?.let { put("signal_dbm", it) }
            status.networkType?.let { put("network_type", it) }
            status.networkOperator?.let { put("network_operator", it) }
            status.gpsLat?.let { put("gps_lat", it) }
            status.gpsLng?.let { put("gps_lng", it) }
            status.gpsAccuracyM?.let { put("gps_accuracy_m", it) }
            put("storage_free_mb", status.storageFreeMb)
            put("ram_free_mb", status.ramFreeMb)
            status.cpuTemp?.let { put("cpu_temp", it) }
            put("uptime_seconds", status.uptimeSeconds)
            // Consumo de datos (movil/WiFi). Campos opcionales: si el equipo no los
            // pudo leer se omiten y el backend/dashboard muestran n/d.
            status.dataUsage?.let { du ->
                du.mobileToday?.let { put("data_mobile_today", it) }
                du.mobileWeek?.let { put("data_mobile_week", it) }
                du.mobileMonth?.let { put("data_mobile_month", it) }
                du.mobileTotal?.let { put("data_mobile_total", it) }
                du.wifiToday?.let { put("data_wifi_today", it) }
                du.wifiWeek?.let { put("data_wifi_week", it) }
                du.wifiMonth?.let { put("data_wifi_month", it) }
                du.wifiTotal?.let { put("data_wifi_total", it) }
            }
        }

        val request = Request.Builder()
            .url("$baseUrl/api/device/status")
            .header("Authorization", "Bearer $token")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        return try {
            val response = http.newCall(request).execute()
            val success = response.isSuccessful
            if (!success) {
                Log.e(TAG, "Status report failed: ${response.code}")
            }
            response.close()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Status report error: ${e.message}")
            false
        }
    }

    fun reportCommandResult(
        commandId: Int,
        success: Boolean,
        result: JSONObject? = null,
        errorMessage: String? = null
    ): Boolean {
        val token = tokenStore.getDeviceToken() ?: return false

        val json = JSONObject().apply {
            put("command_id", commandId)
            put("success", success)
            result?.let { put("result", it) }
            errorMessage?.let { put("error_message", it) }
        }

        val request = Request.Builder()
            .url("$baseUrl/api/device/command-result")
            .header("Authorization", "Bearer $token")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        return try {
            val response = http.newCall(request).execute()
            val ok = response.isSuccessful
            response.close()
            ok
        } catch (e: Exception) {
            Log.e(TAG, "Command result report error: ${e.message}")
            false
        }
    }
}
