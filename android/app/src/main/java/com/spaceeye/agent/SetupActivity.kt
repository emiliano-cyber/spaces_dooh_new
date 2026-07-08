// SetupActivity.kt — Handles initial device pairing
package com.spaceeye.agent

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import com.spaceeye.agent.network.TokenStore
import com.spaceeye.agent.service.MonitorService
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class SetupActivity : ComponentActivity() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerDevice()
    }

    private fun registerDevice() {
        scope.launch {
            val tokenStore = TokenStore(applicationContext)
            val deviceUid = tokenStore.getOrCreateDeviceUid()

            val json = JSONObject().apply {
                put("device_uid", deviceUid)
                put("android_version", Build.VERSION.RELEASE)
                put("app_version", BuildConfig.VERSION_NAME)
                put("model", Build.MODEL)
                put("manufacturer", Build.MANUFACTURER)
            }

            val client = OkHttpClient()
            val request = Request.Builder()
                .url("${BuildConfig.SERVER_URL}/api/device/register")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .build()

            try {
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = JSONObject(response.body!!.string())
                    tokenStore.saveDeviceToken(body.getString("token"))
                    withContext(Dispatchers.Main) {
                        MonitorService.start(applicationContext)
                        finish()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
