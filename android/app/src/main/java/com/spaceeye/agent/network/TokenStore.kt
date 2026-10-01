// TokenStore.kt — Encrypted token storage
package com.spaceeye.agent.network

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenStore(private val ctx: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            ctx, "space_eye_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveDeviceToken(token: String) {
        // Se anota de que servidor es: una app compilada contra otro servidor (el
        // equipo se mudo de instancia) no debe presentarse con la llave del anterior.
        prefs.edit().putString("device_token", token)
            .putString("device_token_server", com.spaceeye.agent.BuildConfig.SERVER_URL).apply()
    }

    fun getDeviceToken(): String? {
        val servidor = prefs.getString("device_token_server", null)
        if (servidor != null && servidor != com.spaceeye.agent.BuildConfig.SERVER_URL) return null
        return prefs.getString("device_token", null)
    }

    /** El servidor ya no reconoce la llave: se olvida para darse de alta otra vez. */
    fun clearDeviceToken() {
        prefs.edit().remove("device_token").remove("device_token_server").apply()
    }

    fun saveDeviceUid(uid: String) {
        prefs.edit().putString("device_uid", uid).apply()
    }

    @android.annotation.SuppressLint("HardwareIds")
    fun getOrCreateDeviceUid(): String {
        // ANDROID_ID es estable entre reinstalaciones (mismo equipo + firma de la
        // app), asi el dispositivo NO se duplica al reinstalar. Fallback: UUID.
        val androidId = try {
            android.provider.Settings.Secure.getString(
                ctx.contentResolver, android.provider.Settings.Secure.ANDROID_ID
            )
        } catch (_: Exception) { null }
        if (!androidId.isNullOrBlank() && androidId.length >= 8 && androidId != "9774d56d682e549c") {
            return "android-$androidId"
        }
        val existing = prefs.getString("device_uid", null)
        if (existing != null) return existing
        val uid = java.util.UUID.randomUUID().toString().replace("-", "")
        saveDeviceUid(uid)
        return uid
    }
}
