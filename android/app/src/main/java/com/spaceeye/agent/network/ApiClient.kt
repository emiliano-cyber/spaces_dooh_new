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


/** Ver [ApiClient.reportarFalla]. */
const val FALLA_RECHAZADA = -1L

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
        source: String = "on_demand",
        watermarkBaked: Boolean = true,
        // Solo con source=creative_change: la huella del creativo que disparo la
        // foto, para que el dashboard muestre la imagen junto a su creativo.
        phash: String? = null
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
        phash?.let { builder.addFormDataPart("phash", it) }
        builder.addFormDataPart("watermark_baked", watermarkBaked.toString())

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

    /**
     * Todo lo que el equipo necesita para vigilar su pantalla: donde esta en la
     * foto, su horario, la configuracion de creativos y de fallas, y las fallas
     * que el servidor tiene abiertas. Se pide antes de cada vuelta; son unos
     * cientos de bytes. null si el servidor no contesto.
     */
    fun monitoreo(): JSONObject? {
        val token = tokenStore.getDeviceToken() ?: return null
        val request = Request.Builder()
            .url("$baseUrl/api/device/monitoreo")
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        return try {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) null else JSONObject(response.body!!.string())
            }
        } catch (e: Exception) {
            Log.e(TAG, "monitoreo error: ${e.message}")
            null
        }
    }

    /**
     * Abre o cierra una falla de la pantalla, con su foto de evidencia. Es lo
     * unico del monitoreo que pesa, y solo sale cuando algo cambia de estado.
     * Devuelve el numero de falla que asigno el servidor, o null si no salio.
     */
    /**
     * Devuelve el numero de la falla, null si hay que reintentar (sin red, el
     * servidor caido) o [FALLA_RECHAZADA] si el servidor la rechazo y reenviarla
     * no la va a arreglar (tope del dia, datos invalidos). Antes todo lo que no
     * fuera 2xx se reintentaba cada vuelta CON SU FOTO: un rechazo permanente
     * podia gastar cientos de MB al dia.
     */
    fun reportarFalla(campos: Map<String, String>, evidencia: ByteArray?): Long? {
        val token = tokenStore.getDeviceToken() ?: return null
        val b = MultipartBody.Builder().setType(MultipartBody.FORM)
        for ((k, v) in campos) b.addFormDataPart(k, v)
        evidencia?.let { b.addFormDataPart("photo", "evidencia.jpg", it.toRequestBody("image/jpeg".toMediaType())) }
        val request = Request.Builder()
            .url("$baseUrl/api/device/fallas")
            .header("Authorization", "Bearer $token")
            .post(b.build())
            .build()
        return try {
            http.newCall(request).execute().use { r ->
                when {
                    r.isSuccessful -> JSONObject(r.body!!.string()).optLong("id").takeIf { it > 0 }
                    r.code in 400..499 && r.code != 408 -> {
                        Log.w(TAG, "reportarFalla: el servidor la rechazo (${r.code}), no se reintenta")
                        FALLA_RECHAZADA
                    }
                    else -> { Log.e(TAG, "reportarFalla: ${r.code}"); null }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "reportarFalla error: ${e.message}")
            null
        }
    }

    /**
     * @param extra resultado de la ultima vuelta de vigilancia ({creativos, salud}).
     *   Viaja pegado a este reporte, que sale igual cada minuto, para que vigilar
     *   la pantalla no agregue peticiones propias.
     */
    fun reportStatus(status: DeviceStatus, extra: JSONObject? = null): Boolean {
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
            // Permite ver en el dashboard que equipos se pueden actualizar solos.
            put("device_owner", status.deviceOwner)
            put("app_version_code", com.spaceeye.agent.BuildConfig.VERSION_CODE)
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
            extra?.let { e -> e.keys().forEach { k -> val key = k as String; put(key, e.get(key)) } }
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
